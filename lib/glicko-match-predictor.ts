/**
 * Glicko-2 Match Prediction Integration
 *
 * This module integrates Glicko-2 ratings with the existing WvW match
 * prediction system, providing accurate predictions based on alliance
 * guild skill ratings.
 */

import type { IGuild } from '@/server/queries'
import {
  type GlickoRating,
  type MatchPrediction,
  createDefaultRating,
  predictMatchOutcome,
  getRatingPeriodsSinceUpdate,
  applyRatingDecay,
} from './glicko2'
import type { TeamHistoricalStats, TimeWindow } from './historical-performance'

// ==============================================================================
// TYPES
// ==============================================================================

/**
 * Alliance guild composition for a team
 */
export interface TeamAllianceComposition {
  teamColor: 'red' | 'blue' | 'green'
  allianceGuilds: Array<{
    id: string
    name: string
    tag: string
    rating: GlickoRating
  }>
  combinedRating: GlickoRating  // Aggregate rating for the team
}

/**
 * Enhanced prediction using Glicko ratings
 */
export interface GlickoMatchPrediction extends MatchPrediction {
  teamRatings: {
    red: GlickoRating
    blue: GlickoRating
    green: GlickoRating
  }
  ratingDifferences: {
    redVsBlue: number
    redVsGreen: number
    blueVsGreen: number
  }
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Get alliance guilds on specific worlds
 *
 * @param worldIds Array of world IDs
 * @param allGuilds All guilds in the system
 * @returns Array of alliance guilds on those worlds
 */
export function getAllianceGuildsForWorlds(
  worldIds: number[],
  allGuilds: IGuild[]
): IGuild[] {
  return allGuilds.filter(
    guild =>
      guild.classification === 'alliance' &&
      worldIds.includes(guild.worldId)
  )
}

/**
 * Get Glicko rating for a guild, creating default if doesn't exist
 *
 * @param guild Guild to get rating for
 * @returns Glicko rating
 */
export function getGuildRating(guild: IGuild): GlickoRating {
  // Check if guild has Glicko rating fields
  const guildWithRating = guild as IGuild & { glickoRating?: GlickoRating }

  if (guildWithRating.glickoRating) {
    // Apply decay if guild hasn't played recently
    const periodsSinceUpdate = getRatingPeriodsSinceUpdate(guildWithRating.glickoRating)
    if (periodsSinceUpdate > 0) {
      return applyRatingDecay(guildWithRating.glickoRating, periodsSinceUpdate)
    }
    return guildWithRating.glickoRating
  }

  // Return default rating for new guilds
  return createDefaultRating()
}

/**
 * Combine ratings of multiple alliance guilds into a single team rating
 *
 * Uses weighted average based on rating certainty (inverse of RD)
 *
 * @param ratings Array of Glicko ratings
 * @returns Combined rating for the team
 */
export function combineGuildRatings(ratings: GlickoRating[]): GlickoRating {
  if (ratings.length === 0) {
    return createDefaultRating()
  }

  if (ratings.length === 1) {
    return ratings[0]
  }

  // Weight each rating by certainty (inverse of rating deviation)
  const weights = ratings.map(r => 1 / r.ratingDeviation)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  const combinedRating = ratings.reduce((sum, r, i) => {
    return sum + (r.rating * weights[i]) / totalWeight
  }, 0)

  // Combined RD: Use minimum RD (most certain guild sets the floor)
  const combinedRD = Math.min(...ratings.map(r => r.ratingDeviation))

  // Combined volatility: Average volatility
  const combinedVolatility = ratings.reduce((sum, r) => sum + r.volatility, 0) / ratings.length

  // Combined match count: Sum of all guilds' match counts
  const combinedMatchCount = ratings.reduce((sum, r) => sum + (r.matchCount || 0), 0)

  return {
    rating: combinedRating,
    ratingDeviation: combinedRD,
    volatility: combinedVolatility,
    matchCount: combinedMatchCount,
    lastUpdated: new Date(),
  }
}

// ==============================================================================
// TEAM COMPOSITION ANALYSIS
// ==============================================================================

/**
 * Get team composition with alliance guilds and ratings
 *
 * @param worldIds World IDs for the team
 * @param teamColor Team color
 * @param allGuilds All guilds in the system
 * @returns Team composition with ratings
 */
export function getTeamComposition(
  worldIds: number[],
  teamColor: 'red' | 'blue' | 'green',
  allGuilds: IGuild[]
): TeamAllianceComposition {
  const allianceGuilds = getAllianceGuildsForWorlds(worldIds, allGuilds)

  const guildsWithRatings = allianceGuilds.map(guild => ({
    id: guild.id,
    name: guild.name,
    tag: guild.tag,
    rating: getGuildRating(guild),
  }))

  const combinedRating = combineGuildRatings(guildsWithRatings.map(g => g.rating))

  return {
    teamColor,
    allianceGuilds: guildsWithRatings,
    combinedRating,
  }
}

// ==============================================================================
// MATCH PREDICTION
// ==============================================================================

/**
 * Predict match outcome using Glicko-2 ratings
 *
 * @param teams Team compositions with ratings
 * @returns Enhanced prediction with Glicko ratings
 */
export function predictMatchWithGlicko(
  teams: {
    red: TeamAllianceComposition
    blue: TeamAllianceComposition
    green: TeamAllianceComposition
  }
): GlickoMatchPrediction {
  const guilds = [
    { id: 'red', rating: teams.red.combinedRating },
    { id: 'blue', rating: teams.blue.combinedRating },
    { id: 'green', rating: teams.green.combinedRating },
  ]

  const prediction = predictMatchOutcome(guilds)

  const teamRatings = {
    red: teams.red.combinedRating,
    blue: teams.blue.combinedRating,
    green: teams.green.combinedRating,
  }

  const ratingDifferences = {
    redVsBlue: teams.red.combinedRating.rating - teams.blue.combinedRating.rating,
    redVsGreen: teams.red.combinedRating.rating - teams.green.combinedRating.rating,
    blueVsGreen: teams.blue.combinedRating.rating - teams.green.combinedRating.rating,
  }

  return {
    ...prediction,
    teamRatings,
    ratingDifferences,
  }
}

/**
 * Predict match outcome from match data
 *
 * @param matchData Match data including world assignments
 * @param allGuilds All guilds in the system
 * @returns Match prediction
 */
export function predictMatchFromData(
  matchData: {
    all_worlds: Array<{
      id: number
      color: 'red' | 'blue' | 'green'
    }>
  },
  allGuilds: IGuild[]
): GlickoMatchPrediction {
  // Extract world IDs by team color
  const redWorlds = matchData.all_worlds
    .filter(w => w.color === 'red')
    .map(w => w.id)
  const blueWorlds = matchData.all_worlds
    .filter(w => w.color === 'blue')
    .map(w => w.id)
  const greenWorlds = matchData.all_worlds
    .filter(w => w.color === 'green')
    .map(w => w.id)

  // Get team compositions
  const teams = {
    red: getTeamComposition(redWorlds, 'red', allGuilds),
    blue: getTeamComposition(blueWorlds, 'blue', allGuilds),
    green: getTeamComposition(greenWorlds, 'green', allGuilds),
  }

  return predictMatchWithGlicko(teams)
}

// ==============================================================================
// INTEGRATION WITH MONTE CARLO SIMULATOR
// ==============================================================================

/**
 * Convert Glicko prediction to placement probabilities for Monte Carlo
 *
 * This allows using Glicko ratings as input to the Monte Carlo simulator
 *
 * @param prediction Glicko match prediction
 * @param timeWindow Time window for the simulation
 * @returns Placement probabilities by team
 */
export function glickoToMonteCarloProbabilities(
  prediction: GlickoMatchPrediction,
  timeWindow?: TimeWindow
): {
  red: { first: number; second: number; third: number }
  blue: { first: number; second: number; third: number }
  green: { first: number; second: number; third: number }
} {
  // Use Glicko predictions directly as placement probabilities
  // This provides more accurate probabilities than historical data alone

  return {
    red: prediction.expectedPlacements['red'],
    blue: prediction.expectedPlacements['blue'],
    green: prediction.expectedPlacements['green'],
  }
}

/**
 * Enhance historical stats with Glicko ratings
 *
 * This creates a hybrid approach: use Glicko for base probabilities,
 * adjusted by time window patterns from historical data
 *
 * @param historicalStats Historical performance statistics
 * @param glickoPrediction Glicko-based prediction
 * @returns Enhanced stats combining both approaches
 */
export function enhanceHistoricalStatsWithGlicko(
  historicalStats: TeamHistoricalStats,
  glickoPrediction: GlickoMatchPrediction
): TeamHistoricalStats {
  const teamColor = historicalStats.teamColor
  const glickoProbs = glickoPrediction.expectedPlacements[teamColor]

  // If we have sufficient historical data, blend with Glicko
  // Otherwise, use Glicko ratings directly
  const hasHistoricalData = historicalStats.overall.totalSkirmishes >= 10

  if (!hasHistoricalData) {
    // Use Glicko probabilities for all time windows
    return {
      ...historicalStats,
      placementProbability: glickoProbs,
      placementProbabilityByWindow: {
        naPrime: glickoProbs,
        euPrime: glickoProbs,
        ocx: glickoProbs,
        offHours: glickoProbs,
      },
    }
  }

  // Blend historical time window patterns with Glicko base probabilities
  // This preserves time-of-day performance variations while using accurate skill ratings
  const windows: TimeWindow[] = ['naPrime', 'euPrime', 'ocx', 'offHours']
  const enhancedByWindow: Record<TimeWindow, { first: number; second: number; third: number }> = {
    naPrime: glickoProbs,
    euPrime: glickoProbs,
    ocx: glickoProbs,
    offHours: glickoProbs,
  }

  for (const window of windows) {
    const windowStats = historicalStats.byWindow[window]
    if (windowStats.totalSkirmishes >= 5) {
      // Calculate performance adjustment for this window vs overall
      const windowFirst = historicalStats.placementProbabilityByWindow[window].first
      const overallFirst = historicalStats.placementProbability.first
      const adjustment = overallFirst > 0 ? windowFirst / overallFirst : 1

      // Apply adjustment to Glicko probabilities
      enhancedByWindow[window] = {
        first: Math.min(1, glickoProbs.first * adjustment),
        second: glickoProbs.second,
        third: Math.max(0, 1 - glickoProbs.first * adjustment - glickoProbs.second),
      }
    }
  }

  return {
    ...historicalStats,
    placementProbability: glickoProbs,
    placementProbabilityByWindow: enhancedByWindow,
  }
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

/**
 * Get rating summary for display
 */
export function getRatingSummary(rating: GlickoRating): {
  rating: number
  displayRating: string
  confidence: string
  matchCount: number
} {
  const confidencePercent = Math.max(0, Math.min(100, ((350 - rating.ratingDeviation) / 320) * 100))

  return {
    rating: Math.round(rating.rating),
    displayRating: `${Math.round(rating.rating)} ± ${Math.round(rating.ratingDeviation)}`,
    confidence: `${Math.round(confidencePercent)}%`,
    matchCount: rating.matchCount || 0,
  }
}

/**
 * Compare two teams and get expected outcome
 */
export function compareTeams(
  team1: TeamAllianceComposition,
  team2: TeamAllianceComposition
): {
  favorite: 'red' | 'blue' | 'green' | 'even'
  ratingDifference: number
  expectedWinProbability: number
} {
  const diff = team1.combinedRating.rating - team2.combinedRating.rating

  let favorite: 'red' | 'blue' | 'green' | 'even'
  if (Math.abs(diff) < 50) {
    favorite = 'even'
  } else {
    favorite = diff > 0 ? team1.teamColor : team2.teamColor
  }

  // Simple win probability estimate (not exact for 3-team match)
  const expectedWinProb = 1 / (1 + Math.pow(10, -diff / 400))

  return {
    favorite,
    ratingDifference: Math.abs(diff),
    expectedWinProbability: expectedWinProb,
  }
}
