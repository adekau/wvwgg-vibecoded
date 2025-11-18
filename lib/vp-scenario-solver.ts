/**
 * VP Scenario Constraint Solver
 * Uses exhaustive search with pruning to find minimal effort solutions
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

type Placement = { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };

/**
 * Calculate final VP given placements
 */
function calculateFinalVP(
  currentVP: { red: number; blue: number; green: number },
  skirmishes: Array<{ vpAwards: { first: number; second: number; third: number } }>,
  placements: Placement[]
): { red: number; blue: number; green: number } {
  const vp = { ...currentVP };
  for (let i = 0; i < skirmishes.length; i++) {
    const sk = skirmishes[i];
    const pl = placements[i];
    for (const color of ['red', 'blue', 'green'] as const) {
      if (pl[color] === 1) vp[color] += sk.vpAwards.first;
      else if (pl[color] === 2) vp[color] += sk.vpAwards.second;
      else vp[color] += sk.vpAwards.third;
    }
  }
  return vp;
}

/**
 * Check if VP achieves desired outcome
 */
function satisfiesOutcome(
  vp: { red: number; blue: number; green: number },
  desired: { first: 'red' | 'blue' | 'green'; second: 'red' | 'blue' | 'green'; third: 'red' | 'blue' | 'green' },
  minMargin: number
): boolean {
  return vp[desired.first] >= vp[desired.second] + minMargin &&
         vp[desired.second] >= vp[desired.third] + minMargin;
}

/**
 * Count first-place finishes for each team
 */
function countFirstPlaces(placements: Placement[]): { red: number; blue: number; green: number } {
  const counts = { red: 0, blue: 0, green: 0 };
  for (const pl of placements) {
    for (const color of ['red', 'blue', 'green'] as const) {
      if (pl[color] === 1) counts[color]++;
    }
  }
  return counts;
}


/**
 * Solve using iterative deepening with constraint-based pruning
 * Strategy: Try to minimize total effort (sum of 1st place finishes)
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

  // Try iterative deepening: start with minimum effort, increase until solution found
  // For efficiency, use greedy heuristic first
  const sortedSkirmishes = remainingSkirmishes
    .map((s, i) => ({ skirmish: s, index: i }))
    .sort((a, b) => b.skirmish.vpAwards.first - a.skirmish.vpAwards.first);

  /**
   * Greedy search: for each level of effort, try to construct a valid solution
   * Simple strategy: desired first gets X wins, remaining distribute optimally
   */
  function greedySearch(maxFirstPlacesForDesiredFirst: number): Placement[] | null {
    const placements: Placement[] = new Array(numSkirmishes);
    let firstPlacesGiven = 0;

    // Assign placements (highest VP skirmishes first for desired winner)
    for (const { index } of sortedSkirmishes) {
      if (firstPlacesGiven < maxFirstPlacesForDesiredFirst) {
        // Desired 1st place team wins this skirmish
        placements[index] = {
          [desiredOutcome.first]: 1,
          [desiredOutcome.second]: 2,
          [desiredOutcome.third]: 3,
        } as Placement;
        firstPlacesGiven++;
      } else {
        // Desired 1st doesn't win - give win to 3rd (minimizes 2nd's VP)
        placements[index] = {
          [desiredOutcome.first]: 2,
          [desiredOutcome.second]: 3,
          [desiredOutcome.third]: 1,
        } as Placement;
      }
    }

    // Check if this solution works
    const finalVP = calculateFinalVP(currentVP, remainingSkirmishes, placements);
    if (satisfiesOutcome(finalVP, desiredOutcome, minMargin)) {
      return placements;
    }

    return null;
  }

  // Binary search for minimum effort
  let low = 0;
  let high = numSkirmishes;
  let bestSolution: Placement[] | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const solution = greedySearch(mid);

    if (solution) {
      bestSolution = solution;
      high = mid - 1; // Try with less effort
    } else {
      low = mid + 1; // Need more effort
    }
  }

  if (!bestSolution) {
    return {
      isPossible: false,
      reason: `Could not find a valid path even with all skirmishes won by ${desiredOutcome.first}`,
    };
  }

  // Convert to result format
  const result: Array<{
    skirmishId: number;
    placements: Placement;
  }> = remainingSkirmishes.map((s, i) => ({
    skirmishId: s.id,
    placements: bestSolution![i],
  }));

  const finalVP = calculateFinalVP(currentVP, remainingSkirmishes, bestSolution);
  const firstPlaceCounts = countFirstPlaces(bestSolution);
  const firstPlaceCount = firstPlaceCounts[desiredOutcome.first];
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
