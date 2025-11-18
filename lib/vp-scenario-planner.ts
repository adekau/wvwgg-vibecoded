/**
 * Victory Point Scenario Planning Utility
 * Calculates if desired match outcomes are achievable and what placements are needed
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
  minMargin?: number; // Optional minimum VP margin between placements
}

export interface ScenarioResult {
  isPossible: boolean;
  requiredPlacements?: Array<{
    skirmishId: number;
    placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };
  }>;
  finalVP?: { red: number; blue: number; green: number };
  margin?: number;
  reason?: string; // If impossible, explain why
  difficulty?: 'easy' | 'moderate' | 'hard' | 'very-hard';
}

/**
 * Calculate maximum possible VP for each team
 */
function calculateMaxVP(
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{ vpAwards: { first: number; second: number; third: number } }>
): { red: number; blue: number; green: number } {
  const maxVPGain = remainingSkirmishes.reduce(
    (sum, skirmish) => sum + skirmish.vpAwards.first,
    0
  );

  return {
    red: currentVP.red + maxVPGain,
    blue: currentVP.blue + maxVPGain,
    green: currentVP.green + maxVPGain,
  };
}

/**
 * Calculate minimum possible VP for each team
 */
function calculateMinVP(
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{ vpAwards: { first: number; second: number; third: number } }>
): { red: number; blue: number; green: number } {
  const minVPGain = remainingSkirmishes.reduce(
    (sum, skirmish) => sum + skirmish.vpAwards.third,
    0
  );

  return {
    red: currentVP.red + minVPGain,
    blue: currentVP.blue + minVPGain,
    green: currentVP.green + minVPGain,
  };
}

/**
 * Calculate VP if a team gets all of a specific placement
 */
function calculateVPWithPlacement(
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: Array<{ vpAwards: { first: number; second: number; third: number } }>,
  team: 'red' | 'blue' | 'green',
  placement: 'first' | 'second' | 'third'
): number {
  const vpGain = remainingSkirmishes.reduce(
    (sum, skirmish) => sum + skirmish.vpAwards[placement],
    0
  );
  return currentVP[team] + vpGain;
}

/**
 * Check if a desired outcome is theoretically possible
 * Key insight: When desired 1st gets all firsts, desired 2nd gets all thirds,
 * and desired 3rd gets all seconds. We need to check if this maintains the desired order.
 */
function checkFeasibility(
  input: ScenarioInput
): { possible: boolean; reason?: string } {
  const { currentVP, remainingSkirmishes, desiredOutcome } = input;
  const { first, second, third } = desiredOutcome;

  // Best case scenario for achieving desired outcome:
  // - Desired 1st gets all first places
  // - Desired 2nd gets all third places (minimize their VP)
  // - Desired 3rd gets all second places
  const bestCaseVP = {
    [first]: calculateVPWithPlacement(currentVP, remainingSkirmishes, first, 'first'),
    [second]: calculateVPWithPlacement(currentVP, remainingSkirmishes, second, 'third'),
    [third]: calculateVPWithPlacement(currentVP, remainingSkirmishes, third, 'second'),
  };

  // Check if this achieves the desired order
  if (bestCaseVP[first] <= bestCaseVP[second]) {
    return {
      possible: false,
      reason: `Even if ${first} wins all remaining skirmishes (${bestCaseVP[first]} VP), they cannot beat ${second} with all 3rd places (${bestCaseVP[second]} VP).`,
    };
  }

  if (bestCaseVP[second] <= bestCaseVP[third]) {
    return {
      possible: false,
      reason: `Even in best case, ${second} with all 3rd places (${bestCaseVP[second]} VP) cannot stay ahead of ${third} with all 2nd places (${bestCaseVP[third]} VP).`,
    };
  }

  return { possible: true };
}

/**
 * Find minimum effort path to achieve the desired outcome
 * Uses a simplified constraint satisfaction approach:
 * - Minimize wins needed for desired 1st place team
 * - Ensure each skirmish has exactly one 1st, 2nd, and 3rd place
 */
