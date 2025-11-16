import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron request - invalid or missing secret');
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Cron] Fetching matches from GW2 API...');

    // Fetch from GW2 API
    const response = await fetch(
      `${process.env.ANET_MATCHES_ENDPOINT}?ids=all`,
      {
        headers: {
          'User-Agent': 'WvWGG-Vercel/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GW2 API error: ${response.status} ${response.statusText}`);
    }

    const rawMatches = await response.json();
    console.log(`[Cron] Fetched ${rawMatches.length} matches from GW2 API`);

    // Format matches data
    const formattedMatches = formatMatches(rawMatches);

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          type: 'matches',
          id: 'all',
          data: formattedMatches,
          updatedAt: new Date().toISOString(),
        },
      })
    );

    console.log(`[Cron] Stored ${Object.keys(formattedMatches).length} formatted matches in DynamoDB`);

    // Revalidate Next.js cache
    revalidateTag('matches');

    return Response.json({
      success: true,
      matchCount: Object.keys(formattedMatches).length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error updating matches:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Format matches from GW2 API into our internal structure
function formatMatches(matches: any[]): Record<string, any> {
  const formatted: Record<string, any> = {};

  for (const match of matches) {
    // Determine region from match ID (1-xxx = NA, 2-xxx = EU)
    const region = match.id.startsWith('1-') ? 'NA' : 'EU';

    // Extract tier from match ID (e.g., "1-5" -> tier 5)
    const tier = parseInt(match.id.split('-')[1], 10);

    // Combine all worlds from all teams
    const all_worlds = [
      ...(match.all_worlds?.red || []).map((id: number) => ({
        id,
        color: 'red' as const,
        kills: match.kills?.red || 0,
        deaths: match.deaths?.red || 0,
        victory_points: match.victory_points?.red || 0,
      })),
      ...(match.all_worlds?.blue || []).map((id: number) => ({
        id,
        color: 'blue' as const,
        kills: match.kills?.blue || 0,
        deaths: match.deaths?.blue || 0,
        victory_points: match.victory_points?.blue || 0,
      })),
      ...(match.all_worlds?.green || []).map((id: number) => ({
        id,
        color: 'green' as const,
        kills: match.kills?.green || 0,
        deaths: match.deaths?.green || 0,
        victory_points: match.victory_points?.green || 0,
      })),
    ];

    formatted[match.id] = {
      id: match.id,
      region,
      tier,
      start_time: match.start_time,
      end_time: match.end_time,
      all_worlds,
      scores: match.scores || { red: 0, blue: 0, green: 0 },
      skirmish: match.skirmishes?.[match.skirmishes.length - 1] || {
        id: 0,
        scores: { red: 0, blue: 0, green: 0 },
        map_scores: [],
      },
    };
  }

  return formatted;
}
