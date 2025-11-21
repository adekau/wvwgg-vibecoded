/**
 * Monte Carlo Simulator for VP Outcomes
 *
 * Runs thousands of simulations using historical probabilities to predict
 * the most likely match outcomes and confidence intervals.
 *
 * Algorithm Overview:
 * 1. For each simulation iteration:
 *    a. Start with current VP totals
 *    b. For each remaining skirmish:
 *       - Identify the time window (prime time, off-hours, etc.)
 *       - Sample placements for each team based on historical probabilities for that window
 *       - Ensure placements are valid (no duplicate positions)
 *       - Award VP based on placements and skirmish tier
 *    c. Record final VP totals and standings
 *
 * 2. After all iterations, calculate:
 *    - Outcome probabilities (likelihood of each final standing)
 *    - Confidence intervals (10th, 50th, 90th percentiles for VP)
 *    - Team position probabilities (chance each team finishes 1st/2nd/3rd)
 *
 * The Monte Carlo approach handles uncertainty by:
 * - Using historical placement probabilities rather than assuming patterns continue
 * - Accounting for different time windows (teams perform differently at different times)
 * - Running 10,000+ simulations to get statistically significant results
 * - Providing confidence intervals to show the range of possible outcomes
 *
 * @module monte-carlo-simulator
 */

import { TeamHistoricalStats, getTimeWindow } from './historical-performance'

export interface SimulationResult {
  finalVP: {
    red: number
    blue: number
    green: number
  }
  finalStandings: {
    first: 'red' | 'blue' | 'green'
    second: 'red' | 'blue' | 'green'
    third: 'red' | 'blue' | 'green'
  }
  placements: Array<{
    skirmishId: number
    red: 1 | 2 | 3
    blue: 1 | 2 | 3
    green: 1 | 2 | 3
  }>
}

export interface MonteCarloResult {
  iterations: number
  simulations: SimulationResult[]

  // Probability of each final standing
  outcomeProbabilities: Array<{
    outcome: {
      first: 'red' | 'blue' | 'green'
      second: 'red' | 'blue' | 'green'
      third: 'red' | 'blue' | 'green'
    }
    probability: number
    count: number
  }>

  // Most likely outcome
  mostLikelyOutcome: {
    first: 'red' | 'blue' | 'green'
    second: 'red' | 'blue' | 'green'
    third: 'red' | 'blue' | 'green'
  }
  mostLikelyProbability: number

  // Confidence intervals for final VP (10th, 50th, 90th percentiles)
  vpConfidenceIntervals: {
    red: { p10: number; p50: number; p90: number }
    blue: { p10: number; p50: number; p90: number }
    green: { p10: number; p50: number; p90: number }
  }

  // Individual team probabilities to finish in each position
  teamPositionProbabilities: {
    red: { first: number; second: number; third: number }
    blue: { first: number; second: number; third: number }
    green: { first: number; second: number; third: number }
  }

  // Average final VP
  averageFinalVP: {
    red: number
    blue: number
    green: number
  }
}

export interface SkirmishInfo {
  id: number
  startTime: Date
  vpAwards: { first: number; second: number; third: number }
}

/**
 * Randomly samples a placement based on probabilities
 *
 * Uses the inverse transform sampling method:
 * - Generate random number between 0 and 1
 * - If rand < P(1st), return 1st place
 * - Else if rand < P(1st) + P(2nd), return 2nd place
 * - Else return 3rd place
 *
 * This ensures placements are sampled proportionally to their probabilities.
 *
 * @param probabilities Historical placement probabilities for a team
 * @returns Sampled placement (1, 2, or 3)
 */
function samplePlacement(probabilities: { first: number; second: number; third: number }): 1 | 2 | 3 {
  const rand = Math.random()
  if (rand < probabilities.first) return 1
  if (rand < probabilities.first + probabilities.second) return 2
  return 3
}

/**
 * Ensures placements are valid (one team per position)
 * If there are duplicates, resolve by random reassignment
 *
 * This function handles the edge case where independent probability sampling
 * results in multiple teams being assigned the same placement (e.g., two teams
 * both sampled as 1st place).
 *
 * Resolution Strategy:
 * 1. Check if all three placements are unique
 * 2. If yes, return as-is
 * 3. If no, randomly shuffle [1, 2, 3] and assign to teams
 *
 * This maintains fairness by giving each team an equal chance at each position
 * when conflicts occur. An alternative approach would be to re-sample, but
 * shuffling is more efficient and equally valid.
 *
 * @param placements Sampled placements (may contain duplicates)
 * @returns Valid placements with no duplicates
 */
