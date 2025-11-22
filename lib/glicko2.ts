/**
 * Glicko-2 Rating System Implementation
 *
 * Based on Mark Glickman's Glicko-2 rating system.
 * Paper: http://www.glicko.net/glicko/glicko2.pdf
 *
 * The Glicko-2 system tracks three values for each player/team:
 * - Rating (r): Skill level (1500 is average)
 * - Rating Deviation (RD): Uncertainty in the rating (lower = more certain)
 * - Volatility (σ): Consistency of performance (lower = more consistent)
 *
 * This implementation is tailored for Guild Wars 2 WvW alliance guilds.
 */

// ==============================================================================
// TYPES & INTERFACES
// ==============================================================================

/**
 * Glicko-2 rating for an alliance guild
 */
export interface GlickoRating {
  rating: number           // μ (mu) - skill rating (default: 1500)
  ratingDeviation: number  // φ (phi) - uncertainty (default: 350, min: 30)
  volatility: number       // σ (sigma) - consistency (default: 0.06)
  lastUpdated?: Date       // When rating was last updated
  matchCount?: number      // Number of matches played (for tracking)
}

/**
 * Match result for rating calculation
 * In WvW, we have 3-team matches, so we track placement (1st, 2nd, 3rd)
 */
export interface MatchResult {
  allianceGuildId: string
  placement: 1 | 2 | 3  // 1st, 2nd, or 3rd place
  opponents: {
    allianceGuildId: string
    rating: GlickoRating
    placement: 1 | 2 | 3
  }[]
}

/**
 * Prediction for a match outcome
 */
export interface MatchPrediction {
  expectedPlacements: {
    [allianceGuildId: string]: {
      first: number   // Probability of 1st place
      second: number  // Probability of 2nd place
      third: number   // Probability of 3rd place
    }
  }
  confidence: number  // Overall confidence in prediction (0-1)
  mostLikelyOutcome: {
    first: string   // Alliance guild ID
    second: string
    third: string
  }
}

// ==============================================================================
// CONSTANTS
// ==============================================================================

/**
 * System constant τ (tau) - constrains volatility changes
 * Typical values: 0.3 to 1.2
 * Lower = more stable volatility, Higher = more responsive to upsets
 *
 * For WvW, we use 0.5 as alliances can have significant week-to-week variation
 */
export const TAU = 0.5

/**
 * Default starting rating (1500 is average)
 */
export const DEFAULT_RATING = 1500

/**
 * Default starting rating deviation (high uncertainty for new guilds)
 */
export const DEFAULT_RD = 350

/**
 * Minimum rating deviation (high certainty)
 */
export const MIN_RD = 30

/**
 * Default volatility (moderate consistency)
 */
export const DEFAULT_VOLATILITY = 0.06

/**
 * Glicko-2 scale constant
 * Converts Glicko-1 scale to Glicko-2 scale
 */
const GLICKO2_SCALE = 173.7178

/**
 * Convergence tolerance for iterative calculations
 */
const CONVERGENCE_TOLERANCE = 0.000001

// ==============================================================================
// CORE GLICKO-2 FUNCTIONS
// ==============================================================================

/**
 * Convert rating from Glicko-1 scale to Glicko-2 scale
 */
function toGlicko2Scale(rating: number): number {
  return (rating - DEFAULT_RATING) / GLICKO2_SCALE
}

/**
 * Convert rating from Glicko-2 scale back to Glicko-1 scale
 */
function fromGlicko2Scale(mu: number): number {
  return mu * GLICKO2_SCALE + DEFAULT_RATING
}

/**
 * Convert rating deviation from Glicko-1 to Glicko-2 scale
 */
function rdToGlicko2Scale(rd: number): number {
  return rd / GLICKO2_SCALE
}

/**
 * Convert rating deviation from Glicko-2 back to Glicko-1 scale
 */
function rdFromGlicko2Scale(phi: number): number {
  return phi * GLICKO2_SCALE
}

/**
 * g function - reduces impact of uncertainty
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

/**
 * E function - expected score against opponent
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)))
}

/**
 * Calculate variance of rating based on opponents
 */
function calculateVariance(
  mu: number,
  opponents: Array<{ mu: number; phi: number }>
): number {
  let sum = 0
  for (const opp of opponents) {
    const gPhi = g(opp.phi)
    const e = E(mu, opp.mu, opp.phi)
    sum += gPhi * gPhi * e * (1 - e)
  }
  return 1 / sum
}

/**
 * Calculate delta - improvement in rating based on performance
 */
function calculateDelta(
  mu: number,
  variance: number,
  opponents: Array<{ mu: number; phi: number; score: number }>
): number {
  let sum = 0
  for (const opp of opponents) {
    const gPhi = g(opp.phi)
    const e = E(mu, opp.mu, opp.phi)
    sum += gPhi * (opp.score - e)
  }
  return variance * sum
}

/**
 * f function - used in volatility calculation
 */
