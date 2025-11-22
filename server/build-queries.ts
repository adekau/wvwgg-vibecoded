/**
 * Server-side queries for build system data
 */

import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { getDynamoDBClient } from './aws-credentials'
import type { ItemStatEntity, EnhancedItemEntity, StatFormulaEntity } from '@/lib/gw2/build-data-types'

/**
 * Get all itemstats from DynamoDB
 */
export async function getAllItemStats(): Promise<ItemStatEntity[]> {
  const client = await getDynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)

  const command = new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: '#type = :type',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':type': 'itemstat'
    }
  })

  const result = await docClient.send(command)
  return (result.Items || []) as ItemStatEntity[]
}

/**
 * Get a single itemstat by ID
 */
export async function getItemStatById(id: string): Promise<ItemStatEntity | null> {
  const client = await getDynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)

  const command = new GetCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      type: 'itemstat',
      id
    }
  })

  const result = await docClient.send(command)
  return (result.Item as ItemStatEntity) || null
}

/**
 * Get all stat formulas from DynamoDB
 */
export async function getAllFormulas(): Promise<StatFormulaEntity[]> {
  const client = await getDynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)

  const command = new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: '#type = :type',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':type': 'stat-formula'
    }
  })

  const result = await docClient.send(command)
  return (result.Items || []) as StatFormulaEntity[]
}

/**
 * Get enhanced items by category (rune, sigil, food, utility, etc.)
 */
export async function getItemsByCategory(category: string): Promise<EnhancedItemEntity[]> {
  const client = await getDynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)

  const command = new QueryCommand({
    TableName: process.env.TABLE_NAME,
    IndexName: 'itemCategory-gameVersion-index',
    KeyConditionExpression: 'itemCategory = :category',
    ExpressionAttributeValues: {
      ':category': category
    }
  })

  const result = await docClient.send(command)
  return (result.Items || []) as EnhancedItemEntity[]
}
