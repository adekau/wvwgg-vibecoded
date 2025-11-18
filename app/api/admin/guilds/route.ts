import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const docClient = DynamoDBDocumentClient.from(client)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get('filter') // 'all', 'unreviewed', 'reviewed'
    const limit = parseInt(searchParams.get('limit') || '100')

    const response = await docClient.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':type': 'guild',
        },
        Limit: limit,
      })
    )

    let guilds = response.Items || []

    // Apply client-side filtering based on review status
    if (filter === 'unreviewed') {
      guilds = guilds.filter((item) => !item.isReviewed)
    } else if (filter === 'reviewed') {
      guilds = guilds.filter((item) => item.isReviewed)
    }

    // Map to a cleaner format
    const formattedGuilds = guilds.map((item) => ({
      id: item.id,
      name: item.data?.name || '',
      tag: item.data?.tag || '',
      worldId: item.data?.worldId || 0,
      classification: item.classification || null,
      allianceGuildId: item.allianceGuildId || null,
      memberGuildIds: item.memberGuildIds || [],
      isReviewed: item.isReviewed || false,
      reviewedBy: item.reviewedBy || null,
      reviewedAt: item.reviewedAt || null,
      notes: item.notes || null,
      updatedAt: item.updatedAt || Date.now(),
    }))

    return NextResponse.json({
      guilds: formattedGuilds,
      count: formattedGuilds.length,
      total: response.Items?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching guilds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guilds' },
      { status: 500 }
    )
  }
}
