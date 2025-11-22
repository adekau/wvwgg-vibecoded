/**
 * DynamoDB Query Functions
 *
 * This module provides query functions for fetching data from DynamoDB:
 * - Match data (current active matches)
 * - World data (server names and IDs)
 * - Historical snapshots (15-minute intervals)
 * - Guild associations
 *
 * All queries use Next.js `unstable_cache` for automatic caching and revalidation.
 *
 * Data Flow:
 * 1. Lambda functions fetch data from GW2 API and store in DynamoDB
 * 2. These query functions read from DynamoDB (with fallback to GW2 API)
 * 3. Next.js caches responses using ISR (Incremental Static Regeneration)
 * 4. Client components use React Query for additional client-side caching
 *
 * @module server/queries
 */

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

// TypeScript Interfaces
// See docs/DATA_MODEL.md for detailed schema documentation
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
  classification?: 'alliance' | 'solo-alliance' | 'member' | 'independent';
  allianceGuildId?: string;
  memberGuildIds?: string[];
  description?: string;
  contact_info?: string;
  recruitment_status?: 'open' | 'closed' | 'by_application';
  primetimeTimezones?: string[];
}

// DynamoDB Client Setup
// Uses AWS SDK v3 with Document Client for simplified DynamoDB operations
const credentials = createCredentialsProvider();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(credentials && { credentials }),
});

// Document Client automatically marshals/unmarshals DynamoDB items to/from JavaScript objects
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined values to prevent DynamoDB errors
  },
});

/**
 * Decompress data that was compressed with gzip
 *
 * Historical snapshots are compressed to reduce DynamoDB storage costs (~70% reduction).
 * This function decompresses base64-encoded gzip data back to JSON.
 *
 * Compression Pipeline:
 * 1. Lambda: JSON.stringify(data) → gzip → base64 → store in DynamoDB
 * 2. This function: base64 → gunzip → JSON.parse → return object
 *
 * @param compressedData Base64-encoded gzip-compressed JSON string
 * @returns Decompressed object or null on error
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
            },
            ExpressionAttributeValues: { ':type': DB_CONSTANTS.QUERY_TYPES.GUILD },
            // Project only the fields we need to reduce payload size
            ProjectionExpression: 'id, #data, classification, allianceGuildId, memberGuildIds, description, contact_info, recruitment_status',
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
  // Match-specific query (required for efficient queries)
  matchId: string;
  matchStartTime?: string; // If not provided, will query from beginning of match
  // Optional time window filters
  hours?: number; // Limit to last N hours
  startTime?: string; // Custom start time (ISO string)
  endTime?: string; // Custom end time (ISO string)
}

// Internal function that does the actual query
async function _getMatchHistory(options: MatchHistoryOptions): Promise<HistoricalSnapshot[]> {
  try {
    if (!options.matchId) {
      throw new Error('matchId is required for match history queries');
    }

    let startInterval: number;
    let endInterval: number | undefined;
    let queryDescription: string;

    // Determine the start interval
    if (options.startTime) {
      // Custom start time provided
      const startMs = new Date(options.startTime).getTime();
      startInterval = Math.floor(startMs / HISTORY_SNAPSHOT_INTERVAL_MS);
      queryDescription = `match ${options.matchId} from ${options.startTime}`;
    } else if (options.hours) {
      // Query last N hours
      const now = Date.now();
      const hoursAgoMs = now - (options.hours * 60 * 60 * 1000);
      startInterval = Math.floor(hoursAgoMs / HISTORY_SNAPSHOT_INTERVAL_MS);
      queryDescription = `match ${options.matchId} last ${options.hours} hours`;
    } else if (options.matchStartTime) {
      // Query from match start
      const matchStartMs = new Date(options.matchStartTime).getTime();
      startInterval = Math.floor(matchStartMs / HISTORY_SNAPSHOT_INTERVAL_MS);
      queryDescription = `match ${options.matchId} from match start`;
    } else {
      // Default: last 24 hours
      const now = Date.now();
      const hoursAgoMs = now - (24 * 60 * 60 * 1000);
      startInterval = Math.floor(hoursAgoMs / HISTORY_SNAPSHOT_INTERVAL_MS);
      queryDescription = `match ${options.matchId} last 24 hours`;
    }

    // Determine end interval if endTime is provided
    if (options.endTime) {
      const endMs = new Date(options.endTime).getTime();
      endInterval = Math.floor(endMs / HISTORY_SNAPSHOT_INTERVAL_MS);
      queryDescription += ` to ${options.endTime}`;
    }

    let allSnapshots: HistoricalSnapshot[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    // Use matchId-interval-index GSI for efficient match-specific queries
    do {
      const queryParams: any = {
        TableName: process.env.TABLE_NAME,
        IndexName: 'matchId-interval-index',
        KeyConditionExpression: endInterval
          ? 'matchId = :matchId AND #interval BETWEEN :startInterval AND :endInterval'
          : 'matchId = :matchId AND #interval >= :startInterval',
        ProjectionExpression: 'id, #interval, #timestamp, #data, compressed, matchId',
        ExpressionAttributeNames: {
          '#interval': 'interval',
          '#timestamp': 'timestamp',
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':matchId': options.matchId,
          ':startInterval': startInterval,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      };

      if (endInterval) {
        queryParams.ExpressionAttributeValues[':endInterval'] = endInterval;
      }

      const response = await docClient.send(new QueryCommand(queryParams));

      allSnapshots = allSnapshots.concat((response.Items || []) as HistoricalSnapshot[]);
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[HISTORY] Queried ${allSnapshots.length} snapshots for ${queryDescription} using matchId-interval-index`);

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
// Cache key must include parameters to avoid serving stale data across different queries
export async function getMatchHistory(options: MatchHistoryOptions): Promise<HistoricalSnapshot[]> {
  // Generate a unique cache key based on the query parameters
  const cacheKey = [
    'match-history',
    options.matchId,
    options.hours?.toString() || 'all',
    options.startTime || 'none',
    options.endTime || 'none',
  ];

  // Use unstable_cache with dynamic cache key
  const cachedFn = unstable_cache(
    async () => _getMatchHistory(options),
    cacheKey,
    { revalidate: CACHE_DURATIONS.MATCH_HISTORY, tags: ['match-history'] }
  );

  return cachedFn();
}

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
