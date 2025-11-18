import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
  worldId: number;
  level?: number;
  favor?: number;
  member_count?: number;
  emblem?: any;
  classification?: 'alliance' | 'member' | 'independent';
  allianceGuildId?: string;
  memberGuildIds?: string[];
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
      let allItems: any[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;
      let iterations = 0;
      const maxIterations = 100; // Safety limit

      // Use QueryCommand with GSI for efficient querying (no full table scan!)
      do {
        iterations++;
        const response = await docClient.send(
          new QueryCommand({
            TableName: process.env.TABLE_NAME,
            IndexName: 'type-interval-index',
            KeyConditionExpression: '#type = :type',
            ExpressionAttributeNames: { '#type': 'type' },
            ExpressionAttributeValues: { ':type': 'guild' },
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (response.Items) {
          allItems = allItems.concat(response.Items);
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey && iterations < maxIterations);

      console.log(`[GUILDS] Queried ${allItems.length} guilds after ${iterations} iterations`);

      return allItems.map(item => ({
        ...item.data,
        classification: item.classification,
        allianceGuildId: item.allianceGuildId,
        memberGuildIds: item.memberGuildIds,
      })) || [];
    } catch (error) {
      console.error('Error fetching guilds:', error);
      return [];
    }
  },
  ['guilds'],
  { revalidate: 3600, tags: ['guilds'] } // Changed to 1 hour
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

    // Use QueryCommand with GSI for efficient querying (no full table scan!)
    do {
      const response = await docClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          IndexName: 'type-interval-index',
          KeyConditionExpression: '#type = :type AND #interval >= :startInterval',
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

    console.log(`[HISTORY] Queried ${allSnapshots.length} snapshots for last ${hours} hours (intervals >= ${startInterval})`);

    // Sort by timestamp ascending (oldest first)
    return allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error fetching match history:', error);
    return [];
  }
};
