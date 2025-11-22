/**
 * Historical Performance Analyzer
 *
 * Analyzes past skirmish results to calculate probabilities for future outcomes.
 * This enables Monte Carlo simulations and probability-based predictions.
 */

import { getVPTierForTime } from './vp-tiers'

export interface SkirmishResult {
  skirmishId: number
  timestamp: Date
  placements: {
    red: 1 | 2 | 3
    blue: 1 | 2 | 3
    green: 1 | 2 | 3
  }
  scores: {
    red: number
    blue: number
    green: number
  }
  vpAwarded: {
    red: number
    blue: number
    green: number
  }
  // Alliance composition - world IDs that make up each team
  alliances?: {
    red: number[]
    blue: number[]
    green: number[]
  }
}

export interface TimeWindowStats {
  totalSkirmishes: number
  placements: {
    first: number
    second: number
    third: number
  }
  averageScore: number
  averageVP: number
}

export interface AllianceStats {
  allianceKey: string // Sorted, comma-separated world IDs (e.g., "1001,1002,1003")
  worldIds: number[]
  stats: TimeWindowStats
  statsByWindow: {
    naPrime: TimeWindowStats
    euPrime: TimeWindowStats
    ocx: TimeWindowStats
    offHours: TimeWindowStats
  }
  placementProbability: {
    first: number
    second: number
    third: number
  }
  placementProbabilityByWindow: {
    naPrime: { first: number; second: number; third: number }
    euPrime: { first: number; second: number; third: number }
    ocx: { first: number; second: number; third: number }
    offHours: { first: number; second: number; third: number }
  }
}

export interface TeamHistoricalStats {
  teamColor: 'red' | 'blue' | 'green'
  teamName: string

  // Overall statistics
  overall: TimeWindowStats

  // Statistics by time window
  byWindow: {
    naPrime: TimeWindowStats
    euPrime: TimeWindowStats
    ocx: TimeWindowStats
    offHours: TimeWindowStats
  }

  // Placement probabilities (0-1)
  placementProbability: {
    first: number
    second: number
    third: number
  }

  // Placement probabilities by time window
  placementProbabilityByWindow: {
    naPrime: { first: number; second: number; third: number }
    euPrime: { first: number; second: number; third: number }
    ocx: { first: number; second: number; third: number }
    offHours: { first: number; second: number; third: number }
  }

  // Performance by alliance composition
  // This tracks how the team performs with different alliance compositions
  // Key: alliance composition (sorted world IDs joined by comma)
  // Value: statistics for that specific alliance composition
  byAlliance: Map<string, AllianceStats>

  // Current alliance composition (if available)
  currentAlliance?: {
    allianceKey: string
    worldIds: number[]
  }
}

export type TimeWindow = 'naPrime' | 'euPrime' | 'ocx' | 'offHours'

/**
 * Creates a unique key for an alliance composition
 * Sorts the world IDs and joins them with commas
 *
 * @param worldIds Array of world IDs in the alliance
 * @returns Sorted, comma-separated string of world IDs
 */
export function createAllianceKey(worldIds: number[]): string {
  return [...worldIds].sort((a, b) => a - b).join(',')
}

/**
 * Creates an empty TimeWindowStats object
 */
function createEmptyTimeWindowStats(): TimeWindowStats {
  return {
    totalSkirmishes: 0,
    placements: { first: 0, second: 0, third: 0 },
    averageScore: 0,
    averageVP: 0,
  }
}

/**
 * Creates an empty AllianceStats object
 */
function createEmptyAllianceStats(worldIds: number[]): AllianceStats {
  const allianceKey = createAllianceKey(worldIds)
  return {
    allianceKey,
    worldIds: [...worldIds].sort((a, b) => a - b),
    stats: createEmptyTimeWindowStats(),
    statsByWindow: {
      naPrime: createEmptyTimeWindowStats(),
      euPrime: createEmptyTimeWindowStats(),
      ocx: createEmptyTimeWindowStats(),
      offHours: createEmptyTimeWindowStats(),
    },
    placementProbability: { first: 0.33, second: 0.34, third: 0.33 },
    placementProbabilityByWindow: {
      naPrime: { first: 0.33, second: 0.34, third: 0.33 },
      euPrime: { first: 0.33, second: 0.34, third: 0.33 },
      ocx: { first: 0.33, second: 0.34, third: 0.33 },
      offHours: { first: 0.33, second: 0.34, third: 0.33 },
    },
  }
}

