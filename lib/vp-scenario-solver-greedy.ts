/**
 * VP Scenario Solver - Orchestrates multiple solving strategies
 *
 * Strategy Waterfall (in order of preference):
 * 1. DFS Solver (Deterministic with Branch & Bound) - Guarantees finding solution if it exists
 * 2. Random Search (Hybrid Solver) - Fast exploration, good for easy scenarios
 * 3. Greedy Solver (Hybrid Solver) - Deterministic greedy approach
 * 4. Obvious Solver - Last resort, tries simple patterns (e.g., "1st wins all 1st place")
 *
 * Each solver is tried in sequence until one finds a solution.
 */

import { DeterministicDFSSolver } from './vp-scenario-solver-dfs'
import {
  WvWHybridSolver,
  type WorldState,
  type HybridSolverResult,
} from './vp-scenario-solver-random'

type WorldId = 'red' | 'blue' | 'green'

export interface ScenarioInput {
  currentVP: { red: number; blue: number; green: number };
  remainingSkirmishes: Array<{
    id: number;
    startTime: Date;
    endTime: Date;
    vpAwards: { first: number; second: number; third: number };
  }>;
  desiredOutcome: {
    first: 'red' | 'blue' | 'green';
    second: 'red' | 'blue' | 'green';
    third: 'red' | 'blue' | 'green';
  };
  minMargin?: number;
}

export interface SolverAttempt {
  name: string;
  attempted: boolean;
  success: boolean;
  iterations?: number;
  duration?: number; // milliseconds
  reason?: string;
}

export interface ScenarioResult {
  isPossible: boolean;
  requiredPlacements?: Array<{
    skirmishId: number;
    placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };
  }>;
  finalVP?: { red: number; blue: number; green: number };
  margin?: number;
  reason?: string;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'very-hard';
  solver?: 'obvious' | 'dfs' | 'random' | 'greedy'; // Which solver method found the solution
  solverAttempts?: SolverAttempt[]; // Detailed information about all solver attempts
}

/**
 * Get the current standings based on VP
 */
export function getCurrentStandings(vp: { red: number; blue: number; green: number }): {
  first: 'red' | 'blue' | 'green';
  second: 'red' | 'blue' | 'green';
  third: 'red' | 'blue' | 'green';
} {
  const rankings = [
    { color: 'red' as const, vp: vp.red },
    { color: 'blue' as const, vp: vp.blue },
    { color: 'green' as const, vp: vp.green },
  ].sort((a, b) => b.vp - a.vp);

  return {
    first: rankings[0].color,
    second: rankings[1].color,
    third: rankings[2].color,
  };
}

/**
 * Determine region based on skirmish times
 * NA skirmishes typically have higher VP awards during their peak times (00:00-04:00 UTC)
 */
function determineRegion(skirmishes: Array<{ startTime: Date; vpAwards: { first: number } }>): 'na' | 'eu' {
  if (skirmishes.length === 0) return 'na'; // Default

  // Check first skirmish's time and VP awards
  const firstSkirmish = skirmishes[0];
  const utcHour = firstSkirmish.startTime.getUTCHours();
  const vpFirst = firstSkirmish.vpAwards.first;

  // NA peak is 00:00-04:00 UTC with 43 VP for first
  // EU peak is 18:00-22:00 UTC with 51 VP for first
  if (utcHour >= 0 && utcHour < 4 && vpFirst >= 43) {
    return 'na';
  } else if (utcHour >= 18 && utcHour < 22 && vpFirst >= 51) {
    return 'eu';
  }

  // Default to NA if unsure
  return 'na';
}

/**
 * Calculate difficulty based on how many first-place finishes are needed
 */
function calculateDifficulty(
  placements: Array<{ placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 } }>,
  desiredFirst: WorldId
): 'easy' | 'moderate' | 'hard' | 'very-hard' {
  let firstPlaceCount = 0;
  for (const p of placements) {
    if (p.placements[desiredFirst] === 1) firstPlaceCount++;
  }

  const firstPlacePercentage = (firstPlaceCount / placements.length) * 100;

  if (firstPlacePercentage <= 40) {
    return 'easy';
  } else if (firstPlacePercentage <= 60) {
    return 'moderate';
  } else if (firstPlacePercentage <= 80) {
    return 'hard';
  } else {
    return 'very-hard';
  }
}

