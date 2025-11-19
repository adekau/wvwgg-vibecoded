/**
 * VP Scenario Solver - Orchestrates multiple solving strategies
 *
 * Strategy Waterfall (in order of preference):
 * 1. DFS Solver (Deterministic with Branch & Bound) - Guarantees finding solution if it exists
 * 2. Random Search (Hybrid Solver) - Fast exploration, good for easy scenarios
 * 3. Greedy Solver (Hybrid Solver) - Fallback for when random fails
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
  solver?: 'dfs' | 'random' | 'greedy'; // Which solver method found the solution
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
 * Main solver entry point - tries solvers in order: DFS → Random → Greedy
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

  // SOLVER 1: Try DFS solver first (deterministic, guaranteed solution if exists)
  try {
    console.log('[Solver] Trying DFS solver (deterministic with branch & bound)...');
    const dfsResult = tryDFSSolver(input, currentVP, remainingSkirmishes, desiredOrder, region);

    if (dfsResult.isPossible) {
      console.log('[Solver] DFS solver found solution');
      return dfsResult;
    }
    console.log('[Solver] DFS solver proved impossible, skipping other solvers');
    return dfsResult; // If DFS says impossible, it's mathematically impossible
  } catch (error) {
    console.error('[Solver] DFS solver error:', error);
  }

  // SOLVER 2: Try random search solver (fast, good for easy scenarios)
  try {
    console.log('[Solver] Trying random search solver...');
    const randomResult = tryRandomSolver(input, currentVP, remainingSkirmishes, desiredOrder, region);

    if (randomResult.isPossible) {
      console.log('[Solver] Random solver found solution');
      return randomResult;
    }
  } catch (error) {
    console.error('[Solver] Random solver error:', error);
  }

  // SOLVER 3: Try greedy solver as fallback
  try {
    console.log('[Solver] Trying greedy solver...');
    const greedyResult = tryGreedySolver(input, currentVP, remainingSkirmishes, desiredOrder, region);

    if (greedyResult.isPossible) {
      console.log('[Solver] Greedy solver found solution');
    } else {
      console.log('[Solver] All solvers failed - no solution found');
    }

    return greedyResult;
  } catch (error) {
    console.error('[Solver] Greedy solver error:', error);
    return {
      isPossible: false,
      reason: `All solvers failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
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
