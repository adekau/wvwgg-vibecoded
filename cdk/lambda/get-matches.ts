import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { gzipSync, gunzipSync } from 'zlib';
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

/**
 * Compress data using gzip and return base64 encoded string
 */
const compressData = (data: any): string => {
  const jsonString = JSON.stringify(data);
  const compressed = gzipSync(jsonString);
  return compressed.toString('base64');
};

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

  // Save historical snapshots (every 15 minutes)
  const current15Min = Math.floor(now / (1000 * 60 * 15)); // 15-minute timestamp

  console.log(`[SNAPSHOT] Current interval: ${current15Min}`);

  // Save individual snapshots per match for efficient matchId-based queries
  const matchIds = Object.keys(formattedMatches);
  let snapshotsCreated = 0;

  for (const matchId of matchIds) {
    const snapshotId = `snapshot-${matchId}-${current15Min}`;

    // Check if snapshot already exists
    const existingSnapshot = await dynamoDb.get({
      TableName: TABLE_NAME,
      Key: { type: "match-history", id: snapshotId }
    });

    if (!existingSnapshot.Item) {
      try {
        // Compress the match data before storing
        const matchData = { [matchId]: formattedMatches[matchId] };
        const compressedData = compressData(matchData);

        await dynamoDb.put({
          TableName: TABLE_NAME,
          Item: {
            type: "match-history",
            id: snapshotId,
            matchId: matchId, // Added for GSI
            timestamp: now,
            interval: current15Min,
            data: compressedData, // Store compressed data
            compressed: true, // Flag to indicate compression
            ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
          }
        });
        snapshotsCreated++;
      } catch (err) {
        console.error(`[SNAPSHOT] Failed to create snapshot ${snapshotId}:`, err);
        // Continue with other matches even if one fails
      }
    }
  }

  console.log(`[SNAPSHOT] Created ${snapshotsCreated}/${matchIds.length} new snapshots for interval ${current15Min}`);

  // After creating snapshots, calculate and save prime time stats for each match
  if (snapshotsCreated > 0) {
    await calculateAndSavePrimeTimeStats(formattedMatches);
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

  // Process each region - query per match using matchId-interval-index
  for (const [region, matches] of Object.entries(matchesByRegion)) {
    try {
      console.log(`[PRIME-TIME] Processing ${region.toUpperCase()} region (${matches.length} matches)`);

      // Query each match's snapshots individually using the matchId-interval-index GSI
      // This is much more efficient than querying all matches and filtering
      for (const { matchId, startInterval: matchStartInterval } of matches) {
        try {
          console.log(`[PRIME-TIME] Querying snapshots for match ${matchId} from interval ${matchStartInterval}`);

          // Query snapshots for this specific match using matchId-interval-index
          let allSnapshots: any[] = [];
          let lastEvaluatedKey: Record<string, any> | undefined;

          do {
            const response = await dynamoDb.send(
              new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'matchId-interval-index', // Use the new match-specific GSI
                KeyConditionExpression: 'matchId = :matchId AND #interval >= :startInterval',
                ProjectionExpression: '#timestamp, #interval, #data, compressed',
                ExpressionAttributeNames: {
                  '#interval': 'interval',
                  '#timestamp': 'timestamp',
                  '#data': 'data',
                },
                ExpressionAttributeValues: {
                  ':matchId': matchId,
                  ':startInterval': matchStartInterval,
                },
                ExclusiveStartKey: lastEvaluatedKey,
              })
            );

            allSnapshots = allSnapshots.concat(response.Items || []);
            lastEvaluatedKey = response.LastEvaluatedKey;
          } while (lastEvaluatedKey);

          console.log(`[PRIME-TIME] Retrieved ${allSnapshots.length} snapshots for match ${matchId}`);

          if (allSnapshots.length === 0) {
            console.log(`[PRIME-TIME] No snapshots found for ${matchId}`);
            continue;
          }

          // Decompress snapshots if needed
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

          const snapshots = decompressedSnapshots.sort((a, b) => a.timestamp - b.timestamp);

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
      }
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