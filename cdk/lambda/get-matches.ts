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

  // Save historical snapshot (every hour)
  const currentHour = Math.floor(now / (1000 * 60 * 60)); // Hour timestamp
  const snapshotId = `snapshot-${currentHour}`;

  // Only save snapshot once per hour
  const existingSnapshot = await dynamoDb.get({
    TableName: TABLE_NAME,
    Key: { type: "match-history", id: snapshotId }
  });

  if (!existingSnapshot.Item) {
    await dynamoDb.put({
      TableName: TABLE_NAME,
      Item: {
        type: "match-history",
        id: snapshotId,
        timestamp: now,
        hour: currentHour,
        data: formattedMatches,
        ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
      }
    });
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