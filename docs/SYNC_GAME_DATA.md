# Sync Game Data Lambda - User Guide

This document explains how to use the Sync Game Data Lambda function to populate your database with GW2 game data for the bidirectional build system.

## Overview

The `sync-game-data` Lambda function fetches data from the GW2 API and stores it in DynamoDB:

- **ItemStats**: Stat combinations (Berserker, Marauder, etc.)
- **Items**: Runes, sigils, infusions, food, utility
- **Modifiers**: Stat bonuses extracted from items
- **Formulas**: Stat formulas for propagator network

**Execution Time**: ~5-8 minutes
**API Calls**: ~300-500 requests to GW2 API
**Data Volume**: ~1.6 MB written to DynamoDB

## Prerequisites

- ✅ DynamoDB table deployed with 5 GSIs
- ✅ Lambda function deployed via CDK
- ✅ AWS CLI configured (optional, for manual invocation)

## Deployment

### Step 1: Deploy the Lambda

```bash
cd cdk
cdk deploy WvWGG-Prod-DataLayer
```

This will:
1. Create the `sync-game-data` Lambda function
2. Grant it read/write access to DynamoDB
3. Output the Lambda ARN for invocation

### Step 2: Verify Deployment

Check that the Lambda was created:

```bash
aws lambda get-function \
  --function-name WvWGGSyncGameDataLambda-prod \
  --query 'Configuration.FunctionName'
```

Expected output: `"WvWGGSyncGameDataLambda-prod"`

## Invoking the Lambda

### Method 1: AWS Console

1. Open **AWS Lambda Console**
2. Search for `WvWGGSyncGameDataLambda-prod`
3. Click **Test** tab
4. Create test event (any JSON, e.g., `{}`)
5. Click **Test**

Monitor progress in **CloudWatch Logs**.

### Method 2: AWS CLI

Invoke the Lambda:

```bash
aws lambda invoke \
  --function-name WvWGGSyncGameDataLambda-prod \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json | jq .
```

Expected output:
```json
{
  "success": true,
  "itemStatsProcessed": 150,
  "itemsProcessed": 450,
  "modifiersExtracted": 1000,
  "formulasCreated": 7,
  "errors": [],
  "duration": 324567
}
```

### Method 3: EventBridge Schedule (Optional)

To run automatically daily:

**Add to CDK stack** (`cdk/lib/wvwgg-stack-simplified.ts`):

```typescript
// EventBridge Rule: Trigger syncGameDataLambda daily at 3 AM UTC
const syncGameDataRule = new events.Rule(this, `WvWGGSyncGameDataRule-${props.stage}`, {
  schedule: events.Schedule.cron({
    minute: '0',
    hour: '3',
    day: '*',
    month: '*',
    year: '*'
  }),
  targets: [new eventTargets.LambdaFunction(syncGameDataLambda)]
});
syncGameDataRule.node.addDependency(syncGameDataLambda);
```

Then deploy:
```bash
cdk deploy WvWGG-Prod-DataLayer
```

## Monitoring

### CloudWatch Logs

View logs in real-time:

```bash
aws logs tail /aws/lambda/WvWGGSyncGameDataLambda-prod --follow
```

### Execution Phases

The Lambda runs in 6 phases:

```
=== PHASE 1: ItemStats ===
Fetching itemstats from GW2 API...
Found 150 itemstats
Fetched 150/150 itemstats
Wrote batch 1/6
✅ Synced 150 itemstats

=== PHASE 2: Upgrade Components ===
Fetching items of type UpgradeComponent...
Found 250 UpgradeComponent items
Fetched 250/250 UpgradeComponent items
✅ Synced 250 upgrade components

=== PHASE 3: Consumables ===
Fetching items of type Consumable...
Found 200 Consumable items
Fetched 200/200 Consumable items
✅ Synced 200 consumables

=== PHASE 4: Modifiers ===
Wrote batch 1/40
...
✅ Synced 1000 modifiers

=== PHASE 5: Stat Formulas ===
✅ Created 7 stat formulas

=== PHASE 6: Game Version ===
Created game version record: 2025-01-22

✅ Sync complete in 324.5s
```

### Success Criteria

✅ Sync is successful when:

1. `success: true` in response
2. All phases complete without errors
3. Data appears in DynamoDB
4. No errors in CloudWatch Logs

## Verifying Data

### Check ItemStats

```bash
aws dynamodb query \
  --table-name wvwgg-prod \
  --key-condition-expression "#type = :type" \
  --expression-attribute-names '{"#type":"type"}' \
  --expression-attribute-values '{":type":{"S":"itemstat"}}' \
  --select COUNT
```

Expected: `Count: 150`

### Check Items by Category

Get all runes:

```bash
aws dynamodb query \
  --table-name wvwgg-prod \
  --index-name itemCategory-gameVersion-index \
  --key-condition-expression "itemCategory = :category" \
  --expression-attribute-values '{":category":{"S":"rune"}}' \
  --select COUNT
```

