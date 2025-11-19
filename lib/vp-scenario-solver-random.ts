/**
 * wvw-solver-hybrid.ts
 *
 * Deterministic Greedy Solver for WvW VP Scenario Planning
 *
 * This solver uses:
 * 1. Best-Case Initialization: Constructs the "Perfect Scenario" (desired 1st wins everything)
 * 2. Feasibility Check: Verifies if even the perfect scenario achieves the goal
 * 3. Relaxation (Minimum Effort): Works backward to find the minimum effort required
 *
 * This approach is more reliable than random search, especially for edge cases
 * where the solution space is very narrow.
 */

import { getVPTierForTime } from "./vp-tiers";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type WorldColor = 'red' | 'blue' | 'green';

export interface WorldState {
  id: string; // e.g., "Lutgardis Conservatory"
  color: WorldColor;
  currentVP: number;
}

export interface SkirmishInfo {
  id: number;
  startTime: Date;
  vpTier: { first: number; second: number; third: number };
}

export interface SkirmishResult {
  skirmishId: number;
  startTime: Date;
  placements: {
    first: string; // World ID
    second: string; // World ID
    third: string; // World ID
  };
  vpAwarded: {
    [worldId: string]: number;
  };
}

export interface HybridSolverResult {
  achievable: boolean;
  finalStandings?: { [worldId: string]: number };
  scenario?: SkirmishResult[];
  gap?: number;
  iterations?: number;
  method?: 'random' | 'deterministic' | 'impossible';
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

// There are 6 possible permutations of outcomes for 3 worlds
// Index: [WhoGets1stVP, WhoGets2ndVP, WhoGets3rdVP] (Indices refer to TargetOrder array)
const PERMUTATIONS = [
  [0, 1, 2], // 0: T1=1st, T2=2nd, T3=3rd (Standard Win)
  [0, 2, 1], // 1: T1=1st, T2=3rd, T3=2nd (Max Catchup vs T2) - THIS IS OUR MAX CATCHUP SEED
  [1, 0, 2], // 2: T1=2nd, T2=1st, T3=3rd
  [1, 2, 0], // 3: T1=3rd, T2=1st, T3=2nd
  [2, 0, 1], // 4: T1=2nd, T2=3rd, T3=1st
  [2, 1, 0], // 5: T1=3rd, T2=2nd, T3=1st
] as const;

/* -------------------------------------------------------------------------- */
/*  Deterministic Solver Class                                                */
/* -------------------------------------------------------------------------- */

export class WvWHybridSolver {
  private worlds: WorldState[];
  private skirmishes: SkirmishInfo[];
  private targetOrder: string[]; // [Desired1st_ID, Desired2nd_ID, Desired3rd_ID]
  private region: 'na' | 'eu';

  constructor(
    worlds: WorldState[],
    remainingSkirmishTimes: Date[],
    targetOrderIds: string[],
    region: 'na' | 'eu'
  ) {
    this.worlds = worlds;
    this.targetOrder = targetOrderIds;
    this.region = region;

    // Pre-calculate VP values for all future skirmishes
    this.skirmishes = remainingSkirmishTimes.map((time, index) => {
      const tier = getVPTierForTime(time, region);
      return {
        id: index,
        startTime: time,
        vpTier: { first: tier.first, second: tier.second, third: tier.third },
      };
    });
  }

