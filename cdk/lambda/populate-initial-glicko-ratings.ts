/**
 * Lambda Function: Populate Initial Glicko-2 Ratings
 *
 * This is a one-time setup function that initializes default Glicko-2 ratings
 * for all alliance guilds that don't already have ratings.
 *
 * Trigger: Manual invocation via AWS Console, CLI, or automated script
 *
 * Process:
 * 1. Fetch all alliance guilds from DynamoDB
 * 2. Filter guilds that don't have ratings yet
 * 3. Set default Glicko-2 ratings for these guilds
 * 4. Update ratings in DynamoDB
 *
 * Default Rating Values:
 * - rating: 1500 (standard starting rating)
 * - ratingDeviation: 350 (maximum uncertainty for new players)
 * - volatility: 0.06 (standard volatility)
 * - matchCount: 0 (no matches played yet)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

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
  type: string
  id: string
  data?: {
    name: string
    tag: string
    worldId: number
  }
  classification?: 'alliance' | 'member' | 'independent'
  glickoRating?: GlickoRating
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_RATING = 1500
const DEFAULT_RD = 350
const DEFAULT_VOLATILITY = 0.06

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

async function getAllAllianceGuilds(): Promise<Guild[]> {
  console.log('[POPULATE-RATINGS] Fetching all guilds...')

  const allItems: Guild[] = []
  let lastEvaluatedKey: Record<string, any> | undefined

  do {
    const response = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: { ':type': 'guild' },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    )

    if (response.Items) {
      allItems.push(...(response.Items as Guild[]))
    }

    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)

  // Filter for alliance guilds only
  const allianceGuilds = allItems.filter(guild => guild.classification === 'alliance')

  console.log(`[POPULATE-RATINGS] Found ${allItems.length} total guilds, ${allianceGuilds.length} alliance guilds`)

  return allianceGuilds
}

async function batchUpdateGuildRatings(guilds: Guild[]): Promise<void> {
  console.log(`[POPULATE-RATINGS] Updating ${guilds.length} guilds in batches...`)

  // DynamoDB BatchWriteItem has a limit of 25 items per batch
  const batchSize = 25
  let processedCount = 0

  for (let i = 0; i < guilds.length; i += batchSize) {
    const batch = guilds.slice(i, i + batchSize)

    const writeRequests = batch.map(guild => ({
      PutRequest: {
        Item: {
          ...guild,
          glickoRating: createDefaultRating(),
        },
      },
    }))

    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [process.env.TABLE_NAME!]: writeRequests,
          },
        })
      )

      processedCount += batch.length
      console.log(`[POPULATE-RATINGS] Progress: ${processedCount}/${guilds.length} guilds updated`)
    } catch (error) {
      console.error(`[POPULATE-RATINGS] Error updating batch:`, error)
      throw error
    }

    // Small delay to avoid throttling
    if (i + batchSize < guilds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`[POPULATE-RATINGS] Successfully updated ${processedCount} guilds`)
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event: any) => {
  console.log('[POPULATE-RATINGS] Starting initial rating population')
  console.log('[POPULATE-RATINGS] Event:', JSON.stringify(event, null, 2))

  const dryRun = event.dryRun === true || event.dryRun === 'true'

  if (dryRun) {
    console.log('[POPULATE-RATINGS] DRY RUN MODE - No changes will be made')
  }

  try {
    // 1. Fetch all alliance guilds
    const allAllianceGuilds = await getAllAllianceGuilds()

    if (allAllianceGuilds.length === 0) {
      console.log('[POPULATE-RATINGS] No alliance guilds found')
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No alliance guilds found',
          totalGuilds: 0,
          guildsWithoutRatings: 0,
          guildsUpdated: 0,
        }),
      }
    }

    // 2. Filter guilds without ratings
    const guildsWithoutRatings = allAllianceGuilds.filter(
      guild => !guild.glickoRating || typeof guild.glickoRating.matchCount !== 'number'
    )

    const guildsWithRatings = allAllianceGuilds.length - guildsWithoutRatings.length

    console.log(`[POPULATE-RATINGS] Alliance guilds status:`)
    console.log(`  - Total: ${allAllianceGuilds.length}`)
    console.log(`  - With ratings: ${guildsWithRatings}`)
    console.log(`  - Without ratings: ${guildsWithoutRatings.length}`)

    if (guildsWithoutRatings.length === 0) {
      console.log('[POPULATE-RATINGS] All alliance guilds already have ratings')
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'All alliance guilds already have ratings',
          totalGuilds: allAllianceGuilds.length,
          guildsWithoutRatings: 0,
          guildsUpdated: 0,
        }),
      }
    }

    // 3. Log guilds that will be updated
    console.log('[POPULATE-RATINGS] Guilds to be updated:')
    guildsWithoutRatings.slice(0, 10).forEach(guild => {
      console.log(`  - ${guild.data?.name || 'Unknown'} [${guild.data?.tag || 'N/A'}] (ID: ${guild.id})`)
    })
    if (guildsWithoutRatings.length > 10) {
      console.log(`  ... and ${guildsWithoutRatings.length - 10} more`)
    }

    // 4. Update guilds (or skip if dry run)
    let guildsUpdated = 0

    if (!dryRun) {
      await batchUpdateGuildRatings(guildsWithoutRatings)
      guildsUpdated = guildsWithoutRatings.length
    } else {
      console.log('[POPULATE-RATINGS] Skipping updates (dry run mode)')
    }

    const result = {
      message: dryRun
        ? 'Dry run completed - no changes made'
        : 'Initial ratings populated successfully',
      dryRun,
      totalAllianceGuilds: allAllianceGuilds.length,
      guildsWithRatings,
      guildsWithoutRatings: guildsWithoutRatings.length,
      guildsUpdated,
      defaultRating: {
        rating: DEFAULT_RATING,
        ratingDeviation: DEFAULT_RD,
        volatility: DEFAULT_VOLATILITY,
        matchCount: 0,
      },
    }

    console.log('[POPULATE-RATINGS] Complete!', result)

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('[POPULATE-RATINGS] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error populating initial ratings',
        error: error instanceof Error ? error.message : String(error),
      }),
    }
  }
}
