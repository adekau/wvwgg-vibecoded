import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const docClient = DynamoDBDocumentClient.from(client)

interface UpdateGuildRequest {
  classification?: 'alliance' | 'member' | 'independent'
  allianceGuildId?: string | null
  memberGuildIds?: string[]
  notes?: string
  reviewedBy?: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params
    const body: UpdateGuildRequest = await request.json()

    // Build update expression dynamically
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    if (body.classification) {
      updateExpressions.push('#classification = :classification')
      expressionAttributeNames['#classification'] = 'classification'
      expressionAttributeValues[':classification'] = body.classification
    }

    if (body.allianceGuildId !== undefined) {
      updateExpressions.push('#allianceGuildId = :allianceGuildId')
      expressionAttributeNames['#allianceGuildId'] = 'allianceGuildId'
      expressionAttributeValues[':allianceGuildId'] = body.allianceGuildId
    }

    if (body.memberGuildIds !== undefined) {
      updateExpressions.push('#memberGuildIds = :memberGuildIds')
      expressionAttributeNames['#memberGuildIds'] = 'memberGuildIds'
      expressionAttributeValues[':memberGuildIds'] = body.memberGuildIds
    }

    if (body.notes !== undefined) {
      updateExpressions.push('#notes = :notes')
      expressionAttributeNames['#notes'] = 'notes'
      expressionAttributeValues[':notes'] = body.notes
    }

    // Always mark as reviewed when updating
    updateExpressions.push('#isReviewed = :isReviewed')
    expressionAttributeNames['#isReviewed'] = 'isReviewed'
    expressionAttributeValues[':isReviewed'] = true

    updateExpressions.push('#reviewedAt = :reviewedAt')
    expressionAttributeNames['#reviewedAt'] = 'reviewedAt'
    expressionAttributeValues[':reviewedAt'] = Date.now()

    if (body.reviewedBy) {
      updateExpressions.push('#reviewedBy = :reviewedBy')
      expressionAttributeNames['#reviewedBy'] = 'reviewedBy'
      expressionAttributeValues[':reviewedBy'] = body.reviewedBy
    }

    const response = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          type: 'guild',
          id: guildId,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    )

    return NextResponse.json({
      success: true,
      guild: response.Attributes,
    })
  } catch (error) {
    console.error('Error updating guild:', error)
    return NextResponse.json(
      { error: 'Failed to update guild' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params

    const response = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          type: 'guild',
          id: guildId,
        },
      })
    )

    if (!response.Item) {
      return NextResponse.json(
        { error: 'Guild not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      guild: response.Item,
    })
  } catch (error) {
    console.error('Error fetching guild:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guild' },
      { status: 500 }
    )
  }
}
