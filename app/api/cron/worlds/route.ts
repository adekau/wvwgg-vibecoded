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

    console.log('[Cron] Fetching worlds from GW2 API...');

    // Fetch from GW2 API
    const response = await fetch(
      `${process.env.ANET_WORLDS_ENDPOINT}?ids=all`,
      {
        headers: {
          'User-Agent': 'WvWGG-Vercel/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GW2 API error: ${response.status} ${response.statusText}`);
    }

    const worlds = await response.json();
    console.log(`[Cron] Fetched ${worlds.length} worlds from GW2 API`);

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          type: 'worlds',
          id: 'all',
          data: worlds,
          updatedAt: new Date().toISOString(),
        },
      })
    );

    console.log(`[Cron] Stored ${worlds.length} worlds in DynamoDB`);

    // Revalidate Next.js cache
    revalidateTag('worlds');

    return Response.json({
      success: true,
      worldCount: worlds.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error updating worlds:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