/**
 * Determines which time window a given timestamp falls into
 */
export function getTimeWindow(timestamp: Date, region: 'na' | 'eu'): TimeWindow {
  const hour = timestamp.getUTCHours()

  if (region === 'na') {
    // NA Prime Time: 7 PM - 12 AM ET (00:00 - 05:00 UTC)
    if (hour >= 0 && hour < 5) return 'naPrime'

    // EU Prime Time: 7 PM - 12 AM CET (18:00 - 23:00 UTC)
    if (hour >= 18 && hour < 23) return 'euPrime'

    // OCX/SEA Coverage: 7 PM - 12 AM AEDT (08:00 - 13:00 UTC)
    if (hour >= 8 && hour < 13) return 'ocx'

    // Off Hours: All remaining hours
    return 'offHours'
  } else {
    // EU region - adjust prime time windows
    // EU Prime Time: 7 PM - 12 AM CET (18:00 - 23:00 UTC)
    if (hour >= 18 && hour < 23) return 'euPrime'

    // NA Prime Time: 7 PM - 12 AM ET (00:00 - 05:00 UTC)
    if (hour >= 0 && hour < 5) return 'naPrime'

    // OCX/SEA Coverage: 7 PM - 12 AM AEDT (08:00 - 13:00 UTC)
    if (hour >= 8 && hour < 13) return 'ocx'

    // Off Hours: All remaining hours
    return 'offHours'
  }
}

/**
 * Analyzes historical skirmish data to calculate team statistics
 * Now includes alliance composition tracking for better predictions during relinking
 */
