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
  description?: string
  contact_info?: string
  recruitment_status?: 'open' | 'closed' | 'by_application'
  notes?: string
  updatedBy?: string
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

    if (body.classification !== undefined && body.classification !== currentGuild.Item.classification) {
      changes.classification = { from: currentGuild.Item.classification, to: body.classification }
    }
    if (body.allianceGuildId !== undefined && body.allianceGuildId !== currentGuild.Item.allianceGuildId) {
      changes.allianceGuildId = { from: currentGuild.Item.allianceGuildId, to: body.allianceGuildId }
    }
    if (body.memberGuildIds !== undefined && JSON.stringify(body.memberGuildIds) !== JSON.stringify(currentGuild.Item.memberGuildIds)) {
      changes.memberGuildIds = { from: currentGuild.Item.memberGuildIds, to: body.memberGuildIds }
    }
    if (body.description !== undefined && body.description !== currentGuild.Item.description) {
      changes.description = { from: currentGuild.Item.description, to: body.description }
    }
    if (body.contact_info !== undefined && body.contact_info !== currentGuild.Item.contact_info) {
      changes.contact_info = { from: currentGuild.Item.contact_info, to: body.contact_info }
    }
    if (body.recruitment_status !== undefined && body.recruitment_status !== currentGuild.Item.recruitment_status) {
      changes.recruitment_status = { from: currentGuild.Item.recruitment_status, to: body.recruitment_status }
    }
    if (body.notes !== undefined && body.notes !== currentGuild.Item.notes) {
      changes.notes = { from: currentGuild.Item.notes, to: body.notes }
    }

    // Build update expression dynamically
    const updateExpressions: string[] = []
    const removeExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    if (body.classification !== undefined) {
      if (body.classification) {
        updateExpressions.push('#classification = :classification')
        expressionAttributeNames['#classification'] = 'classification'
        expressionAttributeValues[':classification'] = body.classification
      } else {
        // Remove classification when set to undefined/null
        removeExpressions.push('#classification')
        expressionAttributeNames['#classification'] = 'classification'
      }
    }

    if (body.allianceGuildId !== undefined) {
      if (body.allianceGuildId) {
        updateExpressions.push('#allianceGuildId = :allianceGuildId')
        expressionAttributeNames['#allianceGuildId'] = 'allianceGuildId'
        expressionAttributeValues[':allianceGuildId'] = body.allianceGuildId
      } else {
        // Remove allianceGuildId when set to undefined/null/empty
        removeExpressions.push('#allianceGuildId')
        expressionAttributeNames['#allianceGuildId'] = 'allianceGuildId'
      }
    }

    if (body.memberGuildIds !== undefined) {
      if (body.memberGuildIds && body.memberGuildIds.length > 0) {
        updateExpressions.push('#memberGuildIds = :memberGuildIds')
        expressionAttributeNames['#memberGuildIds'] = 'memberGuildIds'
        expressionAttributeValues[':memberGuildIds'] = body.memberGuildIds
      } else {
        // Remove memberGuildIds when set to undefined/null/empty array
        removeExpressions.push('#memberGuildIds')
        expressionAttributeNames['#memberGuildIds'] = 'memberGuildIds'
      }
    }

    if (body.description !== undefined) {
      if (body.description) {
        updateExpressions.push('#description = :description')
        expressionAttributeNames['#description'] = 'description'
        expressionAttributeValues[':description'] = body.description
      } else {
        removeExpressions.push('#description')
        expressionAttributeNames['#description'] = 'description'
      }
    }

    if (body.contact_info !== undefined) {
      if (body.contact_info) {
        updateExpressions.push('#contactInfo = :contactInfo')
        expressionAttributeNames['#contactInfo'] = 'contact_info'
        expressionAttributeValues[':contactInfo'] = body.contact_info
      } else {
        removeExpressions.push('#contactInfo')
        expressionAttributeNames['#contactInfo'] = 'contact_info'
      }
    }

    if (body.recruitment_status !== undefined) {
      if (body.recruitment_status) {
        updateExpressions.push('#recruitmentStatus = :recruitmentStatus')
        expressionAttributeNames['#recruitmentStatus'] = 'recruitment_status'
        expressionAttributeValues[':recruitmentStatus'] = body.recruitment_status
      } else {
        removeExpressions.push('#recruitmentStatus')
        expressionAttributeNames['#recruitmentStatus'] = 'recruitment_status'
      }
    }

    if (body.notes !== undefined) {
      if (body.notes) {
        updateExpressions.push('#notes = :notes')
        expressionAttributeNames['#notes'] = 'notes'
        expressionAttributeValues[':notes'] = body.notes
      } else {
        removeExpressions.push('#notes')
        expressionAttributeNames['#notes'] = 'notes'
      }
    }

    // Create audit log entry
    const auditEntry = {
      timestamp: Date.now(),
      actor: body.updatedBy || 'admin',
      action: 'admin-update',
      changes,
    }

    // Append to audit log (create if doesn't exist)
    updateExpressions.push('#auditLog = list_append(if_not_exists(#auditLog, :emptyList), :auditEntry)')
    expressionAttributeNames['#auditLog'] = 'auditLog'
    expressionAttributeValues[':auditEntry'] = [auditEntry]
    expressionAttributeValues[':emptyList'] = []

    // Update timestamp
    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = Date.now()

    // Build the complete update expression
    const expressionParts: string[] = []
    if (updateExpressions.length > 0) {
      expressionParts.push(`SET ${updateExpressions.join(', ')}`)
    }
    if (removeExpressions.length > 0) {
      expressionParts.push(`REMOVE ${removeExpressions.join(', ')}`)
    }

    const response = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          type: 'guild',
          id: guildId,
        },
        UpdateExpression: expressionParts.join(' '),
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
