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
  classification?: 'alliance' | 'solo-alliance' | 'member' | 'independent'
  allianceGuildId?: string | null
  memberGuildIds?: string[]
  description?: string
  contact_info?: string
  recruitment_status?: 'open' | 'closed' | 'by_application'
  primetimeTimezones?: string[]
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
    if (body.primetimeTimezones !== undefined && JSON.stringify(body.primetimeTimezones) !== JSON.stringify(currentGuild.Item.primetimeTimezones)) {
      changes.primetimeTimezones = { from: currentGuild.Item.primetimeTimezones, to: body.primetimeTimezones }
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

    if (body.primetimeTimezones !== undefined) {
      if (body.primetimeTimezones && body.primetimeTimezones.length > 0) {
        updateExpressions.push('#primetimeTimezones = :primetimeTimezones')
        expressionAttributeNames['#primetimeTimezones'] = 'primetimeTimezones'
        expressionAttributeValues[':primetimeTimezones'] = body.primetimeTimezones
      } else {
        removeExpressions.push('#primetimeTimezones')
        expressionAttributeNames['#primetimeTimezones'] = 'primetimeTimezones'
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

    // Handle bidirectional relationships for alliance/member guilds
    const errors: string[] = []

    // When updating an alliance guild's member list
    if (body.memberGuildIds !== undefined) {
      const oldMemberIds = currentGuild.Item.memberGuildIds || []
      const newMemberIds = body.memberGuildIds || []

      // Find added and removed members
      const addedMembers = newMemberIds.filter((id: string) => !oldMemberIds.includes(id))
      const removedMembers = oldMemberIds.filter((id: string) => !newMemberIds.includes(id))

      console.log(`Processing member guild updates: added=${addedMembers.length}, removed=${removedMembers.length}`)

      // Update added member guilds to point to this alliance
      for (const memberId of addedMembers) {
        try {
          console.log(`Updating member guild ${memberId} to point to alliance ${guildId}`)
          await docClient.send(
            new UpdateCommand({
              TableName: process.env.TABLE_NAME,
              Key: { type: 'guild', id: memberId },
              UpdateExpression: 'SET #allianceGuildId = :allianceGuildId, #classification = :classification, #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#allianceGuildId': 'allianceGuildId',
                '#classification': 'classification',
                '#updatedAt': 'updatedAt',
              },
              ExpressionAttributeValues: {
                ':allianceGuildId': guildId,
                ':classification': 'member',
                ':updatedAt': Date.now(),
              },
            })
          )
          console.log(`Successfully updated member guild ${memberId}`)
        } catch (error) {
          const errorMsg = `Failed to update member guild ${memberId}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg, error)
          errors.push(errorMsg)
        }
      }

      // Update removed member guilds to clear alliance reference
      for (const memberId of removedMembers) {
        try {
          console.log(`Removing alliance reference from member guild ${memberId}`)
          await docClient.send(
            new UpdateCommand({
              TableName: process.env.TABLE_NAME,
              Key: { type: 'guild', id: memberId },
              UpdateExpression: 'REMOVE #allianceGuildId, #classification SET #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#allianceGuildId': 'allianceGuildId',
                '#classification': 'classification',
                '#updatedAt': 'updatedAt',
              },
              ExpressionAttributeValues: {
                ':updatedAt': Date.now(),
              },
            })
          )
          console.log(`Successfully removed alliance reference from member guild ${memberId}`)
        } catch (error) {
          const errorMsg = `Failed to update removed member guild ${memberId}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg, error)
          errors.push(errorMsg)
        }
      }
    }

    // When updating a member guild's alliance reference
    if (body.allianceGuildId !== undefined) {
      const oldAllianceId = currentGuild.Item.allianceGuildId
      const newAllianceId = body.allianceGuildId

      console.log(`Processing alliance reference update: old=${oldAllianceId}, new=${newAllianceId}`)

      // Remove from old alliance if changed
      if (oldAllianceId && oldAllianceId !== newAllianceId) {
        try {
          console.log(`Removing guild ${guildId} from old alliance ${oldAllianceId}`)
          const oldAlliance = await docClient.send(
            new GetCommand({
              TableName: process.env.TABLE_NAME,
              Key: { type: 'guild', id: oldAllianceId },
            })
          )

          if (oldAlliance.Item?.memberGuildIds) {
            const updatedMemberIds = oldAlliance.Item.memberGuildIds.filter((id: string) => id !== guildId)

            if (updatedMemberIds.length > 0) {
              await docClient.send(
                new UpdateCommand({
                  TableName: process.env.TABLE_NAME,
                  Key: { type: 'guild', id: oldAllianceId },
                  UpdateExpression: 'SET #memberGuildIds = :memberGuildIds, #updatedAt = :updatedAt',
                  ExpressionAttributeNames: {
                    '#memberGuildIds': 'memberGuildIds',
                    '#updatedAt': 'updatedAt',
                  },
                  ExpressionAttributeValues: {
                    ':memberGuildIds': updatedMemberIds,
                    ':updatedAt': Date.now(),
                  },
                })
              )
            } else {
              await docClient.send(
                new UpdateCommand({
                  TableName: process.env.TABLE_NAME,
                  Key: { type: 'guild', id: oldAllianceId },
                  UpdateExpression: 'REMOVE #memberGuildIds SET #updatedAt = :updatedAt',
                  ExpressionAttributeNames: {
                    '#memberGuildIds': 'memberGuildIds',
                    '#updatedAt': 'updatedAt',
                  },
                  ExpressionAttributeValues: {
                    ':updatedAt': Date.now(),
                  },
                })
              )
            }
            console.log(`Successfully removed guild from old alliance ${oldAllianceId}`)
          }
        } catch (error) {
          const errorMsg = `Failed to update old alliance ${oldAllianceId}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg, error)
          errors.push(errorMsg)
        }
      }

      // Add to new alliance if set
      if (newAllianceId) {
        try {
          console.log(`Adding guild ${guildId} to new alliance ${newAllianceId}`)
          const newAlliance = await docClient.send(
            new GetCommand({
              TableName: process.env.TABLE_NAME,
              Key: { type: 'guild', id: newAllianceId },
            })
          )

          if (newAlliance.Item) {
            const existingMemberIds = newAlliance.Item.memberGuildIds || []
            if (!existingMemberIds.includes(guildId)) {
              await docClient.send(
                new UpdateCommand({
                  TableName: process.env.TABLE_NAME,
                  Key: { type: 'guild', id: newAllianceId },
                  UpdateExpression: 'SET #memberGuildIds = :memberGuildIds, #updatedAt = :updatedAt',
                  ExpressionAttributeNames: {
                    '#memberGuildIds': 'memberGuildIds',
                    '#updatedAt': 'updatedAt',
                  },
                  ExpressionAttributeValues: {
                    ':memberGuildIds': [...existingMemberIds, guildId],
                    ':updatedAt': Date.now(),
                  },
                })
              )
              console.log(`Successfully added guild to new alliance ${newAllianceId}`)
            } else {
              console.log(`Guild ${guildId} already in alliance ${newAllianceId} member list`)
            }
          } else {
            const errorMsg = `New alliance ${newAllianceId} not found in database`
            console.error(errorMsg)
            errors.push(errorMsg)
          }
        } catch (error) {
          const errorMsg = `Failed to update new alliance ${newAllianceId}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg, error)
          errors.push(errorMsg)
        }
      }
    }

    // Revalidate the guilds cache
    revalidateTag('guilds')

    return NextResponse.json({
      success: true,
      guild: response.Attributes,
      warnings: errors.length > 0 ? errors : undefined,
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
