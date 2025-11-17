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
 * Check if a desired outcome is theoretically possible
 */
function checkFeasibility(
  input: ScenarioInput
): { possible: boolean; reason?: string } {
  const maxVP = calculateMaxVP(input.currentVP, input.remainingSkirmishes);
  const minVP = calculateMinVP(input.currentVP, input.remainingSkirmishes);

  const { first, second, third } = input.desiredOutcome;

  // Check if first place team can beat second place team's minimum
  if (maxVP[first] < minVP[second]) {
    return {
      possible: false,
      reason: `Even if ${first} wins all remaining skirmishes (max ${maxVP[first]} VP), they cannot beat ${second}'s minimum ${minVP[second]} VP.`,
    };
  }

  // Check if second place team can beat third place team's minimum
  if (maxVP[second] < minVP[third]) {
    return {
      possible: false,
      reason: `Even if ${second} wins all remaining skirmishes (max ${maxVP[second]} VP), they cannot beat ${third}'s minimum ${minVP[third]} VP.`,
    };
  }

  // Check if third place team can be kept below second place
  if (minVP[third] > maxVP[second]) {
    return {
      possible: false,
      reason: `${third}'s minimum VP (${minVP[third]}) is already higher than ${second}'s maximum possible VP (${maxVP[second]}).`,
    };
  }

  return { possible: true };
}

/**
 * Find minimum effort path to achieve the desired outcome
 * Uses optimization to find the fewest wins needed
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

  // Start with a baseline: give everyone equal placements and adjust
  // Try to find minimum number of 1st places needed for desired winner
  let bestPlacements: Array<{ red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 }> | null = null;
  let minFirstPlaces = remainingSkirmishes.length + 1;

  // Binary search for minimum number of 1st place finishes needed
  let low = 0;
  let high = remainingSkirmishes.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    // Try to achieve outcome with 'mid' first place finishes for desired winner
    // Give 1st places in highest VP skirmishes
    const placements: Array<{ red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 }> = [];

    for (let i = 0; i < remainingSkirmishes.length; i++) {
      placements.push({ red: 3, blue: 3, green: 3 } as any);
    }

    // Assign 1st places to desired first place team in highest VP skirmishes
    let firstPlacesGiven = 0;
    for (const { originalIndex } of sortedIndices) {
      if (firstPlacesGiven < mid) {
        placements[originalIndex][first] = 1;
        firstPlacesGiven++;
      }
    }

    // Now assign 2nd and 3rd places optimally
    // Calculate current VP with the 1st places we've assigned
    const tempVP = { ...currentVP };
    for (let i = 0; i < remainingSkirmishes.length; i++) {
      if (placements[i][first] === 1) {
        tempVP[first] += remainingSkirmishes[i].vpAwards.first;
      }
    }

    // Determine optimal 2nd/3rd distribution
    for (let i = 0; i < remainingSkirmishes.length; i++) {
      if (placements[i][first] === 1) {
        // First has 1st, assign 2nd and 3rd
        placements[i][second] = 2;
        placements[i][third] = 3;
        tempVP[second] += remainingSkirmishes[i].vpAwards.second;
        tempVP[third] += remainingSkirmishes[i].vpAwards.third;
      } else {
        // First doesn't have 1st - need to assign all three placements
        // Check what each team needs based on current temp VP
        const firstBehindSecond = tempVP[first] < tempVP[second];
        const secondBehindThird = tempVP[second] < tempVP[third];

        if (firstBehindSecond) {
          // First needs more VP - give them 2nd
          if (secondBehindThird) {
            // Second also needs more - give them 1st, third gets 3rd
            placements[i][first] = 2;
            placements[i][second] = 1;
            placements[i][third] = 3;
            tempVP[first] += remainingSkirmishes[i].vpAwards.second;
            tempVP[second] += remainingSkirmishes[i].vpAwards.first;
            tempVP[third] += remainingSkirmishes[i].vpAwards.third;
          } else {
            // Second is ahead of third - can give third 1st to slow them down
            placements[i][first] = 2;
            placements[i][third] = 1;
            placements[i][second] = 3;
            tempVP[first] += remainingSkirmishes[i].vpAwards.second;
            tempVP[third] += remainingSkirmishes[i].vpAwards.first;
            tempVP[second] += remainingSkirmishes[i].vpAwards.third;
          }
        } else {
          // First is ahead of second - can afford to give them 3rd
          if (secondBehindThird) {
            // Second needs help - give them 1st
            placements[i][second] = 1;
            placements[i][third] = 2;
            placements[i][first] = 3;
            tempVP[second] += remainingSkirmishes[i].vpAwards.first;
            tempVP[third] += remainingSkirmishes[i].vpAwards.second;
            tempVP[first] += remainingSkirmishes[i].vpAwards.third;
          } else {
            // Second is ahead of third - give third 1st to keep them in range
            placements[i][third] = 1;
            placements[i][second] = 2;
            placements[i][first] = 3;
            tempVP[third] += remainingSkirmishes[i].vpAwards.first;
            tempVP[second] += remainingSkirmishes[i].vpAwards.second;
            tempVP[first] += remainingSkirmishes[i].vpAwards.third;
          }
        }
      }
    }

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
