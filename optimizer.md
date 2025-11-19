# WvW VP Scenario Optimizer — Implementation Guide

This document contains everything an engineer needs to add a mathematically
sound “What‑If VP Scenario Planner” to the existing Guild Wars 2 WvW UI.
It ships a browser‑compatible MILP optimizer (glpk.js, WebAssembly) that:

- Enforces a desired final ordering among three worlds
- Minimizes, in order:
  1) the 1st–2nd VP margin
  2) then the 2nd–3rd VP margin
  3) then “effort” (uses lower placements whenever margins are already minimal)
- Returns a “minimum effort” placement plan for all remaining skirmishes and
  the projected final VP tallies

The approach fixes the two issues observed in the current planner:
- It stops the 1st world from overshooting by minimizing the pairwise margins
- It correctly identifies scenarios as achievable when they are, and produces a
  concrete, minimal plan


## 1) Installation

- Add dependency:
```bash
npm i glpk.js
```

- No server needed; the solver runs fully in the browser via WebAssembly.


## 2) Data contract with the UI

The UI must provide:

- worlds: the three world names (as shown in the UI), any order
- desiredOrder: the desired final ordering [first, second, third]
- currentVP: current VP for each world at the moment of calculation
- skirmishes: remaining skirmishes with start time and region (na | eu)

Notes:
- Strict inequalities are enforced as “≥ +1” because VP awards are integers.
- Region is required so the correct VP awards per skirmish time can be used.


## 3) Algorithm (what it optimizes)

- Binary variables y[s,w,p] ∈ {0,1}, meaning world w takes placement p in
  skirmish s; p ∈ {1,2,3}.
- Constraints per skirmish:
  - Each placement (1st/2nd/3rd) is assigned to exactly one world
  - Each world gets exactly one placement
- Final‑order constraints (strict):
  - VP(first) ≥ VP(second) + 1
  - VP(second) ≥ VP(third) + 1
- Objectives (lexicographic):
  1) Minimize gap12 = VP(first) − VP(second)
  2) Given the minimum gap12, minimize gap23 = VP(second) − VP(third)
  3) Given both minimum gaps, minimize “effort”:
     - cost(first) = 2, cost(second) = 1, cost(third) = 0
     - This pushes worlds to take lower placements when margins are already
       optimal, yielding a “minimum effort” plan

This matches the requirement “minimize firstVP − secondVP and secondVP −
thirdVP such that firstVP > secondVP > thirdVP” and addresses cases where the
top world over‑performs unnecessarily.


## 4) Code

Create lib/wvw-optimizer.ts with the following content.

