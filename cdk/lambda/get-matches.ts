import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { IMatchResponse } from '../shared/interfaces/match-response.interface';
import { IWorld } from '../shared/interfaces/world.interface';
import { formatMatches } from '../shared/util/format-matches';
import { calculateMatchPrimeTimeStats } from '../shared/util/prime-time-calculator';
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

      // After creating snapshot, calculate and save prime time stats for each match
      await calculateAndSavePrimeTimeStats(formattedMatches);
    } catch (err) {
      console.error(`[SNAPSHOT] Failed to create snapshot ${snapshotId}:`, err);
      throw err;
    }
  } else {
    console.log(`[SNAPSHOT] Skipping - snapshot ${snapshotId} already exists`);
  }
}

/**
 * Calculate and save prime time statistics for all matches
 * Optimized to query snapshots once per region instead of per match
 */
const calculateAndSavePrimeTimeStats = async (formattedMatches: any): Promise<void> => {
  if (!TABLE_NAME) {
    throw new Error('TABLE_NAME environment variable is empty');
  }

  const matchIds = Object.keys(formattedMatches);
  console.log(`[PRIME-TIME] Calculating stats for ${matchIds.length} matches`);

  // Group matches by region (NA/EU) since they share the same start/end times
  const matchesByRegion: { [key: string]: { matchId: string; startInterval: number }[] } = {};

  for (const matchId of matchIds) {
    const matchData = formattedMatches[matchId];
    if (!matchData?.start_time) {
      console.log(`[PRIME-TIME] Skipping ${matchId} - no start_time`);
      continue;
    }

    // Extract region from matchId (format: "region-tier", e.g., "1-1" for NA, "2-1" for EU)
    const region = matchId.startsWith('1-') ? 'na' : 'eu';
    const startTime = new Date(matchData.start_time).getTime();
    const startInterval = Math.floor(startTime / (1000 * 60 * 15));

    if (!matchesByRegion[region]) {
      matchesByRegion[region] = [];
    }
    matchesByRegion[region].push({ matchId, startInterval });
  }

  // Process each region (query snapshots once per region)
  for (const [region, matches] of Object.entries(matchesByRegion)) {
    try {
      // All matches in a region share the same start time, so use the first one
      const startInterval = matches[0].startInterval;
      console.log(`[PRIME-TIME] Querying snapshots for ${region.toUpperCase()} region (${matches.length} matches) from interval ${startInterval}`);

      // Query all snapshots for this region ONCE
      let allSnapshots: any[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;

      do {
        const response = await dynamoDb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
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

        allSnapshots = allSnapshots.concat(response.Items || []);
        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      const snapshots = allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`[PRIME-TIME] Retrieved ${snapshots.length} snapshots for ${region.toUpperCase()} region`);

      if (snapshots.length === 0) {
        console.log(`[PRIME-TIME] No snapshots found for ${region.toUpperCase()} region, skipping all matches`);
        continue;
      }

      // Process all matches in this region in parallel for better performance
      await Promise.all(
        matches.map(async ({ matchId }) => {
          try {
            // Calculate prime time stats
            const primeTimeStats = calculateMatchPrimeTimeStats(matchId, snapshots);

            // Save to DynamoDB
            await dynamoDb.put({
              TableName: TABLE_NAME,
              Item: {
                type: 'prime-time-stats',
                id: matchId,
                stats: primeTimeStats,
                updatedAt: Date.now(),
                ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
              }
            });

            console.log(`[PRIME-TIME] Saved stats for ${matchId} (${primeTimeStats.length} windows, ${snapshots.length} snapshots)`);
          } catch (err) {
            console.error(`[PRIME-TIME] Failed to calculate stats for ${matchId}:`, err);
            // Continue with other matches even if one fails
          }
        })
      );
    } catch (err) {
      console.error(`[PRIME-TIME] Failed to process ${region.toUpperCase()} region:`, err);
    }
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