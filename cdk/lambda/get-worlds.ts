import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { IWorld } from '../../shared/interfaces/world.interface';
import AllianceWorldsData from './tmp-alliance-worlds.json' with { type: 'json' };

const TABLE_NAME = process.env.TABLE_NAME;
const ANET_WORLDS_ENDPOINT = process.env.ANET_WORLDS_ENDPOINT;
const REGION = process.env.REGION;
const dynamoDb = DynamoDBDocument.from(new DynamoDB({ region: REGION }));

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!ANET_WORLDS_ENDPOINT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' })
    };
  }

  try {
    const res = await fetch(ANET_WORLDS_ENDPOINT, { method: 'GET' }).then((c) => c.json());
    if (!Array.isArray(res)) {
      throw new Error('Invalid response from Anet API');
    }
    const worlds = [...res, ...AllianceWorldsData];

    await saveCachedWorlds(worlds);

    return {
      statusCode: 200,
      body: JSON.stringify(worlds)
    };
  } catch (ex) {
    console.error('Error fetching or saving worlds', ex);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' })
    }
  }
}

const saveCachedWorlds = async (worldsResponse: IWorld[]): Promise<void> => {
  if (!TABLE_NAME) {
    throw new Error('TABLE_NAME environment variable is empty');
  }

  await dynamoDb.put({
    TableName: TABLE_NAME,
    Item: {
      type: "worlds",
      id: "all",
      data: worldsResponse,
      updatedAt: Date.now()
    }
  });
}