Expected: `Count: 80` (approximately)

### Check Modifiers

```bash
aws dynamodb query \
  --table-name wvwgg-prod \
  --key-condition-expression "#type = :type" \
  --expression-attribute-names '{"#type":"type"}' \
  --expression-attribute-values '{":type":{"S":"stat-modifier"}}' \
  --select COUNT
```

Expected: `Count: 1000+`

### Check Stat Formulas

```bash
aws dynamodb query \
  --table-name wvwgg-prod \
  --key-condition-expression "#type = :type" \
  --expression-attribute-names '{"#type":"type"}' \
  --expression-attribute-values '{":type":{"S":"stat-formula"}}' \
  --limit 10
```

Expected: Returns 7 formulas (critChance, critDamage, effectivePower, health, armor, boonDuration, conditionDuration)

### Sample Data Query

Get Berserker stats:

```bash
aws dynamodb get-item \
  --table-name wvwgg-prod \
  --key '{"type":{"S":"itemstat"},"id":{"S":"584"}}' | jq .Item
```

Expected output:
```json
{
  "type": { "S": "itemstat" },
  "id": { "S": "584" },
  "name": { "S": "Berserker" },
  "attributes": {
    "L": [
      {
        "M": {
          "attribute": { "S": "Power" },
          "multiplier": { "N": "0.35" },
          "value": { "N": "63" }
        }
      },
      ...
    ]
  },
  "aliases": { "L": [{ "S": "Zerk" }, { "S": "Zerker" }] },
  "metaRating": { "N": "5" }
}
```

## Re-running Sync

The sync is **idempotent** - you can run it multiple times safely:

- Existing data will be overwritten with latest from GW2 API
- Game version record will be updated
- No duplicate data created

**When to re-run:**

- After GW2 balance patches
- When new items are added to the game
- If initial sync failed
- To refresh data

**Frequency recommendation:** Daily (automated) or manual after patches

## Troubleshooting

### Timeout Error

**Problem**: Lambda times out after 10 minutes

**Solution**: GW2 API might be slow. Try again later, or increase Lambda timeout:

```typescript
// In CDK stack
timeout: cdk.Duration.minutes(15), // Increase from 10 to 15
```

### Rate Limiting

**Problem**: `429 Too Many Requests` from GW2 API

**Solution**: The Lambda already has rate limiting (100ms delays). If still occurring:
- Wait 5 minutes
- Run sync during off-peak hours (3-6 AM UTC)

### Partial Failure

**Problem**: Some phases complete, others fail

**Response**: Check which phase failed:
```json
{
  "success": false,
  "itemStatsProcessed": 150,
  "itemsProcessed": 250,
  "modifiersExtracted": 0,  // ← Failed here
  "errors": ["Failed to extract modifiers: ..."]
}
```

**Solution**:
- Re-run the sync (will retry failed phases)
- Check CloudWatch Logs for details

### Empty Results

**Problem**: DynamoDB queries return 0 items

**Check:**
1. Sync completed successfully
2. Using correct table name (`wvwgg-prod`)
3. Querying correct entity type (`itemstat`, `enhanced-item`, etc.)

## Cost Estimate

**Per Sync:**
- Lambda execution: $0.002 (512 MB × 5 min)
- DynamoDB writes: $0.05 (~1500 items × 2 write units)
- GW2 API calls: Free

**Total per sync**: ~$0.052

**Monthly (daily sync)**: ~$1.56/month

## Next Steps

After successful sync:

1. ✅ Verify data in DynamoDB
2. ⏳ Create server-side query functions (`server/build-queries.ts`)
3. ⏳ Implement propagator engine (`lib/propagators/`)
4. ⏳ Build bidirectional build editor UI

See `docs/BUILD_SYSTEM_SETUP.md` for the complete roadmap.

## Example Queries (TypeScript)

Once data is synced, you can query it from your application:

```typescript
import { getDynamoDBClient } from '@/server/queries';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

// Get all itemstats
const docClient = await getDynamoDBClient();
const result = await docClient.send(new QueryCommand({
  TableName: 'wvwgg-prod',
  KeyConditionExpression: '#type = :type',
  ExpressionAttributeNames: {
    '#type': 'type'
  },
  ExpressionAttributeValues: {
    ':type': 'itemstat'
  }
}));

console.log(`Found ${result.Items?.length} itemstats`);
```

## Support

- **Lambda Code**: `cdk/lambda/sync-game-data.ts`
- **CDK Stack**: `cdk/lib/wvwgg-stack-simplified.ts`
- **Schema Docs**: `docs/BUILD_DATABASE_SCHEMA.md`
- **Issues**: https://github.com/adekau/wvwgg-vibecoded/issues

---

For questions about the sync process, open a GitHub issue or contact the development team.