```ts
/**
 * wvw-optimizer.ts
 *
 * A browser-compatible optimizer for Guild Wars 2 World vs World
 * "What-If VP Scenario Planning".
 *
 * It uses glpk.js (WebAssembly GLPK) to solve a 0/1 mixed-integer linear
 * program (MILP) that:
 *   - assigns 1st/2nd/3rd places to each of the three worlds for every
 *     remaining skirmish,
 *   - enforces your desired final order strictly (A > B > C),
 *   - and minimizes margins and "effort" lexicographically:
 *       1) minimize A - B
 *       2) then, minimize B - C
 *       3) then, minimize "effort" (prefer lower placements when margins
 *          are already optimal)
 *
 * Why this helps:
 *   - It prevents the 1st world from overshooting the 2nd more than needed.
 *   - If the desired flip is feasible, the solver will find a concrete,
 *     minimum-effort plan; if not, it reports that it's not achievable.
 *
 * Install: npm i glpk.js
 *
 * Note on typings:
 *   - Some glpk.js type versions require 'ub' to be present in bounds even
 *     when using GLP_LO. We include it (solver ignores it).
 *   - We don't pass solve options (msgLevel/msglev) to avoid typing drift.
 *   - result.vars[varName] can be a number or { value: number } depending on
 *     the package build; we read it robustly in varVal().
 */

import GLPKFactory, { GLPK, LP } from 'glpk.js';

/* -------------------------------------------------------------------------- */
/*  VP schedules and utility to fetch tier by UTC hour + region               */
/* -------------------------------------------------------------------------- */

export interface VPTier {
  first: number;
  second: number;
  third: number;
  tier: 'low' | 'medium' | 'high' | 'peak';
}

/**
 * VP_SCHEDULES
 * - UTC-based 2-hour blocks for EU and NA.
 * - Values match the GW2 Wiki and your provided table.
 */
const VP_SCHEDULES = {
  eu: [
    { start: 0, end: 2, vp: { first: 15, second: 14, third: 12 }, tier: 'low' },
    { start: 2, end: 4, vp: { first: 15, second: 14, third: 12 }, tier: 'low' },
    { start: 4, end: 6, vp: { first: 15, second: 14, third: 12 }, tier: 'low' },
    { start: 6, end: 8, vp: { first: 15, second: 14, third: 12 }, tier: 'low' },
    {
      start: 8,
      end: 10,
      vp: { first: 22, second: 18, third: 14 },
      tier: 'medium',
    },
    {
      start: 10,
      end: 12,
      vp: { first: 22, second: 18, third: 14 },
      tier: 'medium',
    },
    {
      start: 12,
      end: 14,
      vp: { first: 22, second: 18, third: 14 },
      tier: 'medium',
    },
    { start: 14, end: 16, vp: { first: 31, second: 24, third: 17 }, tier: 'high' },
    { start: 16, end: 18, vp: { first: 31, second: 24, third: 17 }, tier: 'high' },
    { start: 18, end: 20, vp: { first: 51, second: 37, third: 24 }, tier: 'peak' },
    { start: 20, end: 22, vp: { first: 51, second: 37, third: 24 }, tier: 'peak' },
    { start: 22, end: 24, vp: { first: 31, second: 24, third: 17 }, tier: 'high' },
  ] as const,
  na: [
    { start: 0, end: 2, vp: { first: 43, second: 32, third: 21 }, tier: 'peak' },
    { start: 2, end: 4, vp: { first: 43, second: 32, third: 21 }, tier: 'peak' },
    { start: 4, end: 6, vp: { first: 31, second: 24, third: 17 }, tier: 'high' },
    { start: 6, end: 8, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' },
    { start: 8, end: 10, vp: { first: 19, second: 16, third: 13 }, tier: 'low' },
    { start: 10, end: 12, vp: { first: 19, second: 16, third: 13 }, tier: 'low' },
    { start: 12, end: 14, vp: { first: 19, second: 16, third: 13 }, tier: 'low' },
    { start: 14, end: 16, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' },
    { start: 16, end: 18, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' },
    { start: 18, end: 20, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' },
    { start: 20, end: 22, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' },
    { start: 22, end: 24, vp: { first: 31, second: 24, third: 17 }, tier: 'high' },
  ] as const,
};

/**
 * Returns VP tier for a skirmish start time (UTC hour) and region.
 */
export function getVPTierForTime(
  skirmishStartTime: Date,
  region: 'na' | 'eu'
): VPTier {
  const utcHour = skirmishStartTime.getUTCHours();
  const schedule = VP_SCHEDULES[region];
  const slot = schedule.find((s) => utcHour >= s.start && utcHour < s.end);

  if (!slot) {
    // Defensive default; should never happen if inputs are valid.
    return {
      first: region === 'na' ? 19 : 15,
      second: region === 'na' ? 16 : 14,
      third: region === 'na' ? 13 : 12,
      tier: 'low',
    };
  }

  return {
    first: slot.vp.first,
    second: slot.vp.second,
    third: slot.vp.third,
    tier: slot.tier,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public types for integrating with the UI                                  */
/* -------------------------------------------------------------------------- */

export type WorldId = string;
export type Placement = 1 | 2 | 3;

export interface Skirmish {
  id: number; // unique integer ID; use the table row number (e.g., 48,49,...)
  startTime: Date; // we only read getUTCHours()
  region: 'na' | 'eu';
}

export interface OptimizeInput {
  // The three worlds in any order (display names are fine)
  worlds: [WorldId, WorldId, WorldId];

  // Desired final ordering [first, second, third] using the same world IDs
  desiredOrder: [WorldId, WorldId, WorldId];

  // Current VP values before the remaining skirmishes are played
  currentVP: Record<WorldId, number>;

  // Remaining skirmishes to be assigned
  skirmishes: Skirmish[];

  // Optional: tie-breaker weights for "effort" (defaults shown below)
  effortWeights?: { first: number; second: number; third: number };
}

export interface PlacementPlan {
  skirmishId: number;
  time: Date;
  vpAwards: { first: number; second: number; third: number };
  placements: Record<WorldId, Placement>; // world -> 1 | 2 | 3
}

export interface OptimizeResult {
  achievable: boolean;
  message?: string;
  finalVP?: Record<WorldId, number>;
  margins?: { firstMinusSecond: number; secondMinusThird: number };
  plan?: PlacementPlan[];
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers and MILP model construction                               */
/* -------------------------------------------------------------------------- */

type Term = { name: string; coef: number };
type VPTriple = { first: number; second: number; third: number };

/**
 * Sanitizes a string for use in GLPK variable names.
 */
const sym = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');

/**
 * Binary decision variable name:
 *   y_{skirmishId}_{world}_{placement}
 * 1 if "world" takes placement (1/2/3) in skirmish, else 0
 */
const varName = (sid: number, w: WorldId, p: Placement) =>
  `y_${sid}_${sym(w)}_${p}`;

function coefFor(triple: VPTriple, p: Placement) {
  if (p === 1) return triple.first;
  if (p === 2) return triple.second;
  return triple.third;
}

/**
 * Builds the base assignment system:
 *   - variables: y[s,w,1..3] ∈ {0,1}
 *   - constraints:
 *       (a) each placement in a skirmish is assigned to exactly one world
 *       (b) each world gets exactly one placement in that skirmish
 * Returns:
 *   - list of binary variable names,
 *   - base constraints,
 *   - VP awards per skirmish ID for quick lookup.
 */
function buildAssignmentSystem(glpk: GLPK, input: OptimizeInput) {
  const binaries: string[] = [];
  const subjectTo: LP['subjectTo'] = [];
  const vpBySkirmishId: Record<number, VPTriple> = {};

  for (const s of input.skirmishes) {
    const tier = getVPTierForTime(s.startTime, s.region);
    vpBySkirmishId[s.id] = {
      first: tier.first,
      second: tier.second,
      third: tier.third,
    };

    // Create variables y[s,w,p]
    for (const w of input.worlds) {
      for (const p of [1, 2, 3] as const) {
        binaries.push(varName(s.id, w, p));
      }
    }

    // (a) Exactly one world gets each placement in skirmish s
    for (const p of [1, 2, 3] as const) {
      const vars: Term[] = input.worlds.map((w) => ({
        name: varName(s.id, w, p),
        coef: 1,
      }));
      subjectTo.push({
        name: `s${s.id}_placement_${p}`,
        vars,
        bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 },
      });
    }

    // (b) Each world receives exactly one placement in skirmish s
    for (const w of input.worlds) {
      const vars: Term[] = ([1, 2, 3] as const).map((p) => ({
        name: varName(s.id, w, p),
        coef: 1,
      }));
      subjectTo.push({
        name: `s${s.id}_world_${sym(w)}`,
        vars,
        bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 },
      });
    }
  }

  return { binaries, subjectTo, vpBySkirmishId };
}

/**
 * Produces linear expression terms for Σ vp(s,p) * (y[s,wa,p] - y[s,wb,p]).
 * This is used to express pairwise VP differences between two worlds across
 * all remaining skirmishes.
 */
function diffTermsForWorlds(
  input: OptimizeInput,
  vpBySkirmishId: Record<number, VPTriple>,
  wa: WorldId,
  wb: WorldId
): Term[] {
  const terms: Term[] = [];
  for (const s of input.skirmishes) {
    const vp = vpBySkirmishId[s.id];
    for (const p of [1, 2, 3] as const) {
      const c = coefFor(vp, p);
      terms.push({ name: varName(s.id, wa, p), coef: c });
      terms.push({ name: varName(s.id, wb, p), coef: -c });
    }
  }
  return terms;
}

/**
 * Helper to build an LP object from parts.
 */
function makeLP(
  glpk: GLPK,
  name: string,
  binaries: string[],
  baseSubjectTo: LP['subjectTo'],
  objectiveVars: Term[],
  direction: number,
  extraSubjectTo: LP['subjectTo'] = []
): LP {
  return {
    name,
    objective: { direction, name: `${name}_obj`, vars: objectiveVars },
    subjectTo: [...baseSubjectTo, ...extraSubjectTo],
    binaries,
  };
}

/* -------------------------------------------------------------------------- */
/*  Optimizer: lexicographic multi-objective solve                             */
/* -------------------------------------------------------------------------- */

/**
 * optimizeWvW()
 *
 * Stage 1: minimize gap12 = VP(first) - VP(second)
 * Stage 2: (fix gap12 to optimal) minimize gap23 = VP(second) - VP(third)
 * Stage 3: (fix both gaps) minimize "effort":
 *          cost(first)=2, cost(second)=1, cost(third)=0 by default
 *
 * Strict final order is enforced with integer-safe constraints:
 *   VP(first) ≥ VP(second) + 1
 *   VP(second) ≥ VP(third) + 1
 * The +1 is safe because all VP awards are integers.
 */
export async function optimizeWvW(
  input: OptimizeInput
): Promise<OptimizeResult> {
  const glpk = await GLPKFactory();

  const [firstW, secondW, thirdW] = input.desiredOrder;
  const effort = input.effortWeights ?? { first: 2, second: 1, third: 0 };

  // Build the assignment (variables + constraints) once.
  const { binaries, subjectTo, vpBySkirmishId } = buildAssignmentSystem(
    glpk,
    input
  );

  // Current VP constants (already earned)
  const baseFirst = input.currentVP[firstW] ?? 0;
  const baseSecond = input.currentVP[secondW] ?? 0;
  const baseThird = input.currentVP[thirdW] ?? 0;

  // Linear expressions for pairwise variable parts:
  const diff12 = diffTermsForWorlds(input, vpBySkirmishId, firstW, secondW);
  const diff23 = diffTermsForWorlds(input, vpBySkirmishId, secondW, thirdW);

  // Enforce strict final ordering with integer-safe ≥ constraints.
  // Example: VP(first) - VP(second) ≥ 1, but we separate constants vs vars:
  //   Σ (var part) ≥ 1 + (baseSecond - baseFirst)
  const rankConstraints: LP['subjectTo'] = [
    {
      name: 'rank_first_over_second',
      vars: diff12,
      // Some typings require 'ub' even for GLP_LO (ignored by solver).
      bnds: { type: glpk.GLP_LO, lb: 1 + (baseSecond - baseFirst), ub: 0 },
    },
    {
      name: 'rank_second_over_third',
      vars: diff23,
      bnds: { type: glpk.GLP_LO, lb: 1 + (baseThird - baseSecond), ub: 0 },
    },
  ];

  /* ---------------------------- Stage 1: minimize A-B -------------------- */

  const lp1 = makeLP(
    glpk,
    'stage1_min_gap12',
    binaries,
    [...subjectTo, ...rankConstraints],
    diff12,
    glpk.GLP_MIN
  );

  // Avoid passing options to dodge msgLevel/msglev typing differences
  const res1 = glpk.solve(lp1);

  if (res1.result.status !== glpk.GLP_OPT) {
    return {
      achievable: false,
      message: 'No feasible assignment meets the desired final order.',
    };
  }

  // This is the optimal value of the variable-only part.
  // The true margin is (baseFirst - baseSecond) + gap12VarPart.
  const gap12VarPart = res1.result.z;

  /* ---------------------------- Stage 2: minimize B-C -------------------- */

  // Fix stage-1 optimum and minimize gap23.
  const fixGap12: LP['subjectTo'] = [
    {
      name: 'fix_gap12_opt',
      vars: diff12,
      bnds: { type: glpk.GLP_FX, lb: gap12VarPart, ub: gap12VarPart },
    },
  ];

  const lp2 = makeLP(
    glpk,
    'stage2_min_gap23',
    binaries,
    [...subjectTo, ...rankConstraints, ...fixGap12],
    diff23,
    glpk.GLP_MIN
  );
  const res2 = glpk.solve(lp2);

  if (res2.result.status !== glpk.GLP_OPT) {
    return {
      achievable: false,
      message:
        'Infeasible after fixing the minimum 1st–2nd gap. Check inputs.',
    };
  }

  const gap23VarPart = res2.result.z;

  /* -------------------------- Stage 3: minimize effort ------------------- */

  // With both margins fixed at their minimum values, push placements "down"
  // where possible to reduce overall effort without changing the margins.
  const effortTerms: Term[] = [];
  for (const s of input.skirmishes) {
    for (const w of input.worlds) {
      effortTerms.push({ name: varName(s.id, w, 1), coef: effort.first });
      effortTerms.push({ name: varName(s.id, w, 2), coef: effort.second });
      if (effort.third !== 0) {
        effortTerms.push({ name: varName(s.id, w, 3), coef: effort.third });
      }
    }
  }

  const fixGap23: LP['subjectTo'] = [
    {
      name: 'fix_gap23_opt',
      vars: diff23,
      bnds: { type: glpk.GLP_FX, lb: gap23VarPart, ub: gap23VarPart },
    },
  ];

  const lp3 = makeLP(
    glpk,
    'stage3_min_effort',
    binaries,
    [...subjectTo, ...rankConstraints, ...fixGap12, ...fixGap23],
    effortTerms,
    glpk.GLP_MIN
  );
  const res3 = glpk.solve(lp3);

  if (res3.result.status !== glpk.GLP_OPT) {
    return {
      achievable: false,
      message: 'Unexpected infeasibility while minimizing effort.',
    };
  }

  // Cross-version safe accessor: result.vars[var] may be number or { value }.
  const varVal = (name: string): number => {
    const v = (res3 as any).result?.vars?.[name];
    if (typeof v === 'number') return v;
    if (v && typeof v.value === 'number') return v.value;
    return 0;
  };

  const pick = (name: string) => (varVal(name) > 0.5 ? 1 : 0);

  // Build final VP totals and a per-skirmish plan from chosen placements.
  const finalVP: Record<WorldId, number> = Object.fromEntries(
    input.worlds.map((w) => [w, input.currentVP[w] ?? 0])
  );

  const plan: PlacementPlan[] = [];

  for (const s of input.skirmishes) {
    const vp = vpBySkirmishId[s.id];
    const placements: Record<WorldId, Placement> = {
      [input.worlds[0]]: 3,
      [input.worlds[1]]: 3,
      [input.worlds[2]]: 3,
    };

    for (const w of input.worlds) {
      let chosen: Placement = 3;
      if (pick(varName(s.id, w, 1))) chosen = 1;
      else if (pick(varName(s.id, w, 2))) chosen = 2;
      else chosen = 3;

      placements[w] = chosen;

      if (chosen === 1) finalVP[w] += vp.first;
      else if (chosen === 2) finalVP[w] += vp.second;
      else finalVP[w] += vp.third;
    }

    plan.push({
      skirmishId: s.id,
      time: s.startTime,
      vpAwards: { ...vp },
      placements,
    });
  }

  return {
    achievable: true,
    finalVP,
    margins: {
      firstMinusSecond: finalVP[firstW] - finalVP[secondW],
      secondMinusThird: finalVP[secondW] - finalVP[thirdW],
    },
    plan,
  };
}

/* -------------------------------------------------------------------------- */
/*  Convenience: build a skirmish array for a continuous block                */
/* -------------------------------------------------------------------------- */

/**
 * Builds a simple sequence of skirmishes spaced 2 hours apart in UTC.
 * Useful for wiring up the UI when you know:
 *   - the first remaining skirmish index,
 *   - how many remain,
 *   - the UTC start time of the first remaining skirmish,
 *   - and the region ("na" or "eu").
 */
export function buildSkirmishes(
  startId: number,
  count: number,
  firstStartUTC: Date,
  region: 'na' | 'eu'
): Skirmish[] {
  return Array.from({ length: count }, (_, i) => {
    const id = startId + i;
    const dt = new Date(firstStartUTC.getTime());
    dt.setUTCHours(dt.getUTCHours() + 2 * i);
    return { id, startTime: dt, region };
  });
}
```

