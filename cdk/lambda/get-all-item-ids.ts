/**
 * Lambda: Get All Item IDs
 *
 * Fetches ALL item IDs (UpgradeComponents + Consumables) from GW2 API
 * and writes them to S3 chunks for batch processing by Step Function
 *
 * This combines what used to be separate get-upgradecomponent-ids and
 * get-consumable-ids steps, since they process items the same way.
 *
 * Triggered by: Step Function
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.REGION });
const BUCKET_NAME = process.env.BUCKET_NAME!;
const GW2_API_BASE = process.env.GW2_API_BASE!;
const CHUNK_SIZE = 5000; // Process 5k items per chunk to avoid 256KB limit

interface Result {
  success: boolean;
  totalIds: number;
  totalChunks: number;
  fileNames: string[];
  error?: string;
}

export async function handler(): Promise<{ statusCode: number; body: Result }> {
  console.log('Fetching all item IDs from GW2 API...');

  try {
    // Fetch both UpgradeComponents and Consumables in parallel
    const [upgradeResponse, consumableResponse] = await Promise.all([
      fetch(`${GW2_API_BASE}/items?type=UpgradeComponent`),
      fetch(`${GW2_API_BASE}/items?type=Consumable`)
    ]);

    if (!upgradeResponse.ok || !consumableResponse.ok) {
      throw new Error(`GW2 API error: ${upgradeResponse.status} / ${consumableResponse.status}`);
    }

    const [upgradeIds, consumableIds] = await Promise.all([
      upgradeResponse.json() as Promise<number[]>,
      consumableResponse.json() as Promise<number[]>
    ]);

    // Combine all IDs
    const allIds = [...upgradeIds, ...consumableIds];
    console.log(`Fetched ${upgradeIds.length} UpgradeComponent + ${consumableIds.length} Consumable = ${allIds.length} total IDs`);

    // Split into chunks to avoid 256KB state limit
    const chunks: number[][] = [];
    for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
      chunks.push(allIds.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Split ${allIds.length} IDs into ${chunks.length} chunks of ~${CHUNK_SIZE} items`);

    // Write each chunk to a separate S3 file
    const s3Keys: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const s3Key = `game-data-sync/all-items-ids-${timestamp}-chunk-${i}.json`;

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
        totalIds: allIds.length,
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
        totalIds: 0,
        totalChunks: 0,
        fileNames: [],
        error: errorMessage
      }
    };
  }
}