function ensureValidPlacements(placements: {
  red: 1 | 2 | 3
  blue: 1 | 2 | 3
  green: 1 | 2 | 3
}): { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 } {
  const positions = [placements.red, placements.blue, placements.green]

  // Check if all positions are unique
  if (new Set(positions).size === 3) {
    return placements
  }

  // If not unique, assign positions [1, 2, 3] randomly to teams
  // Using Fisher-Yates shuffle algorithm for unbiased randomization
  const shuffled: Array<1 | 2 | 3> = [1, 2, 3]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return {
    red: shuffled[0],
    blue: shuffled[1],
    green: shuffled[2],
  }
}

/**
 * Runs a single simulation
 *
 * This is the core simulation loop that predicts one possible outcome for the match.
 *
 * Process:
 * 1. Start with current VP totals (carried over from completed skirmishes)
 * 2. For each remaining skirmish:
 *    a. Determine time window (prime time NA/EU, off-hours, etc.)
 *    b. Sample placements for each team based on their historical performance in that window
 *    c. Validate placements (ensure no duplicates)
 *    d. Award VP based on placements and skirmish tier (varies by time of day)
 * 3. Sort teams by final VP to determine standings
 *
 * Key Insight: Teams perform differently at different times of day. For example:
 * - An OCX-focused team may dominate during off-hours but struggle during NA prime time
 * - This simulation captures that variance by using window-specific probabilities
 *
 * @param currentVP Current VP totals (from completed skirmishes)
 * @param remainingSkirmishes Skirmishes yet to be played
 * @param historicalStats Historical placement probabilities for each team by time window
 * @param region Match region (affects VP tiers)
 * @returns Single simulation result with final VP and standings
 */
function runSingleSimulation(
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: SkirmishInfo[],
  historicalStats: {
    red: TeamHistoricalStats
    blue: TeamHistoricalStats
    green: TeamHistoricalStats
  },
  region: 'na' | 'eu'
): SimulationResult {
  const vp = { ...currentVP }
  const placements: Array<{
    skirmishId: number
    red: 1 | 2 | 3
    blue: 1 | 2 | 3
    green: 1 | 2 | 3
  }> = []

  // Simulate each remaining skirmish
  for (const skirmish of remainingSkirmishes) {
    // Determine which time window this skirmish falls into
    // (e.g., "primetime_na", "offpeak", etc.)
    const window = getTimeWindow(skirmish.startTime, region)

    // Sample placement for each team based on historical probabilities for this time window
    // Each team is sampled independently, which may result in duplicate placements
    const rawPlacements = {
      red: samplePlacement(historicalStats.red.placementProbabilityByWindow[window]),
      blue: samplePlacement(historicalStats.blue.placementProbabilityByWindow[window]),
      green: samplePlacement(historicalStats.green.placementProbabilityByWindow[window]),
    }

    // Ensure valid placements (no duplicates)
    // If two teams both sampled "1st", we need to break the tie
    const validPlacements = ensureValidPlacements(rawPlacements)

    placements.push({
      skirmishId: skirmish.id,
      ...validPlacements,
    })

    // Award VP based on placements
    // VP awards vary by skirmish (e.g., peak hours award more VP)
    vp.red += validPlacements.red === 1 ? skirmish.vpAwards.first :
              validPlacements.red === 2 ? skirmish.vpAwards.second :
              skirmish.vpAwards.third
    vp.blue += validPlacements.blue === 1 ? skirmish.vpAwards.first :
               validPlacements.blue === 2 ? skirmish.vpAwards.second :
               skirmish.vpAwards.third
    vp.green += validPlacements.green === 1 ? skirmish.vpAwards.first :
                validPlacements.green === 2 ? skirmish.vpAwards.second :
                skirmish.vpAwards.third
  }

  // Determine final standings by sorting teams by VP (descending)
  const teams = [
    { color: 'red' as const, vp: vp.red },
    { color: 'blue' as const, vp: vp.blue },
    { color: 'green' as const, vp: vp.green },
  ].sort((a, b) => b.vp - a.vp)

  return {
    finalVP: vp,
    finalStandings: {
      first: teams[0].color,
      second: teams[1].color,
      third: teams[2].color,
    },
    placements,
  }
}

/**
 * Calculates percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((sorted.length * p) / 100) - 1
  return sorted[Math.max(0, index)]
}

/**
 * Analyzes completed simulations and calculates statistics
 */
