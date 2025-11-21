/**
 * Monte Carlo Simulator for VP Outcomes
 *
 * Runs thousands of simulations using historical probabilities to predict
 * the most likely match outcomes and confidence intervals.
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
    const window = getTimeWindow(skirmish.startTime, region)

    // Sample placement for each team based on historical probabilities for this time window
    const rawPlacements = {
      red: samplePlacement(historicalStats.red.placementProbabilityByWindow[window]),
      blue: samplePlacement(historicalStats.blue.placementProbabilityByWindow[window]),
      green: samplePlacement(historicalStats.green.placementProbabilityByWindow[window]),
    }

    // Ensure valid placements (no duplicates)
    const validPlacements = ensureValidPlacements(rawPlacements)

    placements.push({
      skirmishId: skirmish.id,
      ...validPlacements,
    })

    // Award VP based on placements
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

  // Determine final standings
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