function f(
  x: number,
  delta: number,
  phi: number,
  variance: number,
  a: number
): number {
  const ex = Math.exp(x)
  const phi2 = phi * phi
  const term1 = (ex * (delta * delta - phi2 - variance - ex)) / (2 * Math.pow(phi2 + variance + ex, 2))
  const term2 = (x - a) / (TAU * TAU)
  return term1 - term2
}

/**
 * Calculate new volatility using Illinois algorithm
 */
function calculateNewVolatility(
  sigma: number,
  phi: number,
  delta: number,
  variance: number
): number {
  const a = Math.log(sigma * sigma)

  // Set initial values
  let A = a
  let B: number

  const deltaSq = delta * delta
  const phi2 = phi * phi

  if (deltaSq > phi2 + variance) {
    B = Math.log(deltaSq - phi2 - variance)
  } else {
    let k = 1
    while (f(a - k * TAU, delta, phi, variance, a) < 0) {
      k++
    }
    B = a - k * TAU
  }

  // Perform iterative calculation
  let fA = f(A, delta, phi, variance, a)
  let fB = f(B, delta, phi, variance, a)

  while (Math.abs(B - A) > CONVERGENCE_TOLERANCE) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C, delta, phi, variance, a)

    if (fC * fB < 0) {
      A = B
      fA = fB
    } else {
      fA = fA / 2
    }

    B = C
    fB = fC
  }

  return Math.exp(A / 2)
}

/**
 * Increase rating deviation for periods of inactivity
 *
 * @param rating Current rating
 * @param periodsSinceLastCompetition Number of rating periods without activity
 * @returns Updated rating with increased RD
 */
export function applyRatingDecay(
  rating: GlickoRating,
  periodsSinceLastCompetition: number
): GlickoRating {
  if (periodsSinceLastCompetition <= 0) return rating

  const phi = rdToGlicko2Scale(rating.ratingDeviation)
  const sigma = rating.volatility

  let newPhi = phi
  for (let i = 0; i < periodsSinceLastCompetition; i++) {
    newPhi = Math.sqrt(newPhi * newPhi + sigma * sigma)
  }

  return {
    ...rating,
    ratingDeviation: Math.min(DEFAULT_RD, rdFromGlicko2Scale(newPhi)),
    lastUpdated: new Date(),
  }
}

// ==============================================================================
// RATING UPDATE
// ==============================================================================

/**
 * Update a guild's Glicko-2 rating based on match result
 *
 * @param currentRating Current rating
 * @param matchResult Result of the match including opponents
 * @returns Updated rating
 */
export function updateRating(
  currentRating: GlickoRating,
  matchResult: MatchResult
): GlickoRating {
  // Convert to Glicko-2 scale
  const mu = toGlicko2Scale(currentRating.rating)
  const phi = rdToGlicko2Scale(currentRating.ratingDeviation)
  const sigma = currentRating.volatility

  // Convert opponents to Glicko-2 scale and calculate scores
  const opponents = matchResult.opponents.map(opp => {
    // Score based on placement difference
    // Beat opponent = 1, Lost to opponent = 0
    const score = matchResult.placement < opp.placement ? 1 : 0

    return {
      mu: toGlicko2Scale(opp.rating.rating),
      phi: rdToGlicko2Scale(opp.rating.ratingDeviation),
      score,
    }
  })

  // Step 1: Calculate variance
  const variance = calculateVariance(mu, opponents)

  // Step 2: Calculate delta
  const delta = calculateDelta(mu, variance, opponents)

  // Step 3: Calculate new volatility
  const newSigma = calculateNewVolatility(sigma, phi, delta, variance)

  // Step 4: Update phi (pre-rating period value)
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma)

  // Step 5: Update rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance)
  const newMu = mu + newPhi * newPhi * opponents.reduce((sum, opp) => {
    return sum + g(opp.phi) * (opp.score - E(mu, opp.mu, opp.phi))
  }, 0)

  // Convert back to Glicko-1 scale
  return {
    rating: fromGlicko2Scale(newMu),
    ratingDeviation: Math.max(MIN_RD, rdFromGlicko2Scale(newPhi)),
    volatility: newSigma,
    lastUpdated: new Date(),
    matchCount: (currentRating.matchCount || 0) + 1,
  }
}

/**
 * Update ratings for all guilds in a match
 *
 * @param matchResults Array of match results for each guild
 * @param currentRatings Map of guild ID to current rating
 * @returns Map of guild ID to updated rating
 */
export function updateRatingsForMatch(
  matchResults: MatchResult[],
  currentRatings: Map<string, GlickoRating>
): Map<string, GlickoRating> {
  const updatedRatings = new Map<string, GlickoRating>()

  for (const result of matchResults) {
    const currentRating = currentRatings.get(result.allianceGuildId)
    if (!currentRating) {
      console.warn(`No rating found for alliance guild ${result.allianceGuildId}`)
      continue
    }

    const updatedRating = updateRating(currentRating, result)
    updatedRatings.set(result.allianceGuildId, updatedRating)
  }

  return updatedRatings
}

// ==============================================================================
// PREDICTION
// ==============================================================================

