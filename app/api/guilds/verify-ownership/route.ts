import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { createCredentialsProvider } from '@/server/aws-credentials'

const credentials = createCredentialsProvider()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
})

const docClient = DynamoDBDocumentClient.from(client)

interface VerifyOwnershipRequest {
  guildId: string
  apiKey: string
  allianceGuildId?: string
}

export async function POST(request: NextRequest) {
  let apiKey: string | undefined

  try {
    const body: VerifyOwnershipRequest = await request.json()
    apiKey = body.apiKey
    const { guildId, allianceGuildId } = body

    if (!guildId || !apiKey) {
      return NextResponse.json(
        { error: 'Guild ID and API key are required' },
        { status: 400 }
      )
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

    // Find the current user in the member list
    const currentMember = members.find((m: any) => m.name === accountInfo.name)

    if (!currentMember) {
      return NextResponse.json(
        { error: 'You are not a member of this guild' },
        { status: 403 }
      )
    }

    // Verify user is guild leader
    if (currentMember.rank !== 'Leader') {
      return NextResponse.json(
        { error: 'Only guild leaders can update guild information' },
        { status: 403 }
      )
    }

    console.log('[VERIFY] User is confirmed guild leader')

    // Step 3: Count members
    const memberCount = members.length
    console.log(`[VERIFY] Guild has ${memberCount} members`)

    // Step 4: Update guild in DynamoDB
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    // Always update member count
    updateExpressions.push('#memberCount = :memberCount')
    expressionAttributeNames['#memberCount'] = 'member_count'
    expressionAttributeValues[':memberCount'] = memberCount

    // Update alliance if provided
    if (allianceGuildId !== undefined) {
      updateExpressions.push('#classification = :classification')
      expressionAttributeNames['#classification'] = 'classification'
      expressionAttributeValues[':classification'] = 'member'

      updateExpressions.push('#allianceGuildId = :allianceGuildId')
      expressionAttributeNames['#allianceGuildId'] = 'allianceGuildId'
      expressionAttributeValues[':allianceGuildId'] = allianceGuildId || null
    }

    // Add audit log entry
    const auditEntry = {
      timestamp: Date.now(),
      actor: accountInfo.name,
      action: 'public-update',
      changes: {
        member_count: { from: 'unknown', to: memberCount },
        ...(allianceGuildId !== undefined && {
          allianceGuildId: { from: 'unknown', to: allianceGuildId }
        })
      },
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