### Why this fixes the two issues

- Excessive 1st/2nd gap: Stage 1 + Stage 2 minimize both 1st–2nd and
  2nd–3rd gaps individually, so 1st cannot “overwork” relative to 2nd.
- “Impossible” flip detection: The MILP searches all assignments. If a flip is
  mathematically possible under the schedule, it will find it and produce a
  concrete minimal plan. If not, it returns achievable: false.


## 5) UI integration (example)

Hook this into your existing “Scenario Planner” button.

```ts
// ui/calculateScenario.ts
import {
  optimizeWvW,
  buildSkirmishes,
  WorldId,
  OptimizeResult,
} from '@/lib/wvw-optimizer';

export async function calculateScenarioFromUI(): Promise<OptimizeResult> {
  // Gather from UI state
  const worlds: [WorldId, WorldId, WorldId] = [
    'Lutgardis Conservatory',
    "Dwayna's Temple",
    'Yohlon Haven',
  ];

  const desired: [WorldId, WorldId, WorldId] = [
    "Dwayna's Temple",
    'Lutgardis Conservatory',
    'Yohlon Haven',
  ];

  const currentVP = {
    'Lutgardis Conservatory': 1135,
    "Dwayna's Temple": 888,
    'Yohlon Haven': 829,
  };

  // Example: 37 remaining NA skirmishes starting at a given UTC time
  const startId = 48;
  const firstStartUTC = new Date(Date.UTC(2025, 10, 18, 0, 0, 0));
  const skirmishes = buildSkirmishes(startId, 37, firstStartUTC, 'na');

  // Run optimizer
  const result = await optimizeWvW({
    worlds,
    desiredOrder: desired,
    currentVP,
    skirmishes,
    // optional effort weights:
    // effortWeights: { first: 2, second: 1, third: 0 },
  });

  return result;
}
```

