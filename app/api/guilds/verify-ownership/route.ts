import { createCredentialsProvider } from '@/server/aws-credentials'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

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

interface VerifyOwnershipRequest {
  guildId: string
  apiKey: string
  description?: string
  contact_info?: string
  recruitment_status?: 'open' | 'closed' | 'by_application'
  memberGuildIds?: string[]
  addNew?: boolean // Flag to indicate this is a new guild being added
}

export async function POST(request: NextRequest) {
  let apiKey: string | undefined

  try {
    const body: VerifyOwnershipRequest = await request.json()
    apiKey = body.apiKey
    const { guildId, description, contact_info, recruitment_status, memberGuildIds, addNew } = body

    if (!guildId || !apiKey) {
      return NextResponse.json(
        { error: 'Guild ID and API key are required' },
        { status: 400 }
      )
    }

    // Check if guild exists if not adding new
    let existingGuild: any = null
    if (!addNew) {
      const existingGuildResponse = await docClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { type: 'guild', id: guildId },
        })
      )

      if (!existingGuildResponse.Item) {
        return NextResponse.json(
          { error: 'Guild not found. Use "Add Guild" to add a new guild.' },
          { status: 404 }
        )
      }

      existingGuild = existingGuildResponse.Item
    }

    // Step 1: Verify API key has correct permissions
    console.log('[VERIFY] Checking API key permissions...')
    const tokenInfoResponse = await fetch('https://api.guildwars2.com/v2/tokeninfo', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!tokenInfoResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    const tokenInfo = await tokenInfoResponse.json()

    if (!tokenInfo.permissions || !tokenInfo.permissions.includes('guilds')) {
      return NextResponse.json(
        { error: 'API key must have "guilds" permission' },
        { status: 403 }
      )
    }

    console.log('[VERIFY] API key has guilds permission')

    // Step 2: Fetch guild members to verify ownership
    console.log('[VERIFY] Fetching guild members...')
    const membersResponse = await fetch(
      `https://api.guildwars2.com/v2/guild/${guildId}/members`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    )

    if (!membersResponse.ok) {
      if (membersResponse.status === 403) {
        return NextResponse.json(
          { error: 'You are not a member of this guild or do not have permission to view members' },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch guild members' },
        { status: membersResponse.status }
      )
    }

    const members = await membersResponse.json()
    const accountInfo = await fetch('https://api.guildwars2.com/v2/account', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then(res => res.json())

    const isMember = (accountInfo.guilds || []).includes(guildId);
    const isGuildLeader = (accountInfo.guild_leader || []).includes(guildId);

    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this guild' },
        { status: 403 }
      )
    }

    // Verify user is guild leader
    if (!isGuildLeader) {
      return NextResponse.json(
        { error: 'Only guild leaders can update guild information' },
        { status: 403 }
      )
    }

    console.log('[VERIFY] User is confirmed guild leader')

    // Step 3: Count members and get guild details
    const memberCount = members.length
    console.log(`[VERIFY] Guild has ${memberCount} members`)

    // Fetch guild details from GW2 API
    const guildDetailsResponse = await fetch(
      `https://api.guildwars2.com/v2/guild/${guildId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    )

    if (!guildDetailsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch guild details' },
        { status: guildDetailsResponse.status }
      )
    }

    const guildDetails = await guildDetailsResponse.json()

    // Step 4: Add or update guild in DynamoDB
    if (addNew) {
      // Add new guild
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
              worldId: members[0]?.world || 0, // Use leader's world
            },
            member_count: memberCount,
            level: guildDetails.level,
            description: description || undefined,
            contact_info: contact_info || undefined,
            recruitment_status: recruitment_status || undefined,
            updatedAt: now,
            auditLog: [
              {
                timestamp: now,
                actor: accountInfo.name,
                action: 'guild-created',
                changes: {
                  created: { from: null, to: true },
                  member_count: { from: null, to: memberCount },
                  ...(description && { description: { from: null, to: description } }),
                  ...(contact_info && { contact_info: { from: null, to: contact_info } }),
                  ...(recruitment_status && { recruitment_status: { from: null, to: recruitment_status } }),
                },
              },
            ],
          },
        })
      )

      console.log('[VERIFY] New guild added successfully')

      // Revalidate the guilds cache
      revalidateTag('guilds', 'max')

      return NextResponse.json({
        success: true,
        memberCount,
        updatedBy: accountInfo.name,
        added: true,
      })
    }

    // Update existing guild
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}
    const changes: Record<string, any> = {}

    // Always update member count
    updateExpressions.push('#memberCount = :memberCount')
    expressionAttributeNames['#memberCount'] = 'member_count'
    expressionAttributeValues[':memberCount'] = memberCount
    changes.member_count = { from: 'unknown', to: memberCount }

    // Update description if provided
    if (description !== undefined) {
      updateExpressions.push('#description = :description')
      expressionAttributeNames['#description'] = 'description'
      expressionAttributeValues[':description'] = description || null
      changes.description = { from: 'unknown', to: description }
    }

    // Update contact_info if provided
    if (contact_info !== undefined) {
      updateExpressions.push('#contactInfo = :contactInfo')
      expressionAttributeNames['#contactInfo'] = 'contact_info'
      expressionAttributeValues[':contactInfo'] = contact_info || null
      changes.contact_info = { from: 'unknown', to: contact_info }
    }

    // Update recruitment_status if provided
    if (recruitment_status !== undefined) {
      updateExpressions.push('#recruitmentStatus = :recruitmentStatus')
      expressionAttributeNames['#recruitmentStatus'] = 'recruitment_status'
      expressionAttributeValues[':recruitmentStatus'] = recruitment_status || null
      changes.recruitment_status = { from: 'unknown', to: recruitment_status }
    }

    // Update memberGuildIds if provided AND guild is an alliance
    if (memberGuildIds !== undefined && existingGuild?.classification === 'alliance') {
      updateExpressions.push('#memberGuildIds = :memberGuildIds')
      expressionAttributeNames['#memberGuildIds'] = 'memberGuildIds'
      expressionAttributeValues[':memberGuildIds'] = memberGuildIds.length > 0 ? memberGuildIds : null
      changes.memberGuildIds = { from: existingGuild?.memberGuildIds || [], to: memberGuildIds }
      console.log('[VERIFY] Updating member guilds for alliance guild')
    }

    // Add audit log entry
    const auditEntry = {
      timestamp: Date.now(),
      actor: accountInfo.name,
      action: 'public-update',
      changes,
    }

    updateExpressions.push('#auditLog = list_append(if_not_exists(#auditLog, :emptyList), :auditEntry)')
    expressionAttributeNames['#auditLog'] = 'auditLog'
    expressionAttributeValues[':auditEntry'] = [auditEntry]
    expressionAttributeValues[':emptyList'] = []

    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = Date.now()

    await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          type: 'guild',
          id: guildId,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )

    console.log('[VERIFY] Guild updated successfully')

    // Revalidate the guilds cache
    revalidateTag('guilds', 'max')

    return NextResponse.json({
      success: true,
      memberCount,
      updatedBy: accountInfo.name,
    })
  } catch (error) {
    console.error('[VERIFY] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Failed to verify ownership' },
      { status: 500 }
    )
  } finally {
    // Clear API key from memory
    apiKey = undefined
  }
}