/**
 * Calculate expected score between two guilds
 *
 * @param rating1 First guild's rating
 * @param rating2 Second guild's rating
 * @returns Expected score for first guild (0-1)
 */
export function calculateExpectedScore(
  rating1: GlickoRating,
  rating2: GlickoRating
): number {
  const mu1 = toGlicko2Scale(rating1.rating)
  const mu2 = toGlicko2Scale(rating2.rating)
  const phi2 = rdToGlicko2Scale(rating2.ratingDeviation)

  return E(mu1, mu2, phi2)
}

/**
 * Predict outcome of a 3-team WvW match using Glicko-2 ratings
 *
 * Uses pairwise comparisons to estimate placement probabilities
 *
 * @param guilds Array of alliance guild IDs and their ratings
 * @returns Match prediction with probabilities
 */
export function predictMatchOutcome(
  guilds: Array<{ id: string; rating: GlickoRating }>
): MatchPrediction {
  if (guilds.length !== 3) {
    throw new Error('predictMatchOutcome requires exactly 3 guilds')
  }

  // Calculate pairwise expected scores
  const expectedScores: number[][] = []
  for (let i = 0; i < 3; i++) {
    expectedScores[i] = []
    for (let j = 0; j < 3; j++) {
      if (i === j) {
        expectedScores[i][j] = 0.5 // Tie with self
      } else {
        expectedScores[i][j] = calculateExpectedScore(guilds[i].rating, guilds[j].rating)
      }
    }
  }

  // Estimate placement probabilities using Bradley-Terry model extension
  // P(i beats j) ≈ expected score
  // P(1st place) ≈ P(beat both opponents)
  // P(2nd place) ≈ P(beat one, lose to one)
  // P(3rd place) ≈ P(lose to both)

  const placements = guilds.map((guild, i) => {
    const others = [0, 1, 2].filter(j => j !== i)

    // Probability of beating both opponents (1st place)
    const pFirst = expectedScores[i][others[0]] * expectedScores[i][others[1]]

    // Probability of losing to both opponents (3rd place)
    const pThird = (1 - expectedScores[i][others[0]]) * (1 - expectedScores[i][others[1]])

    // Probability of 2nd place (remaining probability)
    const pSecond = 1 - pFirst - pThird

    return {
      id: guild.id,
      first: pFirst,
      second: pSecond,
      third: pThird,
    }
  })

  // Find most likely outcome
  const sortedByRating = [...guilds].sort((a, b) => b.rating.rating - a.rating.rating)

  // Calculate confidence based on rating deviations
  const avgRD = guilds.reduce((sum, g) => sum + g.rating.ratingDeviation, 0) / guilds.length
  const confidence = Math.max(0, Math.min(1, 1 - avgRD / DEFAULT_RD))

  const expectedPlacements: { [key: string]: { first: number; second: number; third: number } } = {}
  placements.forEach(p => {
    expectedPlacements[p.id] = {
      first: p.first,
      second: p.second,
      third: p.third,
    }
  })

  return {
    expectedPlacements,
    confidence,
    mostLikelyOutcome: {
      first: sortedByRating[0].id,
      second: sortedByRating[1].id,
      third: sortedByRating[2].id,
    },
  }
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

/**
 * Create a default Glicko-2 rating for a new alliance guild
 */
export function createDefaultRating(): GlickoRating {
  return {
    rating: DEFAULT_RATING,
    ratingDeviation: DEFAULT_RD,
    volatility: DEFAULT_VOLATILITY,
    lastUpdated: new Date(),
    matchCount: 0,
  }
}

/**
 * Check if a rating needs decay due to inactivity
 *
 * @param rating Rating to check
 * @param currentDate Current date
 * @param ratingPeriodDays Days per rating period (default: 7 for weekly WvW)
 * @returns Number of rating periods since last update
 */
export function getRatingPeriodsSinceUpdate(
  rating: GlickoRating,
  currentDate: Date = new Date(),
  ratingPeriodDays: number = 7
): number {
  if (!rating.lastUpdated) return 0

  const daysSinceUpdate = (currentDate.getTime() - new Date(rating.lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
  return Math.floor(daysSinceUpdate / ratingPeriodDays)
}

/**
 * Get rating display tier for UI
 */
export function getRatingTier(rating: number): {
  tier: string
  color: string
  range: string
} {
  if (rating >= 2200) return { tier: 'Legendary', color: '#FF9500', range: '2200+' }
  if (rating >= 2000) return { tier: 'Diamond', color: '#B9F2FF', range: '2000-2199' }
  if (rating >= 1800) return { tier: 'Platinum', color: '#00D4AA', range: '1800-1999' }
  if (rating >= 1600) return { tier: 'Gold', color: '#FFD700', range: '1600-1799' }
  if (rating >= 1400) return { tier: 'Silver', color: '#C0C0C0', range: '1400-1599' }
  if (rating >= 1200) return { tier: 'Bronze', color: '#CD7F32', range: '1200-1399' }
  return { tier: 'Iron', color: '#808080', range: '0-1199' }
}