Display:
- Projected Final VP per world (result.finalVP)
- Margins (result.margins)
- “Minimum Effort Scenario” table using result.plan:
  - Columns: Skirmish, Time, VP Awards (1st/2nd/3rd), World A placement,
    World B placement, World C placement
- If achievable is false, show the red error banner with result.message


## 6) Acceptance criteria

- Given any desiredOrder of the three worlds, the solver returns either:
  - achievable: true and a concrete plan, or
  - achievable: false with a clear message
- When achievable, the final VP values satisfy:
  - VP(first) > VP(second) > VP(third)
  - The 1st–2nd gap is minimal across all feasible assignments
  - Given that minimum 1st–2nd gap, the 2nd–3rd gap is also minimal
  - Among solutions with those minimal gaps, the plan minimizes “effort”
- The “Minimum Effort Scenario” table renders placements per skirmish exactly
  once per place and per world (no duplicates or omissions).
- Performance: For up to 100 remaining skirmishes, solve time in a modern
  browser is typically under 100 ms on desktop; under 1 s on low‑end devices.


## 7) Developer notes and options

- Ties and strictness
  - Strict inequalities are enforced with a +1 margin, which is correct because
    VP awards are integers.
- Variable naming
  - Variable names sanitize world strings to GLPK‑safe identifiers.