export function analyzeHistoricalPerformance(
  skirmishes: SkirmishResult[],
  teamColor: 'red' | 'blue' | 'green',
  teamName: string,
  region: 'na' | 'eu'
): TeamHistoricalStats {
  const stats: TeamHistoricalStats = {
    teamColor,
    teamName,
    overall: createEmptyTimeWindowStats(),
    byWindow: {
      naPrime: createEmptyTimeWindowStats(),
      euPrime: createEmptyTimeWindowStats(),
      ocx: createEmptyTimeWindowStats(),
      offHours: createEmptyTimeWindowStats(),
    },
    placementProbability: { first: 0, second: 0, third: 0 },
    placementProbabilityByWindow: {
      naPrime: { first: 0, second: 0, third: 0 },
      euPrime: { first: 0, second: 0, third: 0 },
      ocx: { first: 0, second: 0, third: 0 },
      offHours: { first: 0, second: 0, third: 0 },
    },
    byAlliance: new Map<string, AllianceStats>(),
  }

  if (skirmishes.length === 0) {
    // No data - assume equal probabilities
    stats.placementProbability = { first: 0.33, second: 0.34, third: 0.33 }
    stats.placementProbabilityByWindow = {
      naPrime: { first: 0.33, second: 0.34, third: 0.33 },
      euPrime: { first: 0.33, second: 0.34, third: 0.33 },
      ocx: { first: 0.33, second: 0.34, third: 0.33 },
      offHours: { first: 0.33, second: 0.34, third: 0.33 },
    }
    return stats
  }

  // Analyze each skirmish
  let totalScore = 0
  let totalVP = 0

  // Track the most recent alliance composition
  let mostRecentAlliance: { allianceKey: string; worldIds: number[] } | undefined

  for (const skirmish of skirmishes) {
    const window = getTimeWindow(skirmish.timestamp, region)
    const placement = skirmish.placements[teamColor]
    const score = skirmish.scores[teamColor]
    const vp = skirmish.vpAwarded[teamColor]

    // Update overall stats
    stats.overall.totalSkirmishes++
    if (placement === 1) stats.overall.placements.first++
    else if (placement === 2) stats.overall.placements.second++
    else stats.overall.placements.third++
    totalScore += score
    totalVP += vp

    // Update window-specific stats
    stats.byWindow[window].totalSkirmishes++
    if (placement === 1) stats.byWindow[window].placements.first++
    else if (placement === 2) stats.byWindow[window].placements.second++
    else stats.byWindow[window].placements.third++

    // Track alliance-specific performance
    if (skirmish.alliances && skirmish.alliances[teamColor]) {
      const allianceWorldIds = skirmish.alliances[teamColor]
      const allianceKey = createAllianceKey(allianceWorldIds)

      // Get or create alliance stats
      if (!stats.byAlliance.has(allianceKey)) {
        stats.byAlliance.set(allianceKey, createEmptyAllianceStats(allianceWorldIds))
      }
      const allianceStats = stats.byAlliance.get(allianceKey)!

      // Update alliance overall stats
      allianceStats.stats.totalSkirmishes++
      if (placement === 1) allianceStats.stats.placements.first++
      else if (placement === 2) allianceStats.stats.placements.second++
      else allianceStats.stats.placements.third++

      // Update alliance window-specific stats
      allianceStats.statsByWindow[window].totalSkirmishes++
      if (placement === 1) allianceStats.statsByWindow[window].placements.first++
      else if (placement === 2) allianceStats.statsByWindow[window].placements.second++
      else allianceStats.statsByWindow[window].placements.third++

      // Track most recent alliance (for current match predictions)
      mostRecentAlliance = { allianceKey, worldIds: allianceWorldIds }
    }
  }

  // Set current alliance from the most recent skirmish
  if (mostRecentAlliance) {
    stats.currentAlliance = mostRecentAlliance
  }

  // Calculate averages
  stats.overall.averageScore = totalScore / stats.overall.totalSkirmishes
  stats.overall.averageVP = totalVP / stats.overall.totalSkirmishes

  // Calculate probabilities
  const total = stats.overall.totalSkirmishes
  stats.placementProbability = {
    first: stats.overall.placements.first / total,
    second: stats.overall.placements.second / total,
    third: stats.overall.placements.third / total,
  }

  // Calculate probabilities by window
  const windows: TimeWindow[] = ['naPrime', 'euPrime', 'ocx', 'offHours']
  for (const window of windows) {
    const windowTotal = stats.byWindow[window].totalSkirmishes
    if (windowTotal > 0) {
      stats.placementProbabilityByWindow[window] = {
        first: stats.byWindow[window].placements.first / windowTotal,
        second: stats.byWindow[window].placements.second / windowTotal,
        third: stats.byWindow[window].placements.third / windowTotal,
      }
    } else {
      // No data for this window - use overall probabilities
      stats.placementProbabilityByWindow[window] = stats.placementProbability
    }
  }

  // Calculate probabilities for each alliance composition
  for (const [allianceKey, allianceStats] of stats.byAlliance.entries()) {
    const allianceTotal = allianceStats.stats.totalSkirmishes
    if (allianceTotal > 0) {
      // Overall alliance probabilities
      allianceStats.placementProbability = {
        first: allianceStats.stats.placements.first / allianceTotal,
        second: allianceStats.stats.placements.second / allianceTotal,
        third: allianceStats.stats.placements.third / allianceTotal,
      }

      // Alliance probabilities by window
      for (const window of windows) {
        const allianceWindowTotal = allianceStats.statsByWindow[window].totalSkirmishes
        if (allianceWindowTotal > 0) {
          allianceStats.placementProbabilityByWindow[window] = {
            first: allianceStats.statsByWindow[window].placements.first / allianceWindowTotal,
            second: allianceStats.statsByWindow[window].placements.second / allianceWindowTotal,
            third: allianceStats.statsByWindow[window].placements.third / allianceWindowTotal,
          }
        } else {
          // No data for this window - use alliance overall probabilities
          allianceStats.placementProbabilityByWindow[window] = allianceStats.placementProbability
        }
      }
    }
  }

  return stats
}

/**
 * Converts match skirmish data to SkirmishResult format
 * Now includes alliance composition tracking
 */
