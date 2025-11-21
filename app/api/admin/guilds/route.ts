import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { createCredentialsProvider } from '@/server/aws-credentials'

const credentials = createCredentialsProvider()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
})

const docClient = DynamoDBDocumentClient.from(client)

export async function GET(request: NextRequest) {
  try {
    // Paginate through all guilds
    let allItems: any[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    let iterations = 0
    const maxIterations = 100

    do {
      iterations++
      const response = await docClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: '#type = :type',
          ExpressionAttributeNames: {
            '#type': 'type',
          },
          ExpressionAttributeValues: {
            ':type': 'guild',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      )

      if (response.Items) {
        allItems = allItems.concat(response.Items)
      }

      lastEvaluatedKey = response.LastEvaluatedKey
    } while (lastEvaluatedKey && iterations < maxIterations)

    // Map to a cleaner format
    const formattedGuilds = allItems.map((item) => ({
      id: item.id,
      name: item.data?.name || '',
      tag: item.data?.tag || '',
      worldId: item.data?.worldId || 0,
      classification: item.classification || null,
      allianceGuildId: item.allianceGuildId || null,
      memberGuildIds: item.memberGuildIds || [],
      description: item.description || null,
      contact_info: item.contact_info || null,
      recruitment_status: item.recruitment_status || null,
      notes: item.notes || null,
      updatedAt: item.updatedAt || Date.now(),
      auditLog: item.auditLog || [],
    }))

    return NextResponse.json({
      guilds: formattedGuilds,
      count: formattedGuilds.length,
      total: allItems.length,
    })
  } catch (error) {
    console.error('Error fetching guilds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guilds' },
      { status: 500 }
    )
  }
}