- Adjusting “effort”
  - You can pass different effort weights per placement via `effortWeights`
    if UX wants a different tie‑breaker.
- Reproducibility
  - GLPK is deterministic for the same input; useful for debugging.
- Extensibility
  - Lock a world’s placement for specific skirmishes by adding constraints:
    y[s,w,p_fixed] = 1.
  - For “must not take 1st in skirmish X,” add: y[s,w,1] = 0.


## 8) Quick test (manual)

You can temporarily run a test from the browser console or a dev script:

```ts
import { optimizeWvW, buildSkirmishes } from '@/lib/wvw-optimizer';

(async () => {
  const worlds = [
    'Lutgardis Conservatory',
    "Dwayna's Temple",
    'Yohlon Haven',
  ] as const;

  const desired = [
    "Dwayna's Temple",
    'Lutgardis Conservatory',
    'Yohlon Haven',
  ] as const;

  const currentVP = {
    'Lutgardis Conservatory': 1135,
    "Dwayna's Temple": 888,
    'Yohlon Haven': 829,
  };

  const skirmishes = buildSkirmishes(
    48,
    37,
    new Date(Date.UTC(2025, 10, 18, 0, 0, 0)),
    'na'
  );

  console.time('opt');
  const res = await optimizeWvW({
    worlds: worlds as any,
    desiredOrder: desired as any,
    currentVP,
    skirmishes,
  });
  console.timeEnd('opt');
  console.log(res);
})();
```


## 9) Troubleshooting

- If the solver reports achievable: false but you expect feasibility:
  - Verify region per skirmish and UTC hours are correct
  - Verify currentVP totals reflect the state at the moment of calculation
  - Ensure there is no off‑by‑one in skirmish count or start times
- If bundling fails to load the WASM:
  - Most bundlers work out‑of‑the‑box. If needed, set `resolve.fullySpecified:
    false` for glpk.js or configure `asset/inline` for `.wasm` in Webpack/Vite.


---

Deliverable summary:
- Add lib/wvw-optimizer.ts (above)
- Wire it to the “Calculate Scenario” button
- Render result.plan as the “Minimum Effort Scenario” table and show
  projected final VP/margins.