import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { unstable_cache } from 'next/cache';
import { gunzipSync } from 'zlib';
import { createCredentialsProvider } from './aws-credentials';
import {
  CACHE_DURATIONS,
  DB_CONSTANTS,
  HISTORY_SNAPSHOT_INTERVAL_MS,
  SNAPSHOT_INTERVALS_PER_HOUR,
} from '@/lib/game-constants';

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
  description?: string;
  contact_info?: string;
  recruitment_status?: 'open' | 'closed' | 'by_application';
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

/**
 * Decompress data that was compressed with gzip
 */
const decompressData = (compressedData: string): any => {
  try {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = gunzipSync(buffer);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.error('Error decompressing data:', error);
    return null;
  }
};

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
        console.warn('No matches data found in DynamoDB. GW2 API fallback not implemented (requires formatting).');
        return null;
      }

      // Validate that the data is an object (Record) and not an array
      if (typeof response.Item.data !== 'object' || Array.isArray(response.Item.data)) {
        console.error('Invalid matches data format in DynamoDB - expected object, got:', typeof response.Item.data);
        return null;
      }

      return response.Item.data;
    } catch (error) {
      console.error('Error fetching matches:', error);
      return null;
    }
  },
  ['matches-v2'],
  { revalidate: CACHE_DURATIONS.MATCHES, tags: ['matches'] }
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
          { next: { revalidate: CACHE_DURATIONS.WORLDS } }
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
  { revalidate: CACHE_DURATIONS.WORLDS, tags: ['worlds'] }
);

export const getGuilds = unstable_cache(
  async (): Promise<IGuild[]> => {
    try {
      let allItems: any[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;
      let iterations = 0;
      const maxIterations = DB_CONSTANTS.MAX_QUERY_ITERATIONS;

      // Query primary table (type='guild') since guilds don't have 'interval' field
      do {
        iterations++;
        const response = await docClient.send(
          new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: '#type = :type',
            ExpressionAttributeNames: {
              '#type': 'type',
              '#data': 'data',
              '#name': 'name',
              '#tag': 'tag',
            },
            ExpressionAttributeValues: { ':type': DB_CONSTANTS.QUERY_TYPES.GUILD },
            // Project only the fields we need to reduce payload size
            ProjectionExpression: 'id, #data.#name, #data.#tag, #data.worldId, #data.level, #data.favor, #data.member_count, classification, allianceGuildId, memberGuildIds, description, contact_info, recruitment_status',
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (response.Items) {
          allItems = allItems.concat(response.Items);
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey && iterations < maxIterations);

      console.log(`[GUILDS] Queried ${allItems.length} guilds after ${iterations} iterations`);

      // Parse the marshaled data from DynamoDB
      return allItems.map(item => ({
        id: item.id,
        name: item.data?.name || '',
        tag: item.data?.tag || '',
        worldId: parseInt(item.data?.worldId) || 0,
        level: item.data?.level,
        favor: item.data?.favor,
        member_count: item.data?.member_count,
        emblem: item.data?.emblem,
        classification: item.classification,
        allianceGuildId: item.allianceGuildId,
        memberGuildIds: item.memberGuildIds,
        description: item.description,
        contact_info: item.contact_info,
        recruitment_status: item.recruitment_status,
      })) || [];
    } catch (error) {
      console.error('Error fetching guilds:', error);
      return [];
    }
  },
  ['guilds'],
  { revalidate: CACHE_DURATIONS.GUILDS, tags: ['guilds'] }
);

export interface HistoricalSnapshot {
  timestamp: number;
  interval: number; // 15-minute interval timestamp
  data: Record<string, IFormattedMatch> | string; // Can be compressed (string) or uncompressed (object)
  compressed?: boolean; // Flag indicating if data is compressed
  matchId?: string; // Match ID for GSI queries
}

export interface MatchHistoryOptions {
  // Time-based query (legacy, for last N hours from now)
  hours?: number;
  // Match-specific query (for specific match time window)
  matchId?: string;
  matchStartTime?: string;
}

// Internal function that does the actual query
async function _getMatchHistory(options: MatchHistoryOptions = {}): Promise<HistoricalSnapshot[]> {
  try {
    let startInterval: number;
    let queryDescription: string;

    // If matchId and matchStartTime are provided, use match-specific time window
    if (options.matchId && options.matchStartTime) {
      const matchStartMs = new Date(options.matchStartTime).getTime();
      // Calculate the 15-minute interval for match start
      startInterval = Math.floor(matchStartMs / HISTORY_SNAPSHOT_INTERVAL_MS);
      queryDescription = `match ${options.matchId} from ${options.matchStartTime}`;
    } else {
      // Legacy: query based on last N hours from now
      const hours = options.hours || 24;
      const now = Date.now();
      const current15Min = Math.floor(now / HISTORY_SNAPSHOT_INTERVAL_MS);
      const intervalsToFetch = hours * SNAPSHOT_INTERVALS_PER_HOUR;
      startInterval = current15Min - intervalsToFetch;
      queryDescription = `last ${hours} hours`;
    }

    let allSnapshots: HistoricalSnapshot[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    // Use QueryCommand with GSI for efficient querying (no full table scan!)
    do {
      const response = await docClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          IndexName: DB_CONSTANTS.INDEX_NAME,
          KeyConditionExpression: '#type = :type AND #interval >= :startInterval',
          ProjectionExpression: 'id, #interval, #timestamp, #data, compressed, matchId',
          ExpressionAttributeNames: {
            '#type': 'type',
            '#interval': 'interval',
            '#timestamp': 'timestamp',
            '#data': 'data',
          },
          ExpressionAttributeValues: {
            ':type': DB_CONSTANTS.QUERY_TYPES.MATCH_HISTORY,
            ':startInterval': startInterval,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      allSnapshots = allSnapshots.concat((response.Items || []) as HistoricalSnapshot[]);
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[HISTORY] Queried ${allSnapshots.length} snapshots for ${queryDescription} (intervals >= ${startInterval})`);

    // Decompress data if compressed
    const decompressedSnapshots = allSnapshots.map(snapshot => {
      if (snapshot.compressed && typeof snapshot.data === 'string') {
        const decompressed = decompressData(snapshot.data);
        return {
          ...snapshot,
          data: decompressed || snapshot.data,
        };
      }
      return snapshot;
    });

    // Sort by timestamp ascending (oldest first)
    return decompressedSnapshots.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error fetching match history:', error);
    return [];
  }
}

// Cached version - revalidate every 2 minutes
// Note: Cache key varies based on parameters
export const getMatchHistory = unstable_cache(
  _getMatchHistory,
  ['match-history'],
  { revalidate: CACHE_DURATIONS.MATCH_HISTORY, tags: ['match-history'] }
);

/**
 * Get pre-computed prime time statistics for a match
 */
async function _getPrimeTimeStats(matchId: string): Promise<any | null> {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { type: DB_CONSTANTS.QUERY_TYPES.PRIME_TIME_STATS, id: matchId },
      })
    );

    if (!response.Item?.stats) {
      console.log(`[PRIME-TIME] No stats found for match ${matchId}`);
      return null;
    }

    return response.Item.stats;
  } catch (error) {
    console.error(`Error fetching prime time stats for ${matchId}:`, error);
    return null;
  }
}

export const getPrimeTimeStats = unstable_cache(
  _getPrimeTimeStats,
  ['prime-time-stats'],
  { revalidate: 120, tags: ['prime-time-stats'] }
);
