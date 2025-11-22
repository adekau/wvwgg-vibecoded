/**
 * Lambda Function: Update Glicko-2 Ratings
 *
 * This function runs after WvW matches complete to update alliance guild ratings.
 *
 * Trigger: EventBridge schedule (runs every Friday at 18:05 UTC, 5 minutes after match reset)
 *
 * Process:
 * 1. Fetch completed matches from the previous week
 * 2. Get final standings (1st, 2nd, 3rd by Victory Points)
 * 3. Get alliance guilds for each team
 * 4. Calculate new Glicko-2 ratings based on match results
 * 5. Update ratings in DynamoDB
 *
 * Dependencies:
 * - Requires get-matches Lambda to have run first (to get match data)
 * - Requires guild data to be populated in DynamoDB
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

// ============================================================================
// TYPES
// ============================================================================

interface GlickoRating {
  rating: number
  ratingDeviation: number
  volatility: number
  lastUpdated: string
  matchCount: number
}

interface Guild {
  id: string
  name: string
  tag: string
  worldId: number
  classification?: 'alliance' | 'member' | 'independent'
  glickoRating?: GlickoRating
}

interface MatchResult {
  allianceGuildId: string
  placement: 1 | 2 | 3
  opponents: {
    allianceGuildId: string
    rating: GlickoRating
    placement: 1 | 2 | 3
  }[]
}

interface WorldTeam {
  id: number
  color: 'red' | 'blue' | 'green'
  victoryPoints: number
}

interface Match {
  id: string
  all_worlds: WorldTeam[]
  red?: { victoryPoints: number }
  blue?: { victoryPoints: number }
  green?: { victoryPoints: number }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_RATING = 1500
const DEFAULT_RD = 350
const MIN_RD = 30
const DEFAULT_VOLATILITY = 0.06
const TAU = 0.5
const GLICKO2_SCALE = 173.7178
const CONVERGENCE_TOLERANCE = 0.000001

// ============================================================================
// DYNAMODB CLIENT
// ============================================================================

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

// ============================================================================
// GLICKO-2 ALGORITHM (Simplified for Lambda)
// ============================================================================

function toGlicko2Scale(rating: number): number {
  return (rating - DEFAULT_RATING) / GLICKO2_SCALE
}

function fromGlicko2Scale(mu: number): number {
  return mu * GLICKO2_SCALE + DEFAULT_RATING
}

function rdToGlicko2Scale(rd: number): number {
  return rd / GLICKO2_SCALE
}

function rdFromGlicko2Scale(phi: number): number {
  return phi * GLICKO2_SCALE
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)))
}

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

function calculateNewVolatility(
  sigma: number,
  phi: number,
  delta: number,
  variance: number
): number {
  const a = Math.log(sigma * sigma)

  function f(x: number): number {
    const ex = Math.exp(x)
    const phi2 = phi * phi
    const term1 = (ex * (delta * delta - phi2 - variance - ex)) / (2 * Math.pow(phi2 + variance + ex, 2))
    const term2 = (x - a) / (TAU * TAU)
    return term1 - term2
  }

  let A = a
  let B: number

  const deltaSq = delta * delta
  const phi2 = phi * phi

  if (deltaSq > phi2 + variance) {
    B = Math.log(deltaSq - phi2 - variance)
  } else {
    let k = 1
    while (f(a - k * TAU) < 0) {
      k++
    }
    B = a - k * TAU
  }

  let fA = f(A)
  let fB = f(B)

  while (Math.abs(B - A) > CONVERGENCE_TOLERANCE) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)

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

function updateRating(
  currentRating: GlickoRating,
  matchResult: MatchResult
): GlickoRating {
  const mu = toGlicko2Scale(currentRating.rating)
  const phi = rdToGlicko2Scale(currentRating.ratingDeviation)
  const sigma = currentRating.volatility

  const opponents = matchResult.opponents.map(opp => {
    const score = matchResult.placement < opp.placement ? 1 : 0
    return {
      mu: toGlicko2Scale(opp.rating.rating),
      phi: rdToGlicko2Scale(opp.rating.ratingDeviation),
      score,
    }
  })

  const variance = calculateVariance(mu, opponents)
  const delta = calculateDelta(mu, variance, opponents)
  const newSigma = calculateNewVolatility(sigma, phi, delta, variance)
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma)
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance)
  const newMu = mu + newPhi * newPhi * opponents.reduce((sum, opp) => {
    return sum + g(opp.phi) * (opp.score - E(mu, opp.mu, opp.phi))
  }, 0)

  return {
    rating: fromGlicko2Scale(newMu),
    ratingDeviation: Math.max(MIN_RD, rdFromGlicko2Scale(newPhi)),
    volatility: newSigma,
    lastUpdated: new Date().toISOString(),
    matchCount: currentRating.matchCount + 1,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createDefaultRating(): GlickoRating {
  return {
    rating: DEFAULT_RATING,
    ratingDeviation: DEFAULT_RD,
    volatility: DEFAULT_VOLATILITY,
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
  }
}

async function getAllGuilds(): Promise<Guild[]> {
  const allItems: any[] = []
  let lastEvaluatedKey: Record<string, any> | undefined

  do {
    const response = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
          '#data': 'data',
        },
        ExpressionAttributeValues: { ':type': 'guild' },
        ProjectionExpression: 'id, #data, classification, glickoRating',
        ExclusiveStartKey: lastEvaluatedKey,
      })
    )

    if (response.Items) {
      allItems.push(...response.Items)
    }

    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return allItems.map(item => ({
    id: item.id,
    name: item.data?.name || '',
    tag: item.data?.tag || '',
    worldId: parseInt(item.data?.worldId) || 0,
    classification: item.classification,
    glickoRating: item.glickoRating,
  }))
}

async function getCompletedMatches(): Promise<Match[]> {
  const response = await docClient.send(
    new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { type: 'matches', id: 'all' },
    })
  )

  if (!response.Item?.data) {
    return []
  }

  const matches = response.Item.data
  return Object.values(matches) as Match[]
}

function getAllianceGuildsForWorlds(
  worldIds: number[],
  allGuilds: Guild[]
): Guild[] {
  return allGuilds.filter(
    guild =>
      guild.classification === 'alliance' &&
      worldIds.includes(guild.worldId)
  )
}

function determineMatchPlacements(match: Match): {
  red: number
  blue: number
  green: number
} {
  const vp = {
    red: match.red?.victoryPoints || 0,
    blue: match.blue?.victoryPoints || 0,
    green: match.green?.victoryPoints || 0,
  }

  const sorted = Object.entries(vp).sort((a, b) => b[1] - a[1])

  const placements = { red: 3, blue: 3, green: 3 }
  sorted.forEach((entry, index) => {
    const color = entry[0] as 'red' | 'blue' | 'green'
    placements[color] = (index + 1) as 1 | 2 | 3
  })

  return placements
}

async function updateGuildRating(guildId: string, newRating: GlickoRating): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: process.env.TABLE_NAME,
      Key: { type: 'guild', id: guildId },
      UpdateExpression: 'SET glickoRating = :rating',
      ExpressionAttributeValues: {
        ':rating': newRating,
      },
    })
  )
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event: any) => {
  console.log('[GLICKO-UPDATE] Starting rating update process')

  try {
    // 1. Get all guilds
    console.log('[GLICKO-UPDATE] Fetching guilds...')
    const allGuilds = await getAllGuilds()
    const allianceGuilds = allGuilds.filter(g => g.classification === 'alliance')
    console.log(`[GLICKO-UPDATE] Found ${allianceGuilds.length} alliance guilds`)

    // 2. Get completed matches
    console.log('[GLICKO-UPDATE] Fetching completed matches...')
    const matches = await getCompletedMatches()
    console.log(`[GLICKO-UPDATE] Found ${matches.length} matches`)

    // 3. Process each match
    const ratingUpdates = new Map<string, GlickoRating>()

    for (const match of matches) {
      if (!match.all_worlds || match.all_worlds.length === 0) {
        console.log(`[GLICKO-UPDATE] Skipping match ${match.id} - no world data`)
        continue
      }

      // Get team compositions
      const redWorlds = match.all_worlds.filter(w => w.color === 'red').map(w => w.id)
      const blueWorlds = match.all_worlds.filter(w => w.color === 'blue').map(w => w.id)
      const greenWorlds = match.all_worlds.filter(w => w.color === 'green').map(w => w.id)

      const redGuilds = getAllianceGuildsForWorlds(redWorlds, allianceGuilds)
      const blueGuilds = getAllianceGuildsForWorlds(blueWorlds, allianceGuilds)
      const greenGuilds = getAllianceGuildsForWorlds(greenWorlds, allianceGuilds)

      // Determine placements
      const placements = determineMatchPlacements(match)

      console.log(`[GLICKO-UPDATE] Match ${match.id} placements:`, placements)

      // Update ratings for all guilds in this match
      const allMatchGuilds = [
        ...redGuilds.map(g => ({ ...g, color: 'red' as const })),
        ...blueGuilds.map(g => ({ ...g, color: 'blue' as const })),
        ...greenGuilds.map(g => ({ ...g, color: 'green' as const })),
      ]

      for (const guild of allMatchGuilds) {
        const currentRating = guild.glickoRating || createDefaultRating()
        const guildPlacement = placements[guild.color]

        // Get opponent guilds and their ratings
        const opponents = allMatchGuilds
          .filter(g => g.color !== guild.color)
          .map(g => ({
            allianceGuildId: g.id,
            rating: g.glickoRating || createDefaultRating(),
            placement: placements[g.color] as 1 | 2 | 3,
          }))

        const matchResult: MatchResult = {
          allianceGuildId: guild.id,
          placement: guildPlacement as 1 | 2 | 3,
          opponents,
        }

        const newRating = updateRating(currentRating, matchResult)
        ratingUpdates.set(guild.id, newRating)

        console.log(
          `[GLICKO-UPDATE] ${guild.name} [${guild.tag}]: ${Math.round(currentRating.rating)} → ${Math.round(newRating.rating)}`
        )
      }
    }

    // 4. Write updates to DynamoDB
    console.log(`[GLICKO-UPDATE] Writing ${ratingUpdates.size} rating updates...`)

    for (const [guildId, newRating] of ratingUpdates.entries()) {
      await updateGuildRating(guildId, newRating)
    }

    console.log('[GLICKO-UPDATE] Rating update complete!')

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Glicko ratings updated successfully',
        guildsUpdated: ratingUpdates.size,
        matchesProcessed: matches.length,
      }),
    }
  } catch (error) {
    console.error('[GLICKO-UPDATE] Error updating ratings:', error)
    throw error
  }
}
