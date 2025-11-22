# Build System Schema Migration Guide

This guide walks through deploying the new build system database schema to your DynamoDB table.

## Overview

We're adding 3 new Global Secondary Indexes (GSIs) to the existing `wvwgg-{stage}` table:
1. `gameVersion-validFrom-index`
2. `itemCategory-gameVersion-index`
3. `sourceType-sourceId-index`

**Important**: This is a **zero-downtime migration**. Existing data (matches, guilds, worlds) is **NOT affected**.

## Pre-Migration Checklist

- [ ] Review `docs/BUILD_DATABASE_SCHEMA.md`
- [ ] Review updated CDK stack in `cdk/lib/wvwgg-stack-simplified.ts`
- [ ] Ensure AWS credentials are configured
- [ ] Backup existing DynamoDB data (optional, but recommended)

## Migration Steps

### Step 1: Review Changes

Check the CDK diff to see what will change:

```bash
cd cdk
cdk diff WvWGG-Dev-DataLayer
```

Expected output:
```
Resources
[~] AWS::DynamoDB::GlobalTable WvWGGTable-dev
 └─ [+] GlobalSecondaryIndexes
     ├─ [+] gameVersion-validFrom-index
     ├─ [+] itemCategory-gameVersion-index
     └─ [+] sourceType-sourceId-index
```

### Step 2: Deploy to Dev

Deploy the changes to the dev environment first:

```bash
cdk deploy WvWGG-Dev-DataLayer
```

This will:
1. Add 3 new GSIs to `wvwgg-dev` table
2. DynamoDB will backfill indexes (takes ~5-10 minutes for empty indexes)
3. Existing data remains untouched

**Wait for deployment to complete** before proceeding.

### Step 3: Verify Dev Deployment

Check that the GSIs were created:

```bash
aws dynamodb describe-table \
  --table-name wvwgg-dev \
  --query 'Table.GlobalSecondaryIndexes[*].IndexName'
```

Expected output:
```json
[
  "type-interval-index",
  "matchId-interval-index",
  "gameVersion-validFrom-index",
  "itemCategory-gameVersion-index",
  "sourceType-sourceId-index"
]
```

Check GSI status (should be ACTIVE):

```bash
aws dynamodb describe-table \
  --table-name wvwgg-dev \
  --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus]' \
  --output table
```

Expected:
```
--------------------------------------------
|           DescribeTable                  |
+----------------------------------+--------+
|  type-interval-index             | ACTIVE |
|  matchId-interval-index          | ACTIVE |
|  gameVersion-validFrom-index     | ACTIVE |
|  itemCategory-gameVersion-index  | ACTIVE |
|  sourceType-sourceId-index       | ACTIVE |
+----------------------------------+--------+
```

### Step 4: Test Dev Environment

Test that existing functionality still works:

1. **Test existing features**:
   - Visit https://your-dev-site.vercel.app/matches
   - Verify match data loads correctly
   - Check guild search works

2. **Test new GSIs** (optional, requires data):
   ```typescript
   // In your Next.js API route or server component
   import { QueryCommand } from '@aws-sdk/lib-dynamodb'
   import { getDynamoDBClient } from '@/server/queries'

   const docClient = await getDynamoDBClient()

   // Test gameVersion-validFrom-index
   const result = await docClient.send(new QueryCommand({
     TableName: 'wvwgg-dev',
     IndexName: 'gameVersion-validFrom-index',
     KeyConditionExpression: 'gameVersion = :version',
     ExpressionAttributeValues: {
       ':version': '2025-01-22'
     },
     Limit: 1
   }))

   console.log('GSI test successful:', result.Count === 0) // true (no data yet)
   ```

### Step 5: Deploy to Prod (When Ready)

**Only after verifying dev works!**

```bash
cdk deploy WvWGG-Prod-DataLayer
```

This will:
1. Add 3 new GSIs to `wvwgg-prod` table
2. Backfill indexes (takes ~5-10 minutes)
3. Existing production data remains untouched

### Step 6: Monitor Prod Deployment

Watch CloudWatch metrics during deployment:

```bash
# Monitor table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=wvwgg-prod \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average
```

Expected: No significant change in read/write capacity (GSIs are being built in background).

## Rollback Plan

If something goes wrong, you can remove the GSIs:

### Option 1: Remove GSIs via CDK

1. Edit `cdk/lib/wvwgg-stack-simplified.ts`
2. Comment out the new GSIs
3. Run `cdk deploy`

### Option 2: Remove GSIs via AWS CLI

```bash
# Remove a specific GSI
aws dynamodb update-table \
  --table-name wvwgg-dev \
  --global-secondary-index-updates '[{
    "Delete": {
      "IndexName": "gameVersion-validFrom-index"
    }
  }]'
```

**Note**: Removing GSIs is non-destructive. It only removes the index, not the table data.

