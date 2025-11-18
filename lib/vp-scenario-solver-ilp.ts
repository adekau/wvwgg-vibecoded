/**
 * VP Scenario Integer Linear Programming Solver
 * Formulates the problem as a constraint satisfaction problem and solves optimally
 */

import solver from 'javascript-lp-solver';

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
 * Solve using Integer Linear Programming
 * This formulates the problem as a proper constraint satisfaction problem
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

  const teams = ['red', 'blue', 'green'] as const;
  const placements = ['first', 'second', 'third'] as const;
  const numSkirmishes = remainingSkirmishes.length;

  // Build the linear programming model
  const model: any = {
    optimize: 'totalEffort',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {},
  };

  // Decision variables: x[skirmish_team_placement] = 1 if team gets placement in skirmish
  // Example: x[0_red_first] = 1 means red gets 1st in skirmish 0
  for (let i = 0; i < numSkirmishes; i++) {
    for (const team of teams) {
      for (const placement of placements) {
        const varName = `x${i}_${team}_${placement}`;
        model.variables[varName] = {};
        model.ints[varName] = 1; // Binary variable
      }
    }
  }

  // Constraint 1: Each team gets exactly one placement per skirmish
  for (let i = 0; i < numSkirmishes; i++) {
    for (const team of teams) {
      const constraintName = `skirmish${i}_team${team}_one_placement`;
      model.constraints[constraintName] = { equal: 1 };
      for (const placement of placements) {
        const varName = `x${i}_${team}_${placement}`;
        model.variables[varName][constraintName] = 1;
      }
    }
  }

  // Constraint 2: Each placement is assigned to exactly one team per skirmish
  for (let i = 0; i < numSkirmishes; i++) {
    for (const placement of placements) {
      const constraintName = `skirmish${i}_${placement}_one_team`;
      model.constraints[constraintName] = { equal: 1 };
      for (const team of teams) {
        const varName = `x${i}_${team}_${placement}`;
        model.variables[varName][constraintName] = 1;
      }
    }
  }

  // Calculate final VP for each team (as linear combination of decision variables)
  const finalVP: Record<string, any> = {};
  for (const team of teams) {
    finalVP[team] = currentVP[team];
    for (let i = 0; i < numSkirmishes; i++) {
      const sk = remainingSkirmishes[i];
      // VP contribution from this skirmish
      for (const [placement, vpValue] of [
        ['first', sk.vpAwards.first],
        ['second', sk.vpAwards.second],
        ['third', sk.vpAwards.third],
      ] as const) {
        const varName = `x${i}_${team}_${placement}`;
        if (!model.variables[varName].vpContrib) {
          model.variables[varName].vpContrib = 0;
        }
        model.variables[varName].vpContrib = vpValue;
        finalVP[team] += ` + ${vpValue} * ${varName}`;
      }
    }
  }

  // Constraint 3: VP ordering must satisfy desired outcome
  // VP[first] >= VP[second] + minMargin
  const vpOrderConstraint1 = `vp_order_first_second`;
  model.constraints[vpOrderConstraint1] = { min: minMargin };
  for (let i = 0; i < numSkirmishes; i++) {
    const sk = remainingSkirmishes[i];
    for (const placement of placements) {
      const vpValue = sk.vpAwards[placement];
      const firstVar = `x${i}_${desiredOutcome.first}_${placement}`;
      const secondVar = `x${i}_${desiredOutcome.second}_${placement}`;
      model.variables[firstVar][vpOrderConstraint1] = vpValue;
      model.variables[secondVar][vpOrderConstraint1] = -vpValue;
    }
  }

  // VP[second] >= VP[third] + minMargin
  const vpOrderConstraint2 = `vp_order_second_third`;
  model.constraints[vpOrderConstraint2] = { min: minMargin - (currentVP[desiredOutcome.third] - currentVP[desiredOutcome.second]) };
  for (let i = 0; i < numSkirmishes; i++) {
    const sk = remainingSkirmishes[i];
    for (const placement of placements) {
      const vpValue = sk.vpAwards[placement];
      const secondVar = `x${i}_${desiredOutcome.second}_${placement}`;
      const thirdVar = `x${i}_${desiredOutcome.third}_${placement}`;
      model.variables[secondVar][vpOrderConstraint2] = vpValue;
      model.variables[thirdVar][vpOrderConstraint2] = -vpValue;
    }
  }

  // Objective: Minimize total effort (sum of first-place finishes weighted by team)
  // Prioritize minimizing wins for desired first place (they should coast if already ahead)
  const effortWeights = {
    [desiredOutcome.first]: 1,
    [desiredOutcome.second]: 2,
    [desiredOutcome.third]: 3,
  };

  for (let i = 0; i < numSkirmishes; i++) {
    for (const team of teams) {
      const varName = `x${i}_${team}_first`;
      model.variables[varName].totalEffort = effortWeights[team];
    }
  }

  // Solve the ILP
  try {
    const result = solver.Solve(model);

    if (!result || result.feasible === false) {
      return {
        isPossible: false,
        reason: `Could not find a valid solution. The desired outcome may be mathematically impossible.`,
      };
    }

    // Extract placements from solution
    const placements: Array<{
      skirmishId: number;
      placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };
    }> = [];

    for (let i = 0; i < numSkirmishes; i++) {
      const skirmishPlacements: any = {};
      for (const team of teams) {
        for (const [placement, rank] of [
          ['first', 1],
          ['second', 2],
          ['third', 3],
        ] as const) {
          const varName = `x${i}_${team}_${placement}`;
          if (result[varName] === 1) {
            skirmishPlacements[team] = rank;
          }
        }
      }
      placements.push({
        skirmishId: remainingSkirmishes[i].id,
        placements: skirmishPlacements,
      });
    }

    // Calculate final VP
    const calculatedFinalVP = { ...currentVP };
    for (let i = 0; i < numSkirmishes; i++) {
      const sk = remainingSkirmishes[i];
      const pl = placements[i].placements;
      for (const team of teams) {
        if (pl[team] === 1) calculatedFinalVP[team] += sk.vpAwards.first;
        else if (pl[team] === 2) calculatedFinalVP[team] += sk.vpAwards.second;
        else calculatedFinalVP[team] += sk.vpAwards.third;
      }
    }

    // Count first places for difficulty
    let firstPlaceCount = 0;
    for (const p of placements) {
      if (p.placements[desiredOutcome.first] === 1) firstPlaceCount++;
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
      requiredPlacements: placements,
      finalVP: calculatedFinalVP,
      margin: calculatedFinalVP[desiredOutcome.first] - calculatedFinalVP[desiredOutcome.second],
      difficulty,
    };
  } catch (error) {
    console.error('ILP Solver error:', error);
    return {
      isPossible: false,
      reason: `Solver error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
