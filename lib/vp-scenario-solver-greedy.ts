/**
 * VP Scenario Solver using Deterministic Greedy Solver
 *
 * Strategy:
 * Use only the deterministic greedy solver (GLPK removed as it never works)
 *
 * The deterministic solver is reliable for edge cases where the solution
 * space is narrow and provides minimum-effort solutions.
 */

import {
  WvWHybridSolver,
  type WorldState,
  type HybridSolverResult,
} from './vp-scenario-solver-random';

type WorldId = 'red' | 'blue' | 'green';

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
  solver?: 'random' | 'deterministic'; // Which solver method found the solution
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
 * Main solver entry point - uses only deterministic greedy solver
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

  // Determine region from skirmish data
  const region = determineRegion(remainingSkirmishes);

  const desiredOrder: [WorldId, WorldId, WorldId] = [
    desiredOutcome.first,
    desiredOutcome.second,
    desiredOutcome.third,
  ];

  // Use deterministic solver
  try {
    console.log('[Solver] Running deterministic greedy solver...');
    const result = tryDeterministicSolver(input, currentVP, remainingSkirmishes, desiredOrder, region);

    if (result.isPossible) {
      console.log('[Solver] Solution found');
    } else {
      console.log('[Solver] No solution possible');
    }

    return result;
  } catch (error) {
    console.error('[Solver] Deterministic solver error:', error);
    return {
      isPossible: false,
      reason: `Solver error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Run the deterministic greedy solver
 */
function tryDeterministicSolver(
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
  // Build world states for deterministic solver
  const worlds: WorldState[] = [
    { id: 'red', color: 'red', currentVP: currentVP.red },
    { id: 'blue', color: 'blue', currentVP: currentVP.blue },
    { id: 'green', color: 'green', currentVP: currentVP.green },
  ];

  // Extract skirmish times
  const skirmishTimes = remainingSkirmishes.map((s) => s.startTime);

  // Create and run deterministic solver
  const solver = new WvWHybridSolver(
    worlds,
    skirmishTimes,
    desiredOrder,
    region
  );

  const result: HybridSolverResult = solver.solve();

  if (!result.achievable) {
    return {
      isPossible: false,
      reason: 'The desired outcome is not mathematically achievable with the remaining skirmishes.',
    };
  }

  console.log(`[Solver] Found solution (${result.method}, ${result.iterations} iterations)`);

  // Convert result to UI format
  const requiredPlacements = result.scenario!.map((s) => {
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
    solver: result.method === 'random' ? 'random' : 'deterministic',
  };
}
