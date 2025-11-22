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

    // Split into chunks to avoid 256KB state limit
    // Each chunk will be processed by a separate DistributedMap iteration
    const CHUNK_SIZE = 5000; // Process 5k items per chunk
    const chunks: number[][] = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Split ${ids.length} IDs into ${chunks.length} chunks of ~${CHUNK_SIZE} items`);

    // Write each chunk to a separate S3 file
    const s3Keys: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const s3Key = `game-data-sync/${itemType.toLowerCase()}-ids-${timestamp}-chunk-${i}.json`;

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: JSON.stringify(chunks[i]),
        ContentType: 'application/json'
      }));

      s3Keys.push(s3Key);
    }

    console.log(`Wrote ${chunks.length} chunk files to S3`);

    return {
      statusCode: 200,
      body: {
        fileNames: s3Keys,  // Return array of S3 keys (one per chunk)
        success: true,
        itemType,
        totalIds: ids.length,
        totalChunks: chunks.length
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
