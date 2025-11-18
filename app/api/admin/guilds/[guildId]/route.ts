import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { createCredentialsProvider } from '@/server/aws-credentials'
import { revalidateTag } from 'next/cache'

const credentials = createCredentialsProvider()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
})

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

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

    // Get current guild state for audit log
    const currentGuild = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { type: 'guild', id: guildId },
      })
    )

    if (!currentGuild.Item) {
      return NextResponse.json(
        { error: 'Guild not found' },
        { status: 404 }
      )
    }

    // Track changes for audit log
    const changes: Record<string, { from: any; to: any }> = {}

    if (body.classification && body.classification !== currentGuild.Item.classification) {
      changes.classification = { from: currentGuild.Item.classification, to: body.classification }
    }
    if (body.allianceGuildId !== undefined && body.allianceGuildId !== currentGuild.Item.allianceGuildId) {
      changes.allianceGuildId = { from: currentGuild.Item.allianceGuildId, to: body.allianceGuildId }
    }
    if (body.memberGuildIds !== undefined && JSON.stringify(body.memberGuildIds) !== JSON.stringify(currentGuild.Item.memberGuildIds)) {
      changes.memberGuildIds = { from: currentGuild.Item.memberGuildIds, to: body.memberGuildIds }
    }
    if (body.notes !== undefined && body.notes !== currentGuild.Item.notes) {
      changes.notes = { from: currentGuild.Item.notes, to: body.notes }
    }

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

    // Create audit log entry
    const auditEntry = {
      timestamp: Date.now(),
      actor: body.reviewedBy || 'unknown',
      action: 'update',
      changes,
    }

    // Append to audit log (create if doesn't exist)
    const existingAuditLog = currentGuild.Item.auditLog || []
    updateExpressions.push('#auditLog = list_append(if_not_exists(#auditLog, :emptyList), :auditEntry)')
    expressionAttributeNames['#auditLog'] = 'auditLog'
    expressionAttributeValues[':auditEntry'] = [auditEntry]
    expressionAttributeValues[':emptyList'] = []

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

    // Revalidate the guilds cache
    revalidateTag('guilds')

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
