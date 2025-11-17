import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { IMatchResponse } from '../shared/interfaces/match-response.interface';
import { IWorld } from '../shared/interfaces/world.interface';
import { formatMatches } from '../shared/util/format-matches';
import AllianceWorldsData from './tmp-alliance-worlds.json' with { type: 'json' };

const TABLE_NAME = process.env.TABLE_NAME;
const ANET_MATCHES_ENDPOINT = process.env.ANET_MATCHES_ENDPOINT;
const ANET_WORLDS_ENDPOINT = process.env.ANET_WORLDS_ENDPOINT;
const REGION = process.env.REGION;
const dynamoDb = DynamoDBDocument.from(new DynamoDB({ region: REGION }));

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!ANET_MATCHES_ENDPOINT || !ANET_WORLDS_ENDPOINT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' })
    };
  }

  try {
    const matchesResponse: IMatchResponse[] = await fetch(ANET_MATCHES_ENDPOINT, { method: 'GET' }).then((c) => c.json());
    const worlds = await getWorldsFromDynamo() ?? await getWorldsFromAnet();
    if (!worlds) {
      throw new Error('Unable to get worlds from Dynamo or Anet');
    }
    await saveMatchesToDynamo(matchesResponse, worlds);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'ok' })
    };
  } catch (ex) {
    console.error('Error fetching or saving matches or worlds', ex);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' })
    }
  }
}

const saveMatchesToDynamo = async (matchesResponse: IMatchResponse[], worlds: IWorld[]): Promise<void> => {
  if (!TABLE_NAME) {
    throw new Error('TABLE_NAME environment variable is empty');
  }
  const formattedMatches = formatMatches(matchesResponse, worlds);
  const now = Date.now();

  // Save current match data
  await dynamoDb.put({
    TableName: TABLE_NAME,
    Item: {
      type: "matches",
      id: "all",
      data: formattedMatches,
      updatedAt: now
    }
  });

  // Save historical snapshot (every 15 minutes)
  const current15Min = Math.floor(now / (1000 * 60 * 15)); // 15-minute timestamp
  const snapshotId = `snapshot-${current15Min}`;

  console.log(`[SNAPSHOT] Current interval: ${current15Min}, ID: ${snapshotId}`);

  // Only save snapshot once per 15 minutes
  const existingSnapshot = await dynamoDb.get({
    TableName: TABLE_NAME,
    Key: { type: "match-history", id: snapshotId }
  });

  console.log(`[SNAPSHOT] Existing snapshot check:`, existingSnapshot.Item ? 'FOUND' : 'NOT FOUND');

  if (!existingSnapshot.Item) {
    console.log(`[SNAPSHOT] Creating new snapshot ${snapshotId}...`);
    try {
      await dynamoDb.put({
        TableName: TABLE_NAME,
        Item: {
          type: "match-history",
          id: snapshotId,
          timestamp: now,
          interval: current15Min,
          data: formattedMatches,
          ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
        }
      });
      console.log(`[SNAPSHOT] Successfully created snapshot ${snapshotId}`);
    } catch (err) {
      console.error(`[SNAPSHOT] Failed to create snapshot ${snapshotId}:`, err);
      throw err;
    }
  } else {
    console.log(`[SNAPSHOT] Skipping - snapshot ${snapshotId} already exists`);
  }
}

const getWorldsFromDynamo = async (): Promise<IWorld[] | undefined> => {
  if (!TABLE_NAME) {
    throw new Error('TABLE_NAME environment variable is empty');
  }

  const result = await dynamoDb.get({
    TableName: TABLE_NAME,
    Key: {
      type: "worlds",
      id: "all"
    }
  });

  return result.Item?.data as IWorld[];
}

const getWorldsFromAnet = async (): Promise<IWorld[] | undefined> => {
  if (!ANET_WORLDS_ENDPOINT) {
    throw new Error('ANET_WORLDS_ENDPOINT environment variable is empty');
  }
  const worldsResponse = await fetch(ANET_WORLDS_ENDPOINT, { method: 'GET' }).then((c) => c.json());
  if (!Array.isArray(worldsResponse)) {
    throw new Error('Invalid response from Anet API');
  }
  const worlds = [...worldsResponse, ...AllianceWorldsData];
  return worlds;
}