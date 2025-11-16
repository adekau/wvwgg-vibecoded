import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { unstable_cache } from 'next/cache';
import { createCredentialsProvider } from './aws-credentials';

// Types
export interface IWorld {
  id: number;
  name: string;
  population: string;
}

export interface IWorldTeam {
  id: number;
  color: 'red' | 'blue' | 'green';
  kills: number;
  deaths: number;
  victory_points: number;
}

export interface IFormattedMatch {
  id: string;
  region: 'NA' | 'EU';
  tier: number;
  start_time: string;
  end_time: string;
  all_worlds: IWorldTeam[];
  scores: {
    red: number;
    blue: number;
    green: number;
  };
  skirmish: {
    id: number;
    scores: {
      red: number;
      blue: number;
      green: number;
    };
    map_scores: Array<{
      type: string;
      scores: {
        red: number;
        blue: number;
        green: number;
      };
    }>;
  };
}

export interface IGuild {
  id: string;
  name: string;
  tag: string;
  level?: number;
  favor?: number;
  member_count?: number;
  emblem?: any;
}

// DynamoDB Client Setup
const credentials = createCredentialsProvider();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Query Functions
export const getMatches = unstable_cache(
  async (): Promise<Record<string, IFormattedMatch> | null> => {
    try {
      const response = await docClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { type: 'matches', id: 'all' },
        })
      );

      if (!response.Item?.data) {
        console.log('No matches found in DynamoDB, falling back to GW2 API');

        // Fallback to GW2 API
        const apiResponse = await fetch(
          `${process.env.ANET_MATCHES_ENDPOINT}?ids=all`,
          { next: { revalidate: 60 } }
        );

        if (!apiResponse.ok) {
          console.error('Failed to fetch from GW2 API:', apiResponse.statusText);
          return null;
        }

        const matches = await apiResponse.json();
        return matches;
      }

      return response.Item.data;
    } catch (error) {
      console.error('Error fetching matches:', error);
      return null;
    }
  },
  ['matches-v2'],
  { revalidate: 60, tags: ['matches'] }
);

export const getWorlds = unstable_cache(
  async (): Promise<IWorld[] | null> => {
    try {
      const response = await docClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { type: 'worlds', id: 'all' },
        })
      );

      if (!response.Item?.data) {
        console.log('No worlds found in DynamoDB, falling back to GW2 API');

        // Fallback to GW2 API
        const apiResponse = await fetch(
          `${process.env.ANET_WORLDS_ENDPOINT}?ids=all`,
          { next: { revalidate: 86400 } }
        );

        if (!apiResponse.ok) {
          console.error('Failed to fetch from GW2 API:', apiResponse.statusText);
          return null;
        }

        const worlds = await apiResponse.json();
        return worlds;
      }

      return response.Item.data;
    } catch (error) {
      console.error('Error fetching worlds:', error);
      return null;
    }
  },
  ['worlds-v2'],
  { revalidate: 86400, tags: ['worlds'] }
);

export const getGuilds = unstable_cache(
  async (): Promise<IGuild[]> => {
    try {
      const response = await docClient.send(
        new ScanCommand({
          TableName: process.env.TABLE_NAME,
          FilterExpression: '#type = :type',
          ExpressionAttributeNames: { '#type': 'type' },
          ExpressionAttributeValues: { ':type': 'guild' },
        })
      );

      return response.Items?.map(item => item.data) || [];
    } catch (error) {
      console.error('Error fetching guilds:', error);
      return [];
    }
  },
  ['guilds'],
  { revalidate: 86400, tags: ['guilds'] }
);

export interface HistoricalSnapshot {
  timestamp: number;
  hour: number;
  data: Record<string, IFormattedMatch>;
}

export const getMatchHistory = async (hours: number = 24): Promise<HistoricalSnapshot[]> => {
  try {
    const now = Date.now();
    const currentHour = Math.floor(now / (1000 * 60 * 60));
    const startHour = currentHour - hours;

    const response = await docClient.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: '#type = :type AND #hour >= :startHour',
        ExpressionAttributeNames: {
          '#type': 'type',
          '#hour': 'hour',
        },
        ExpressionAttributeValues: {
          ':type': 'match-history',
          ':startHour': startHour,
        },
      })
    );

    const snapshots = (response.Items || []) as HistoricalSnapshot[];

    // Sort by timestamp ascending (oldest first)
    return snapshots.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error fetching match history:', error);
    return [];
  }
};