  /**
   * Main entry point to calculate the scenario
   */
  public solve(): HybridSolverResult {
    const baseScores: Record<string, number> = {};
    this.worlds.forEach((w) => (baseScores[w.id] = w.currentVP));

    let bestResult: {
      assignments: number[];
      scores: Record<string, number>;
      gap: number;
      method: 'random' | 'deterministic';
    } | null = null;

    let totalIterations = 0;

    // --- Phase 1: Random Exploration (2000 attempts) ---
    console.log('[Solver] Phase 1: Random search...');
    for (let i = 0; i < 2000; i++) {
      totalIterations++;

      // Generate random assignments (0-5) for each skirmish
      const assignments = new Array(this.skirmishes.length)
        .fill(0)
        .map(() => Math.floor(Math.random() * 6));

      const res = this.evaluate(assignments, baseScores);

      if (res.valid) {
        // If valid, keep the one with the SMALLEST gap (Minimum Effort)
        if (!bestResult || res.gap < bestResult.gap) {
          bestResult = {
            assignments,
            scores: res.scores,
            gap: res.gap,
            method: 'random',
          };
        }
      }
    }

    // If random search found a solution, optimize it with hill climbing
    if (bestResult) {
      console.log('[Solver] Random search found solution, optimizing...');

      let currentAssignments = [...bestResult.assignments];
      let currentGap = bestResult.gap;
      let improved = true;

      // Hill climbing optimization
      while (improved) {
        improved = false;

        for (let s = 0; s < this.skirmishes.length; s++) {
          const originalPerm = currentAssignments[s];

          for (let p = 0; p < 6; p++) {
            if (p === originalPerm) continue;

            totalIterations++;
            currentAssignments[s] = p;
            const check = this.evaluate(currentAssignments, baseScores);

            if (check.valid && check.gap < currentGap) {
              currentGap = check.gap;
              improved = true;
            } else {
              currentAssignments[s] = originalPerm;
            }
          }
        }
      }

      const finalCalc = this.evaluate(currentAssignments, baseScores);
      return {
        achievable: true,
        gap: finalCalc.gap,
        finalStandings: finalCalc.scores,
        scenario: this.buildScenarioOutput(currentAssignments),
        iterations: totalIterations,
        method: bestResult.method,
      };
    }

    // --- Phase 2: Deterministic Greedy Fallback ---
    console.log('[Solver] Random search failed, trying deterministic greedy...');

    // Construct the "Maximum Catch-Up" Scenario
    // Target 1st gets 1st Place VP (winning everything)
    // Target 2nd gets 3rd Place VP (losing everything)
    // Target 3rd gets 2nd Place VP
    // This corresponds to Permutation Index 1: [0, 2, 1]
    const maxCatchupAssignments = this.skirmishes.map(() => 1);

    // Check if this "God Mode" scenario even works
    let greedyResult = this.evaluate(maxCatchupAssignments, baseScores);
    totalIterations++;

    if (!greedyResult.valid) {
      // Even with max effort, it's not achievable
      return {
        achievable: false,
        method: 'impossible',
        iterations: totalIterations
      };
    }

    // Relaxation Loop (Hill Climbing / Minimum Effort)
    let currentAssignments = [...maxCatchupAssignments];
    let currentGap = greedyResult.gap;
    let improved = true;

    while (improved) {
      improved = false;

      for (let s = 0; s < this.skirmishes.length; s++) {
        const originalPerm = currentAssignments[s];

        for (let p = 0; p < 6; p++) {
          if (p === originalPerm) continue;

          totalIterations++;
          currentAssignments[s] = p;
          const check = this.evaluate(currentAssignments, baseScores);

          if (check.valid && check.gap < currentGap) {
            currentGap = check.gap;
            greedyResult = check;
            improved = true;
          } else {
            currentAssignments[s] = originalPerm;
          }
        }

        if (improved) break;
      }
    }

    return {
      achievable: true,
      gap: greedyResult.gap,
      finalStandings: greedyResult.scores,
      scenario: this.buildScenarioOutput(currentAssignments),
      iterations: totalIterations,
      method: 'deterministic',
    };
  }

  /**
   * Calculates outcome.
   * Returns valid=true ONLY if Target1 > Target2 > Target3
   */
  private evaluate(
    assignments: number[],
    baseScores: Record<string, number>
  ): { valid: boolean; gap: number; scores: Record<string, number> } {
    const scores = { ...baseScores };

    const t1ID = this.targetOrder[0];
    const t2ID = this.targetOrder[1];
    const t3ID = this.targetOrder[2];

    for (let i = 0; i < assignments.length; i++) {
      const pIndex = assignments[i];
      const map = PERMUTATIONS[pIndex];
      const tier = this.skirmishes[i].vpTier;

      // map[0] is the index of the team in targetOrder who gets 1st place VP
      scores[this.targetOrder[map[0]]] += tier.first;
      scores[this.targetOrder[map[1]]] += tier.second;
      scores[this.targetOrder[map[2]]] += tier.third;
    }

    const s1 = scores[t1ID];
    const s2 = scores[t2ID];
    const s3 = scores[t3ID];

    // Validation: Strictly Greater Than
    if (s1 > s2 && s2 > s3) {
      // Gap Metric:
      // We want to minimize the distance between 1st and 2nd
      // AND the distance between 2nd and 3rd.
      const gap = (s1 - s2) + (s2 - s3);
      return { valid: true, gap, scores };
    }

    return { valid: false, gap: Infinity, scores };
  }

  private buildScenarioOutput(assignments: number[]): SkirmishResult[] {
    return assignments.map((pIndex, i) => {
      const map = PERMUTATIONS[pIndex];
      const tier = this.skirmishes[i].vpTier;

      // map[0] is the index in targetOrder that got 1st Place
      const firstHolder = this.targetOrder[map[0]];
      const secondHolder = this.targetOrder[map[1]];
      const thirdHolder = this.targetOrder[map[2]];

      return {
        skirmishId: i + 1, // display ID
        startTime: this.skirmishes[i].startTime,
        placements: {
          first: firstHolder,
          second: secondHolder,
          third: thirdHolder,
        },
        vpAwarded: {
          [firstHolder]: tier.first,
          [secondHolder]: tier.second,
          [thirdHolder]: tier.third,
        },
      };
    });
  }
}