export function analyzeSimulations(simulations: SimulationResult[]): MonteCarloResult {
  const iterations = simulations.length

  // Count outcomes
  const outcomeMap = new Map<string, number>()
  for (const sim of simulations) {
    const key = `${sim.finalStandings.first},${sim.finalStandings.second},${sim.finalStandings.third}`
    outcomeMap.set(key, (outcomeMap.get(key) || 0) + 1)
  }

  // Convert to sorted array
  const outcomeProbabilities = Array.from(outcomeMap.entries())
    .map(([key, count]) => {
      const [first, second, third] = key.split(',') as ['red' | 'blue' | 'green', 'red' | 'blue' | 'green', 'red' | 'blue' | 'green']
      return {
        outcome: { first, second, third },
        probability: count / iterations,
        count,
      }
    })
    .sort((a, b) => b.probability - a.probability)

  // Most likely outcome
  const mostLikely = outcomeProbabilities[0]

  // Calculate confidence intervals
  const redVPs = simulations.map(s => s.finalVP.red).sort((a, b) => a - b)
  const blueVPs = simulations.map(s => s.finalVP.blue).sort((a, b) => a - b)
  const greenVPs = simulations.map(s => s.finalVP.green).sort((a, b) => a - b)

  const vpConfidenceIntervals = {
    red: {
      p10: percentile(redVPs, 10),
      p50: percentile(redVPs, 50),
      p90: percentile(redVPs, 90),
    },
    blue: {
      p10: percentile(blueVPs, 10),
      p50: percentile(blueVPs, 50),
      p90: percentile(blueVPs, 90),
    },
    green: {
      p10: percentile(greenVPs, 10),
      p50: percentile(greenVPs, 50),
      p90: percentile(greenVPs, 90),
    },
  }

  // Calculate team position probabilities
  const teamPositionProbabilities = {
    red: { first: 0, second: 0, third: 0 },
    blue: { first: 0, second: 0, third: 0 },
    green: { first: 0, second: 0, third: 0 },
  }

  for (const sim of simulations) {
    teamPositionProbabilities[sim.finalStandings.first].first++
    teamPositionProbabilities[sim.finalStandings.second].second++
    teamPositionProbabilities[sim.finalStandings.third].third++
  }

  // Normalize to probabilities
  for (const team of ['red', 'blue', 'green'] as const) {
    teamPositionProbabilities[team].first /= iterations
    teamPositionProbabilities[team].second /= iterations
    teamPositionProbabilities[team].third /= iterations
  }

  // Calculate average final VP
  const averageFinalVP = {
    red: redVPs.reduce((sum, vp) => sum + vp, 0) / iterations,
    blue: blueVPs.reduce((sum, vp) => sum + vp, 0) / iterations,
    green: greenVPs.reduce((sum, vp) => sum + vp, 0) / iterations,
  }

  return {
    iterations,
    simulations,
    outcomeProbabilities,
    mostLikelyOutcome: mostLikely.outcome,
    mostLikelyProbability: mostLikely.probability,
    vpConfidenceIntervals,
    teamPositionProbabilities,
    averageFinalVP,
  }
}

/**
 * Runs Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: SkirmishInfo[],
  historicalStats: {
    red: TeamHistoricalStats
    blue: TeamHistoricalStats
    green: TeamHistoricalStats
  },
  region: 'na' | 'eu',
  iterations: number = 10000
): MonteCarloResult {
  const simulations: SimulationResult[] = []

  // Run simulations
  for (let i = 0; i < iterations; i++) {
    simulations.push(runSingleSimulation(currentVP, remainingSkirmishes, historicalStats, region))
  }

  return analyzeSimulations(simulations)
}

/**
 * Calculates risk assessment for a desired outcome
 */
export function calculateRiskAssessment(
  desiredOutcome: {
    first: 'red' | 'blue' | 'green'
    second: 'red' | 'blue' | 'green'
    third: 'red' | 'blue' | 'green'
  },
  monteCarloResult: MonteCarloResult
): {
  probability: number
  risk: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high'
  message: string
} {
  // Find probability of desired outcome
  const outcome = monteCarloResult.outcomeProbabilities.find(
    o =>
      o.outcome.first === desiredOutcome.first &&
      o.outcome.second === desiredOutcome.second &&
      o.outcome.third === desiredOutcome.third
  )

  const probability = outcome?.probability || 0

  let risk: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high'
  let message: string

  if (probability >= 0.7) {
    risk = 'very-low'
    message = `Very likely to happen (${(probability * 100).toFixed(1)}% probability)`
  } else if (probability >= 0.5) {
    risk = 'low'
    message = `Likely to happen (${(probability * 100).toFixed(1)}% probability)`
  } else if (probability >= 0.3) {
    risk = 'moderate'
    message = `Moderate chance (${(probability * 100).toFixed(1)}% probability)`
  } else if (probability >= 0.1) {
    risk = 'high'
    message = `Unlikely (${(probability * 100).toFixed(1)}% probability)`
  } else {
    risk = 'very-high'
    message = `Very unlikely (${(probability * 100).toFixed(1)}% probability)`
  }

  return { probability, risk, message }
}