/**
 * SOLVER 0: Obvious Patterns Solver
 * Tries simple patterns like "1st wins all 1st place", "2nd wins all 2nd place", etc.
 */
function tryObviousSolver(
  input: ScenarioInput,
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{
    id: number;
    startTime: Date;
    endTime: Date;
    vpAwards: { first: number; second: number; third: number };
  }>,
  desiredOrder: [WorldId, WorldId, WorldId]
): { result: ScenarioResult | null; iterations: number; duration: number } {
  const startTime = performance.now();

  // Define obvious patterns to try
  // Format: [desiredFirst gets rank X, desiredSecond gets rank Y, desiredThird gets rank Z]
  const patterns = [
    { name: '1st→1st, 2nd→2nd, 3rd→3rd', ranks: [1, 2, 3] as const },
    { name: '1st→1st, 2nd→3rd, 3rd→2nd', ranks: [1, 3, 2] as const },
    { name: '1st→2nd, 2nd→1st, 3rd→3rd', ranks: [2, 1, 3] as const },
    { name: '1st→2nd, 2nd→3rd, 3rd→1st', ranks: [2, 3, 1] as const },
    { name: '1st→3rd, 2nd→1st, 3rd→2nd', ranks: [3, 1, 2] as const },
    { name: '1st→3rd, 2nd→2nd, 3rd→1st', ranks: [3, 2, 1] as const },
  ];

  for (const pattern of patterns) {
    // Calculate final VP if we follow this pattern for all remaining skirmishes
    const vp = { ...currentVP };

    for (const skirmish of remainingSkirmishes) {
      const awards = skirmish.vpAwards;
      const vpByRank = [awards.first, awards.second, awards.third];

      // Award VP based on pattern
      vp[desiredOrder[0]] += vpByRank[pattern.ranks[0] - 1];
      vp[desiredOrder[1]] += vpByRank[pattern.ranks[1] - 1];
      vp[desiredOrder[2]] += vpByRank[pattern.ranks[2] - 1];
    }

    // Check if this achieves the desired outcome
    if (vp[desiredOrder[0]] > vp[desiredOrder[1]] && vp[desiredOrder[1]] > vp[desiredOrder[2]]) {
      console.log(`[Obvious Solver] Found solution with pattern: ${pattern.name}`);

      // Build the placements array
      const requiredPlacements = remainingSkirmishes.map((skirmish) => {
        const placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 } = {
          red: 3,
          blue: 3,
          green: 3,
        };

        placements[desiredOrder[0]] = pattern.ranks[0];
        placements[desiredOrder[1]] = pattern.ranks[1];
        placements[desiredOrder[2]] = pattern.ranks[2];

        return {
          skirmishId: skirmish.id,
          placements,
        };
      });

      const difficulty = calculateDifficulty(requiredPlacements, input.desiredOutcome.first);
      const margin = vp[desiredOrder[0]] - vp[desiredOrder[1]];

      return {
        result: {
          isPossible: true,
          requiredPlacements,
          finalVP: vp,
          margin,
          difficulty,
          solver: 'obvious',
        },
        iterations: patterns.indexOf(pattern) + 1,
        duration: performance.now() - startTime,
      };
    }
  }

  return {
    result: null,
    iterations: patterns.length,
    duration: performance.now() - startTime,
  };
}

/**
 * Main solver entry point - tries solvers in order: DFS → Random → Greedy → Obvious
 */
