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
        // Fallback to GW2 API
        const apiResponse = await fetch(
          `${process.env.ANET_MATCHES_ENDPOINT}?ids=all`,
          { next: { revalidate: 60 } }
        );

        if (!apiResponse.ok) {
          console.error('Failed to fetch matches from GW2 API:', apiResponse.statusText);
          return null;
        }

        return await apiResponse.json();
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
        // Fallback to GW2 API
        const apiResponse = await fetch(
          `${process.env.ANET_WORLDS_ENDPOINT}?ids=all`,
          { next: { revalidate: 86400 } }
        );

        if (!apiResponse.ok) {
          console.error('Failed to fetch worlds from GW2 API:', apiResponse.statusText);
          return null;
        }

        return await apiResponse.json();
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
  interval: number; // 15-minute interval timestamp
  data: Record<string, IFormattedMatch>;
}

export const getMatchHistory = async (hours: number = 24): Promise<HistoricalSnapshot[]> => {
  try {
    const now = Date.now();
    // Calculate 15-minute intervals
    const current15Min = Math.floor(now / (1000 * 60 * 15));
    // Calculate how many 15-min intervals are in the requested hours
    const intervalsToFetch = hours * 4; // 4 intervals per hour
    const startInterval = current15Min - intervalsToFetch;

    let allSnapshots: HistoricalSnapshot[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    // Handle pagination - keep scanning until we have all items
    do {
      const response = await docClient.send(
        new ScanCommand({
          TableName: process.env.TABLE_NAME,
          FilterExpression: '#type = :type AND #interval >= :startInterval',
          ExpressionAttributeNames: {
            '#type': 'type',
            '#interval': 'interval',
          },
          ExpressionAttributeValues: {
            ':type': 'match-history',
            ':startInterval': startInterval,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      allSnapshots = allSnapshots.concat((response.Items || []) as HistoricalSnapshot[]);
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[HISTORY] Fetched ${allSnapshots.length} snapshots for last ${hours} hours (intervals >= ${startInterval})`);

    // Sort by timestamp ascending (oldest first)
    return allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error fetching match history:', error);
    return [];
  }
};
