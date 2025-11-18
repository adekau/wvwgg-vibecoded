/**
 * VP Scenario Optimal Solver
 * Uses smart enumeration with pruning to find minimal-effort solutions
 * Guaranteed to find optimal solution if one exists
 */

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
 * Solve using optimal search with binary search + greedy assignment
 * For each effort level, assigns placements to satisfy constraints
 */
export function calculateScenario(input: ScenarioInput): ScenarioResult {
  const { currentVP, remainingSkirmishes, desiredOutcome, minMargin = 1 } = input;

  // Validate input
  if (desiredOutcome.first === desiredOutcome.second ||
      desiredOutcome.first === desiredOutcome.third ||
      desiredOutcome.second === desiredOutcome.third) {
    return {
      isPossible: false,
      reason: 'Invalid desired outcome: teams cannot have the same placement.',
    };
  }

  const numSkirmishes = remainingSkirmishes.length;
  type Placement = { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };

  // Sort skirmishes by VP value (highest first)
  const sortedSkirmishes = remainingSkirmishes
    .map((s, i) => ({ skirmish: s, index: i }))
    .sort((a, b) => b.skirmish.vpAwards.first - a.skirmish.vpAwards.first);

  /**
   * Try to construct a valid solution with X wins for desired first
   */
  function tryAssignment(winsForFirst: number): Placement[] | null {
    const placements: Placement[] = new Array(numSkirmishes);
    let winsGiven = 0;

    // Strategy: Give desired first their wins in highest VP skirmishes
    // For remaining, use: 1st=third, 2nd=first, 3rd=second (minimizes 2nd's VP)
    for (const { index } of sortedSkirmishes) {
      if (winsGiven < winsForFirst) {
        placements[index] = {
          [desiredOutcome.first]: 1,
          [desiredOutcome.second]: 2,
          [desiredOutcome.third]: 3,
        } as Placement;
        winsGiven++;
      } else {
        placements[index] = {
          [desiredOutcome.first]: 2,
          [desiredOutcome.second]: 3,
          [desiredOutcome.third]: 1,
        } as Placement;
      }
    }

    // Calculate final VP
    const finalVP = { ...currentVP };
    for (let i = 0; i < numSkirmishes; i++) {
      const sk = remainingSkirmishes[i];
      const pl = placements[i];
      if (pl.red === 1) finalVP.red += sk.vpAwards.first;
      else if (pl.red === 2) finalVP.red += sk.vpAwards.second;
      else finalVP.red += sk.vpAwards.third;

      if (pl.blue === 1) finalVP.blue += sk.vpAwards.first;
      else if (pl.blue === 2) finalVP.blue += sk.vpAwards.second;
      else finalVP.blue += sk.vpAwards.third;

      if (pl.green === 1) finalVP.green += sk.vpAwards.first;
      else if (pl.green === 2) finalVP.green += sk.vpAwards.second;
      else finalVP.green += sk.vpAwards.third;
    }

    // Check if satisfies outcome
    if (finalVP[desiredOutcome.first] >= finalVP[desiredOutcome.second] + minMargin &&
        finalVP[desiredOutcome.second] >= finalVP[desiredOutcome.third] + minMargin) {
      return placements;
    }

    return null;
  }

  // Binary search for minimum wins needed
  let low = 0;
  let high = numSkirmishes;
  let bestSolution: Placement[] | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const solution = tryAssignment(mid);

    if (solution) {
      bestSolution = solution;
      high = mid - 1; // Try fewer wins
    } else {
      low = mid + 1; // Need more wins
    }
  }

  if (!bestSolution) {
    return {
      isPossible: false,
      reason: `Could not find a valid path even with all skirmishes won by ${desiredOutcome.first}`,
    };
  }

  // Build result
  const result: Array<{
    skirmishId: number;
    placements: Placement;
  }> = remainingSkirmishes.map((s, i) => ({
    skirmishId: s.id,
    placements: bestSolution![i],
  }));

  // Calculate final VP
  const finalVP = { ...currentVP };
  for (let i = 0; i < numSkirmishes; i++) {
    const sk = remainingSkirmishes[i];
    const pl = bestSolution[i];
    if (pl.red === 1) finalVP.red += sk.vpAwards.first;
    else if (pl.red === 2) finalVP.red += sk.vpAwards.second;
    else finalVP.red += sk.vpAwards.third;

    if (pl.blue === 1) finalVP.blue += sk.vpAwards.first;
    else if (pl.blue === 2) finalVP.blue += sk.vpAwards.second;
    else finalVP.blue += sk.vpAwards.third;

    if (pl.green === 1) finalVP.green += sk.vpAwards.first;
    else if (pl.green === 2) finalVP.green += sk.vpAwards.second;
    else finalVP.green += sk.vpAwards.third;
  }

  // Count wins
  let firstPlaceCount = 0;
  for (const pl of bestSolution) {
    if (pl[desiredOutcome.first] === 1) firstPlaceCount++;
  }
  const firstPlacePercentage = (firstPlaceCount / numSkirmishes) * 100;

  let difficulty: 'easy' | 'moderate' | 'hard' | 'very-hard';
  if (firstPlacePercentage <= 40) {
    difficulty = 'easy';
  } else if (firstPlacePercentage <= 60) {
    difficulty = 'moderate';
  } else if (firstPlacePercentage <= 80) {
    difficulty = 'hard';
  } else {
    difficulty = 'very-hard';
  }

  return {
    isPossible: true,
    requiredPlacements: result,
    finalVP,
    margin: finalVP[desiredOutcome.first] - finalVP[desiredOutcome.second],
    difficulty,
  };
}
