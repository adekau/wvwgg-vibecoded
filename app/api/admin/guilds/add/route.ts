import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { createCredentialsProvider } from '@/server/aws-credentials'

const credentials = createCredentialsProvider()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
})

const docClient = DynamoDBDocumentClient.from(client)

interface AddGuildRequest {
  guildId: string
  addedBy: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AddGuildRequest = await request.json()
    const { guildId, addedBy } = body

    if (!guildId || !addedBy) {
      return NextResponse.json(
        { error: 'Guild ID and addedBy are required' },
        { status: 400 }
      )
    }

    // Check if guild already exists
    const existingGuild = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { type: 'guild', id: guildId },
      })
    )

    if (existingGuild.Item) {
      return NextResponse.json(
        { error: 'Guild already exists in the database' },
        { status: 409 }
      )
    }

    // Fetch guild details from GW2 API (no authentication required for basic info)
    console.log('[ADMIN ADD] Fetching guild details from GW2 API...')
    const guildDetailsResponse = await fetch(
      `https://api.guildwars2.com/v2/guild/${guildId}`
    )

    if (!guildDetailsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch guild details from GW2 API. Please verify the guild ID.' },
        { status: guildDetailsResponse.status }
      )
    }

    const guildDetails = await guildDetailsResponse.json()

    // Add guild to database
    const now = Date.now()
    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          type: 'guild',
          id: guildId,
          data: {
            id: guildId,
            name: guildDetails.name,
            tag: guildDetails.tag,
            worldId: 0, // Admin adds don't have world info
          },
          level: guildDetails.level,
          updatedAt: now,
          auditLog: [
            {
              timestamp: now,
              actor: addedBy,
              action: 'admin-created',
              changes: {
                created: { from: null, to: true },
                addedBy: { from: null, to: addedBy },
              },
            },
          ],
        },
      })
    )

    console.log('[ADMIN ADD] Guild added successfully')

    return NextResponse.json({
      success: true,
      guild: {
        id: guildId,
        name: guildDetails.name,
        tag: guildDetails.tag,
      },
      addedBy,
    })
  } catch (error) {
    console.error('[ADMIN ADD] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Failed to add guild' },
      { status: 500 }
    )
  }
}
