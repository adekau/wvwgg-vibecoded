import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testDynamoDBConnection() {
  console.log('Testing DynamoDB connection...\n');

  // Check environment variables
  console.log('Environment variables:');
  console.log('  AWS_REGION:', process.env.AWS_REGION);
  console.log('  TABLE_NAME:', process.env.TABLE_NAME);
  console.log('  AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✓ Set' : '✗ Not set');
  console.log('  AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Not set');
  console.log();

  try {
    // Create DynamoDB client
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const docClient = DynamoDBDocumentClient.from(client);

    // Test 1: Query matches data
    console.log('Test 1: Querying matches data...');
    const matchesResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { type: 'matches', id: 'all' },
      })
    );

    if (matchesResponse.Item) {
      console.log('✓ Successfully retrieved matches data');
      console.log('  Data keys:', Object.keys(matchesResponse.Item));
      if (matchesResponse.Item.data) {
        const matchCount = Object.keys(matchesResponse.Item.data).length;
        console.log('  Number of matches:', matchCount);
      }
    } else {
      console.log('⚠ No matches data found in DynamoDB');
    }
    console.log();

    // Test 2: Query worlds data
    console.log('Test 2: Querying worlds data...');
    const worldsResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { type: 'worlds', id: 'all' },
      })
    );

    if (worldsResponse.Item) {
      console.log('✓ Successfully retrieved worlds data');
      if (worldsResponse.Item.data) {
        const worldCount = worldsResponse.Item.data.length;
        console.log('  Number of worlds:', worldCount);
      }
    } else {
      console.log('⚠ No worlds data found in DynamoDB');
    }
    console.log();

    console.log('✅ All DynamoDB connectivity tests passed!');
  } catch (error) {
    console.error('❌ Error testing DynamoDB connection:', error);
    process.exit(1);
  }
}

testDynamoDBConnection();