export async function calculateScenario(input: ScenarioInput): Promise<ScenarioResult> {
  const { currentVP, remainingSkirmishes, desiredOutcome } = input;

  // Validate input
  if (desiredOutcome.first === desiredOutcome.second ||
      desiredOutcome.first === desiredOutcome.third ||
      desiredOutcome.second === desiredOutcome.third) {
    return {
      isPossible: false,
      reason: 'Invalid desired outcome: teams cannot have the same placement.',
    };
  }

  if (remainingSkirmishes.length === 0) {
    return {
      isPossible: false,
      reason: 'No remaining skirmishes to optimize.',
    };
  }

  // Safety check: limit complexity for very large scenarios
  if (remainingSkirmishes.length > 50) {
    return {
      isPossible: false,
      reason: 'Too many remaining skirmishes (max 50). This scenario is too complex to analyze.',
    };
  }

  // Determine region from skirmish data
  const region = determineRegion(remainingSkirmishes);

  const desiredOrder: [WorldId, WorldId, WorldId] = [
    desiredOutcome.first,
    desiredOutcome.second,
    desiredOutcome.third,
  ];

  // Track all solver attempts
  const solverAttempts: SolverAttempt[] = [];

  // SOLVER 1: Try DFS solver first (deterministic, guaranteed solution if exists)
  try {
    console.log('[Solver] Trying DFS solver (deterministic with branch & bound)...');
    const startTime = performance.now();
    const dfsResult = tryDFSSolver(input, currentVP, remainingSkirmishes, desiredOrder, region);
    const duration = performance.now() - startTime;

    solverAttempts.push({
      name: 'DFS (Branch & Bound)',
      attempted: true,
      success: dfsResult.isPossible,
      duration,
      reason: dfsResult.isPossible ? undefined : 'Proved mathematically impossible',
    });

    if (dfsResult.isPossible) {
      console.log('[Solver] DFS solver found solution');
      return { ...dfsResult, solverAttempts };
    }
    console.log('[Solver] DFS solver proved impossible, skipping other solvers');
    return { ...dfsResult, solverAttempts }; // If DFS says impossible, it's mathematically impossible
  } catch (error) {
    console.error('[Solver] DFS solver error:', error);
    solverAttempts.push({
      name: 'DFS (Branch & Bound)',
      attempted: true,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // SOLVER 2: Try random search solver (fast, good for easy scenarios)
  try {
    console.log('[Solver] Trying random search solver...');
    const startTime = performance.now();
    const randomResult = tryRandomSolver(input, currentVP, remainingSkirmishes, desiredOrder, region);
    const duration = performance.now() - startTime;

    solverAttempts.push({
      name: 'Random Search',
      attempted: true,
      success: randomResult.isPossible,
      duration,
    });

    if (randomResult.isPossible) {
      console.log('[Solver] Random solver found solution');
      return { ...randomResult, solverAttempts };
    }
  } catch (error) {
    console.error('[Solver] Random solver error:', error);
    solverAttempts.push({
      name: 'Random Search',
      attempted: true,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // SOLVER 3: Try greedy solver
  try {
    console.log('[Solver] Trying greedy solver...');
    const startTime = performance.now();
    const greedyResult = tryGreedySolver(input, currentVP, remainingSkirmishes, desiredOrder, region);
    const duration = performance.now() - startTime;

    solverAttempts.push({
      name: 'Greedy Deterministic',
      attempted: true,
      success: greedyResult.isPossible,
      duration,
    });

    if (greedyResult.isPossible) {
      console.log('[Solver] Greedy solver found solution');
      return { ...greedyResult, solverAttempts };
    }
  } catch (error) {
    console.error('[Solver] Greedy solver error:', error);
    solverAttempts.push({
      name: 'Greedy Deterministic',
      attempted: true,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // SOLVER 4: Try obvious patterns as last resort
  try {
    console.log('[Solver] Trying obvious patterns solver (last resort)...');
    const { result, iterations, duration } = tryObviousSolver(input, currentVP, remainingSkirmishes, desiredOrder);

    solverAttempts.push({
      name: 'Obvious Patterns',
      attempted: true,
      success: result !== null,
      iterations,
      duration,
    });

    if (result) {
      console.log('[Solver] Obvious patterns solver found solution');
      return { ...result, solverAttempts };
    }
  } catch (error) {
    console.error('[Solver] Obvious patterns solver error:', error);
    solverAttempts.push({
      name: 'Obvious Patterns',
      attempted: true,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // All solvers failed
  console.log('[Solver] All solvers failed - no solution found');
  return {
    isPossible: false,
    reason: 'All solvers failed to find a solution.',
    solverAttempts,
  };
}

/**
 * Helper to convert solver result to UI format
 */
function convertToUIFormat(
  result: any,
  remainingSkirmishes: Array<{ id: number }>,
  input: ScenarioInput,
  solverName: 'dfs' | 'random' | 'greedy'
): ScenarioResult {
  const requiredPlacements = result.scenario!.map((s: any) => {
    const placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 } = {
      red: 3,
      blue: 3,
      green: 3,
    };

    // Map placements from world IDs to colors
    if (s.placements.first === 'red') placements.red = 1;
    else if (s.placements.first === 'blue') placements.blue = 1;
    else placements.green = 1;

    if (s.placements.second === 'red') placements.red = 2;
    else if (s.placements.second === 'blue') placements.blue = 2;
    else placements.green = 2;

    if (s.placements.third === 'red') placements.red = 3;
    else if (s.placements.third === 'blue') placements.blue = 3;
    else placements.green = 3;

    return {
      skirmishId: remainingSkirmishes[s.skirmishId - 1].id,
      placements,
    };
  });

  const finalVP = {
    red: result.finalStandings!.red,
    blue: result.finalStandings!.blue,
    green: result.finalStandings!.green,
  };

  const difficulty = calculateDifficulty(requiredPlacements, input.desiredOutcome.first);
  const firstVP = finalVP[input.desiredOutcome.first];
  const secondVP = finalVP[input.desiredOutcome.second];

  return {
    isPossible: true,
    requiredPlacements,
    finalVP,
    margin: firstVP - secondVP,
    difficulty,
    solver: solverName,
  };
}

/**
 * SOLVER 1: DFS with Branch & Bound (Guaranteed solution)
 */
function tryDFSSolver(
  input: ScenarioInput,
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{
    id: number;
    startTime: Date;
    endTime: Date;
    vpAwards: { first: number; second: number; third: number };
  }>,
  desiredOrder: [WorldId, WorldId, WorldId],
  region: 'na' | 'eu'
): ScenarioResult {
  // DFS solver uses simple WorldState without 'color' property
  const worlds = [
    { id: 'red', currentVP: currentVP.red },
    { id: 'blue', currentVP: currentVP.blue },
    { id: 'green', currentVP: currentVP.green },
  ];

  const skirmishTimes = remainingSkirmishes.map((s) => s.startTime);

  const solver = new DeterministicDFSSolver(worlds, skirmishTimes, desiredOrder, region);
  const result = solver.solve();

  if (!result.achievable) {
    return {
      isPossible: false,
      reason: 'DFS proved this outcome is mathematically impossible.',
    };
  }

  return convertToUIFormat(result, remainingSkirmishes, input, 'dfs');
}

/**
 * SOLVER 2: Random Search (Hybrid Solver)
 */
function tryRandomSolver(
  input: ScenarioInput,
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{
    id: number;
    startTime: Date;
    endTime: Date;
    vpAwards: { first: number; second: number; third: number };
  }>,
  desiredOrder: [WorldId, WorldId, WorldId],
  region: 'na' | 'eu'
): ScenarioResult {
  const worlds: WorldState[] = [
    { id: 'red', color: 'red', currentVP: currentVP.red },
    { id: 'blue', color: 'blue', currentVP: currentVP.blue },
    { id: 'green', color: 'green', currentVP: currentVP.green },
  ];

  const skirmishTimes = remainingSkirmishes.map((s) => s.startTime);

  // Use WvWHybridSolver which does random search first
  const solver = new WvWHybridSolver(worlds, skirmishTimes, desiredOrder, region);
  const result: HybridSolverResult = solver.solve();

  if (!result.achievable || result.method !== 'random') {
    return {
      isPossible: false,
      reason: 'Random search did not find a solution.',
    };
  }

  return convertToUIFormat(result, remainingSkirmishes, input, 'random');
}

/**
 * SOLVER 3: Greedy Solver (Hybrid Solver fallback)
 */
function tryGreedySolver(
  input: ScenarioInput,
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{
    id: number;
    startTime: Date;
    endTime: Date;
    vpAwards: { first: number; second: number; third: number };
  }>,
  desiredOrder: [WorldId, WorldId, WorldId],
  region: 'na' | 'eu'
): ScenarioResult {
  const worlds: WorldState[] = [
    { id: 'red', color: 'red', currentVP: currentVP.red },
    { id: 'blue', color: 'blue', currentVP: currentVP.blue },
    { id: 'green', color: 'green', currentVP: currentVP.green },
  ];

  const skirmishTimes = remainingSkirmishes.map((s) => s.startTime);

  // Use WvWHybridSolver which does greedy deterministic search
  const solver = new WvWHybridSolver(worlds, skirmishTimes, desiredOrder, region);
  const result: HybridSolverResult = solver.solve();

  if (!result.achievable || result.method === 'random') {
    return {
      isPossible: false,
      reason: 'Greedy solver did not find a solution.',
    };
  }

  return convertToUIFormat(result, remainingSkirmishes, input, 'greedy');
}