function findMinimumEffortPath(input: ScenarioInput): ScenarioResult {
  const { currentVP, remainingSkirmishes, desiredOutcome, minMargin = 1 } = input;
  const { first, second, third } = desiredOutcome;

  // Check feasibility first
  const feasibility = checkFeasibility(input);
  if (!feasibility.possible) {
    return {
      isPossible: false,
      reason: feasibility.reason,
    };
  }

  // Sort skirmishes by VP value (highest first) to prioritize high-value skirmishes
  const sortedIndices = remainingSkirmishes
    .map((s, i) => ({ skirmish: s, originalIndex: i }))
    .sort((a, b) => b.skirmish.vpAwards.first - a.skirmish.vpAwards.first);

  // Helper function to calculate final VP given a set of placements
  const calculateFinalVP = (placements: Array<{ red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 }>) => {
    const vp = { ...currentVP };
    for (let i = 0; i < remainingSkirmishes.length; i++) {
      const skirmish = remainingSkirmishes[i];
      const placement = placements[i];

      for (const color of ['red', 'blue', 'green'] as const) {
        if (placement[color] === 1) vp[color] += skirmish.vpAwards.first;
        else if (placement[color] === 2) vp[color] += skirmish.vpAwards.second;
        else vp[color] += skirmish.vpAwards.third;
      }
    }
    return vp;
  };

  // Helper to check if VP achieves desired outcome
  const checkOutcome = (vp: { red: number; blue: number; green: number }) => {
    return vp[first] >= vp[second] + minMargin && vp[second] >= vp[third] + minMargin;
  };

  /**
   * Try to construct a valid scenario with X first-place finishes for desired winner
   * Optimal strategy depends on whether desired 1st is ahead or behind:
   * - If behind: Give desired 1st the wins, minimize 2nd's VP
   * - If ahead: Give desired 1st fewer wins, give wins to 3rd (keep them low)
   */
  const tryConstructScenario = (numFirsts: number): Array<{ red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 }> => {
    const placements: Array<{ red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 }> = [];

    // Initialize all placements
    for (let i = 0; i < remainingSkirmishes.length; i++) {
      placements.push({ red: 3, blue: 3, green: 3 } as any);
    }

    // Check if desired 1st is already ahead of desired 2nd
    const firstIsAhead = currentVP[first] > currentVP[second];

    // Assign first places to desired winner in highest VP skirmishes
    let firstPlacesGiven = 0;
    for (const { originalIndex } of sortedIndices) {
      if (firstPlacesGiven < numFirsts) {
        // Desired 1st place team wins this skirmish
        placements[originalIndex][first] = 1;
        placements[originalIndex][second] = 2;
        placements[originalIndex][third] = 3;
        firstPlacesGiven++;
      } else {
        // Desired 1st place team doesn't win
        if (firstIsAhead) {
          // First is already ahead - give wins to 3rd to keep them competitive
          // This prevents 2nd from getting too many wins
          placements[originalIndex][third] = 1;
          placements[originalIndex][second] = 2;
          placements[originalIndex][first] = 3;
        } else {
          // First is behind - give 2nd place to first, minimize 2nd's VP
          placements[originalIndex][third] = 1;
          placements[originalIndex][first] = 2;
          placements[originalIndex][second] = 3;
        }
      }
    }

    return placements;
  };

  // Determine starting point for binary search based on current standings
  // If desired 1st is already ahead, start with fewer wins
  const firstIsAhead = currentVP[first] > currentVP[second];
  let low = firstIsAhead ? 0 : Math.floor(remainingSkirmishes.length * 0.3);
  let high = firstIsAhead ? Math.floor(remainingSkirmishes.length * 0.5) : remainingSkirmishes.length;

  let bestPlacements: Array<{ red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 }> | null = null;
  let minFirstPlaces = remainingSkirmishes.length + 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const placements = tryConstructScenario(mid);
    const finalVP = calculateFinalVP(placements);

    if (checkOutcome(finalVP)) {
      // This works! Try with fewer 1st places
      bestPlacements = placements;
      minFirstPlaces = mid;
      high = mid - 1;
    } else {
      // Doesn't work, need more 1st places
      low = mid + 1;
    }
  }

  if (!bestPlacements) {
    return {
      isPossible: false,
      reason: `Could not find a valid path even with all skirmishes won by ${first}`,
    };
  }

  // Convert back to original format with skirmish IDs
  const result: Array<{
    skirmishId: number;
    placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };
  }> = remainingSkirmishes.map((s, i) => ({
    skirmishId: s.id,
    placements: bestPlacements![i],
  }));

  const finalVP = calculateFinalVP(bestPlacements);
  const firstPlaceCount = bestPlacements.filter(p => p[first] === 1).length;
  const totalSkirmishes = remainingSkirmishes.length;
  const firstPlacePercentage = (firstPlaceCount / totalSkirmishes) * 100;

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
    margin: finalVP[first] - finalVP[second],
    difficulty,
  };
}

/**
 * Calculate VP scenario and determine if outcome is achievable
 */
export function calculateScenario(input: ScenarioInput): ScenarioResult {
  // Validate input
  if (input.desiredOutcome.first === input.desiredOutcome.second ||
      input.desiredOutcome.first === input.desiredOutcome.third ||
      input.desiredOutcome.second === input.desiredOutcome.third) {
    return {
      isPossible: false,
      reason: 'Invalid desired outcome: teams cannot have the same placement.',
    };
  }

  return findMinimumEffortPath(input);
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
