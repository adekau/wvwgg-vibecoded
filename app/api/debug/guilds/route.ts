import { NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { createCredentialsProvider } from '@/server/aws-credentials'

const credentials = createCredentialsProvider()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
})

const docClient = DynamoDBDocumentClient.from(client)

export async function GET() {
  try {
    console.log('Debug: Querying for guilds...')
    console.log('TABLE_NAME:', process.env.TABLE_NAME)
    console.log('AWS_ROLE_ARN:', process.env.AWS_ROLE_ARN)
    console.log('Has credentials provider:', !!credentials)

    console.log('Sending query command with pagination...')

    let allItems: any[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    let iterations = 0
    const maxIterations = 100 // Safety limit

    do {
      iterations++
      console.log(`Query iteration ${iterations}...`)

      const response = await docClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          IndexName: 'type-interval-index',
          KeyConditionExpression: '#type = :type',
          ExpressionAttributeNames: { '#type': 'type' },
          ExpressionAttributeValues: { ':type': 'guild' },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      )

      console.log(`Iteration ${iterations} - Found: ${response.Count}`)

      if (response.Items) {
        allItems = allItems.concat(response.Items)
      }

      lastEvaluatedKey = response.LastEvaluatedKey
    } while (lastEvaluatedKey && iterations < maxIterations)

    console.log(`Query complete after ${iterations} iterations`)
    console.log(`Total guilds found: ${allItems.length}`)
    console.log('First item:', JSON.stringify(allItems[0], null, 2))

    const mappedGuilds = allItems.map(item => item.data)

    return NextResponse.json({
      tableName: process.env.TABLE_NAME,
      count: allItems.length,
      iterations,
      rawItems: allItems.slice(0, 3),
      mappedGuilds: mappedGuilds.slice(0, 3),
      error: null,
    })
  } catch (error) {
    console.error('Error in debug endpoint:', error)
    return NextResponse.json({
      tableName: process.env.TABLE_NAME,
      count: 0,
      rawItems: [],
      mappedGuilds: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}