## Cost Impact

Adding 3 empty GSIs has **minimal cost impact**:

| Item | Before | After | Increase |
|------|--------|-------|----------|
| Storage | ~100 MB | ~100 MB | 0% |
| Reads | $2.00/mo | $2.00/mo | 0% |
| Writes | $0.20/mo | $0.20/mo | 0% |
| **TOTAL** | **$2.20/mo** | **$2.20/mo** | **$0/mo** |

Once build data is populated (~1.6 MB):

| Item | After Data | Increase |
|------|------------|----------|
| Storage | ~102 MB | +2 MB |
| Reads | $2.18/mo | +$0.18/mo |
| Writes | $0.25/mo | +$0.05/mo |
| **TOTAL** | **$2.43/mo** | **+$0.23/mo** |

## Post-Migration Steps

After successful deployment:

### 1. Update Vercel Environment Variables

The existing Vercel OIDC role already has permissions for the new GSIs (it has wildcard access to `${tableArn}/index/*`).

No environment variable changes needed! ✅

### 2. Verify OIDC Permissions

Check that Vercel can access new GSIs:

```bash
# Get OIDC role ARN from CDK output
ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name WvWGG-Dev-DataLayer \
  --query 'Stacks[0].Outputs[?OutputKey==`VercelOidcRoleArn-dev`].OutputValue' \
  --output text)

# Check role policy
aws iam get-role-policy \
  --role-name vercel-oidc-dev \
  --policy-name DynamoDBAccess
```

Expected: Policy includes `${tableArn}/index/*` in resources.

### 3. Create Data Sync Lambda (Next Phase)

Now that the schema is deployed, the next step is creating the data sync Lambda:

**File to create**: `cdk/lambda/sync-game-data.ts`

See `docs/BUILD_SYSTEM_SETUP.md` for details.

## Troubleshooting

### GSI Status is CREATING for Too Long

**Problem**: GSI shows `CREATING` status for >15 minutes

**Solution**: This is normal for tables with lots of data. For empty indexes, should complete in 5-10 minutes.

Check progress:
```bash
aws dynamodb describe-table \
  --table-name wvwgg-dev \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`gameVersion-validFrom-index`].[IndexStatus,ItemCount]'
```

### Deployment Fails with "Resource Limit Exceeded"

**Problem**: DynamoDB has limits on concurrent GSI operations

**Solution**: Deploy GSIs one at a time:

1. Comment out 2 of the 3 GSIs in CDK stack
2. Deploy with just 1 GSI
3. Wait for ACTIVE status
4. Uncomment next GSI and deploy
5. Repeat

### Existing Features Broken After Deployment

**Problem**: Match history or guild search not working

**Solution**: This shouldn't happen (GSIs are additive), but if it does:

1. Check application logs in Vercel
2. Verify OIDC role has correct permissions
3. Test DynamoDB access manually:
   ```bash
   aws dynamodb get-item \
     --table-name wvwgg-dev \
     --key '{"type":{"S":"matches"},"id":{"S":"all"}}'
   ```

## Monitoring

After deployment, monitor these metrics:

### CloudWatch Dashboard

Create a dashboard to track:
- Table read/write capacity
- GSI read/write capacity
- Throttled requests (should be 0)
- Consumed capacity units

### Cost Explorer

Check DynamoDB costs:
1. Open AWS Cost Explorer
2. Filter by Service: DynamoDB
3. Group by: Usage Type
4. Compare before/after costs

Expected increase: ~$0.23/month after data population

## Success Criteria

✅ Migration is successful when:

1. All 5 GSIs show `ACTIVE` status
2. Existing features (matches, guilds) work correctly
3. No throttled requests in CloudWatch
4. No errors in application logs
5. Cost increase is minimal (<$1/month)

## Next Steps

After successful migration:

1. ✅ Deploy infrastructure (this guide)
2. ⏳ Create data sync Lambda (`cdk/lambda/sync-game-data.ts`)
3. ⏳ Create query functions (`server/build-queries.ts`)
4. ⏳ Implement propagator engine (`lib/propagators/`)

See `docs/BUILD_SYSTEM_SETUP.md` for the complete roadmap.

---

## Quick Reference Commands

```bash
# Dev deployment
cd cdk
cdk diff WvWGG-Dev-DataLayer
cdk deploy WvWGG-Dev-DataLayer

# Check GSI status
aws dynamodb describe-table --table-name wvwgg-dev \
  --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus]' \
  --output table

# Prod deployment (after dev verification)
cdk deploy WvWGG-Prod-DataLayer

# Rollback (if needed)
# Edit cdk/lib/wvwgg-stack-simplified.ts to remove GSIs
cdk deploy WvWGG-Dev-DataLayer
```

---

**Questions?** Open a GitHub issue or check `docs/BUILD_DATABASE_SCHEMA.md` for details.
