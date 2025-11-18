import { NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { createCredentialsProvider } from '@/server/aws-credentials'

const credentials = createCredentialsProvider()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
})

const docClient = DynamoDBDocumentClient.from(client)

export async function GET() {
  try {
    console.log('Debug: Scanning for guilds...')
    console.log('TABLE_NAME:', process.env.TABLE_NAME)
    console.log('AWS_ROLE_ARN:', process.env.AWS_ROLE_ARN)
    console.log('Has credentials provider:', !!credentials)

    const response = await docClient.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'guild' },
      })
    )

    console.log('Response count:', response.Items?.length || 0)
    console.log('First item:', JSON.stringify(response.Items?.[0], null, 2))

    const mappedGuilds = response.Items?.map(item => {
      console.log('Mapping item:', JSON.stringify(item, null, 2))
      return item.data
    }) || []

    return NextResponse.json({
      tableName: process.env.TABLE_NAME,
      count: response.Items?.length || 0,
      rawItems: response.Items?.slice(0, 3),
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
