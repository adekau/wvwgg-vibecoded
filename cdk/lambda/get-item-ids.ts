/**
 * Lambda: Get Item IDs
 *
 * Fetches all item IDs for a given type from GW2 API
 * and writes them to S3 for batch processing by Step Function
 *
 * Triggered by: Step Function
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.REGION });
const BUCKET_NAME = process.env.BUCKET_NAME!;
const GW2_API_BASE = process.env.GW2_API_BASE!;

interface Event {
  itemType: 'UpgradeComponent' | 'Consumable';
}

interface Result {
  success: boolean;
  itemType: string;
  totalIds: number;
  s3Key: string;
  error?: string;
}

export async function handler(event: Event): Promise<{ statusCode: number; body: Result }> {
  console.log('Event:', JSON.stringify(event));

  try {
    const { itemType } = event;

    // Fetch item IDs from GW2 API
    console.log(`Fetching ${itemType} IDs from GW2 API...`);
    const response = await fetch(`${GW2_API_BASE}/items?type=${itemType}`);

    if (!response.ok) {
      throw new Error(`GW2 API returned ${response.status}: ${response.statusText}`);
    }

    const ids = await response.json() as number[];
    console.log(`Fetched ${ids.length} ${itemType} IDs`);

    // Write IDs to S3 as JSON array
    const s3Key = `game-data-sync/${itemType.toLowerCase()}-ids-${Date.now()}.json`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(ids),
      ContentType: 'application/json'
    }));

    console.log(`Wrote ${ids.length} IDs to S3: ${s3Key}`);

    return {
      statusCode: 200,
      body: {
        fileNames: [s3Key],  // Return as array for Map iteration (guild sync pattern)
        success: true,
        itemType,
        totalIds: ids.length
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to get item IDs:', errorMessage);

    return {
      statusCode: 500,
      body: {
        success: false,
        itemType: event.itemType,
        totalIds: 0,
        s3Key: '',
        error: errorMessage
      }
    };
  }
}