export function convertMatchSkirmishesToResults(
  skirmishes: Array<{
    id: number
    scores: { red: number; blue: number; green: number }
    vpTier?: { first: number; second: number; third: number }
  }>,
  matchStartDate: Date,
  region: 'na' | 'eu',
  alliances?: {
    red: number[]
    blue: number[]
    green: number[]
  }
): SkirmishResult[] {
  return skirmishes.map((skirmish, index) => {
    // Calculate timestamp (each skirmish is 2 hours)
    const timestamp = new Date(matchStartDate.getTime() + index * 2 * 60 * 60 * 1000)

    // Determine placements based on scores
    const teams = [
      { color: 'red' as const, score: skirmish.scores.red },
      { color: 'blue' as const, score: skirmish.scores.blue },
      { color: 'green' as const, score: skirmish.scores.green },
    ].sort((a, b) => b.score - a.score)

    const placements = {
      red: (teams.findIndex(t => t.color === 'red') + 1) as 1 | 2 | 3,
      blue: (teams.findIndex(t => t.color === 'blue') + 1) as 1 | 2 | 3,
      green: (teams.findIndex(t => t.color === 'green') + 1) as 1 | 2 | 3,
    }

    // Get VP tier
    const vpTier = skirmish.vpTier || getVPTierForTime(timestamp, region)

    // Calculate VP awarded
    const vpAwarded = {
      red: placements.red === 1 ? vpTier.first : placements.red === 2 ? vpTier.second : vpTier.third,
      blue: placements.blue === 1 ? vpTier.first : placements.blue === 2 ? vpTier.second : vpTier.third,
      green: placements.green === 1 ? vpTier.first : placements.green === 2 ? vpTier.second : vpTier.third,
    }

    return {
      skirmishId: skirmish.id,
      timestamp,
      placements,
      scores: skirmish.scores,
      vpAwarded,
      // Include alliance composition if provided
      alliances: alliances ? {
        red: [...alliances.red],
        blue: [...alliances.blue],
        green: [...alliances.green],
      } : undefined,
    }
  })
}

/**
 * Calculates how well a team needs to perform to achieve a desired outcome
 * Returns required win rate and comparison to historical performance
 */
export function calculateRequiredPerformance(
  currentVP: { red: number; blue: number; green: number },
  remainingSkirmishes: number,
  averageVPPerSkirmish: { first: number; second: number; third: number },
  desiredOutcome: { first: 'red' | 'blue' | 'green'; second: 'red' | 'blue' | 'green'; third: 'red' | 'blue' | 'green' },
  historicalStats: { red: TeamHistoricalStats; blue: TeamHistoricalStats; green: TeamHistoricalStats }
): {
  team: 'red' | 'blue' | 'green'
  requiredFirstPlaces: number
  requiredWinRate: number
  historicalWinRate: number
  difficulty: 'easy' | 'moderate' | 'hard' | 'very-hard'
  feasibility: string
}[] {
  const results: {
    team: 'red' | 'blue' | 'green'
    requiredFirstPlaces: number
    requiredWinRate: number
    historicalWinRate: number
    difficulty: 'easy' | 'moderate' | 'hard' | 'very-hard'
    feasibility: string
  }[] = []

  const teams: Array<'red' | 'blue' | 'green'> = ['red', 'blue', 'green']

  for (const team of teams) {
    const stats = historicalStats[team]
    const currentTeamVP = currentVP[team]

    // Find what placement this team needs
    let targetPlacement: 1 | 2 | 3
    if (desiredOutcome.first === team) targetPlacement = 1
    else if (desiredOutcome.second === team) targetPlacement = 2
    else targetPlacement = 3

    // Simple estimation: how many 1st places are needed?
    // This is a rough heuristic - a more accurate calculation would use optimization
    const targetFinalVP = currentVP[desiredOutcome.first] + 100 // Rough target
    const vpDeficit = Math.max(0, targetFinalVP - currentTeamVP)
    const vpPerFirstPlace = averageVPPerSkirmish.first
    const requiredFirstPlaces = Math.ceil(vpDeficit / vpPerFirstPlace)

    const requiredWinRate = Math.min(1, requiredFirstPlaces / remainingSkirmishes)
    const historicalWinRate = stats.placementProbability.first

    let difficulty: 'easy' | 'moderate' | 'hard' | 'very-hard'
    if (requiredWinRate <= historicalWinRate * 1.2) {
      difficulty = 'easy'
    } else if (requiredWinRate <= historicalWinRate * 1.5) {
      difficulty = 'moderate'
    } else if (requiredWinRate <= historicalWinRate * 2) {
      difficulty = 'hard'
    } else {
      difficulty = 'very-hard'
    }

    const feasibility =
      requiredWinRate <= historicalWinRate ?
        `On track - historically wins ${(historicalWinRate * 100).toFixed(1)}%` :
      requiredWinRate <= historicalWinRate * 1.5 ?
        `Challenging - needs ${(requiredWinRate * 100).toFixed(1)}% vs historical ${(historicalWinRate * 100).toFixed(1)}%` :
        `Very difficult - needs ${(requiredWinRate * 100).toFixed(1)}% vs historical ${(historicalWinRate * 100).toFixed(1)}%`

    results.push({
      team,
      requiredFirstPlaces,
      requiredWinRate,
      historicalWinRate,
      difficulty,
      feasibility,
    })
  }

  return results
}
