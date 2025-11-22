# Phased GSI Deployment Guide

## Problem

DynamoDB has a limitation: **You can only add ONE Global Secondary Index at a time** to an existing table.

Since we're adding 3 new GSIs, we need to deploy them in phases.

## Current Status

Your deployment failed with:
```
"Cannot perform more than one GSI creation or deletion in a single update"
```

The stack has been rolled back to `UPDATE_ROLLBACK_COMPLETE` status.

## Solution: 3-Phase Deployment

We'll deploy the GSIs one at a time:
- **Phase 1**: `gameVersion-validFrom-index`
- **Phase 2**: `itemCategory-gameVersion-index`
- **Phase 3**: `sourceType-sourceId-index`

---

## Phase 1: Deploy First GSI

### Step 1: Verify CDK Stack

The CDK stack is already configured for Phase 1 (only first GSI uncommented):

```typescript
// cdk/lib/wvwgg-stack-simplified.ts
globalSecondaryIndexes: [
  // Existing GSIs
  { indexName: 'type-interval-index', ... },
  { indexName: 'matchId-interval-index', ... },

  // NEW: Phase 1
  {
    indexName: 'gameVersion-validFrom-index',
    partitionKey: { name: 'gameVersion', type: STRING },
    sortKey: { name: 'validFrom', type: STRING },
  }
  // Phase 2 and 3 are commented out
]
```

### Step 2: Deploy Phase 1

```bash
cd cdk
cdk deploy WvWGG-Prod-DataLayer
```

Expected output:
```
✅  WvWGG-Prod-DataLayer

Outputs:
...
```

### Step 3: Wait for GSI to be ACTIVE

Monitor GSI creation status (takes 5-10 minutes):

**Option A: AWS Console**
1. Go to DynamoDB console
2. Select `wvwgg-prod` table
3. Click "Indexes" tab
4. Wait for `gameVersion-validFrom-index` to show **ACTIVE** status

**Option B: AWS CLI** (if available)
```bash
aws dynamodb describe-table \
  --table-name wvwgg-prod \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`gameVersion-validFrom-index`].[IndexStatus]' \
  --output text
```

Keep running this until it returns `ACTIVE`.

### Step 4: Verify Phase 1

Once ACTIVE, verify the GSI exists:

```bash
aws dynamodb describe-table \
  --table-name wvwgg-prod \
  --query 'Table.GlobalSecondaryIndexes[*].IndexName'
```

Expected:
```json
[
  "type-interval-index",
  "matchId-interval-index",
  "gameVersion-validFrom-index"  ← NEW!
]
```

---

## Phase 2: Deploy Second GSI

### Step 1: Uncomment Phase 2 GSI

Edit `cdk/lib/wvwgg-stack-simplified.ts`:

```typescript
// Find this section around line 56-62
// Build system queries - DEPLOY PHASE 2: Item categorization
// UNCOMMENT AFTER PHASE 1 COMPLETES
// {
//   indexName: 'itemCategory-gameVersion-index',
//   partitionKey: { name: 'itemCategory', type: cdk.aws_dynamodb.AttributeType.STRING },
//   sortKey: { name: 'gameVersion', type: cdk.aws_dynamodb.AttributeType.STRING },
// },

// Change to:
// Build system queries - DEPLOY PHASE 2: Item categorization
{
  indexName: 'itemCategory-gameVersion-index',
  partitionKey: { name: 'itemCategory', type: cdk.aws_dynamodb.AttributeType.STRING },
  sortKey: { name: 'gameVersion', type: cdk.aws_dynamodb.AttributeType.STRING },
},
```

**Important**: Add a comma after the Phase 1 GSI closing brace!

### Step 2: Deploy Phase 2

```bash
cd cdk
cdk deploy WvWGG-Prod-DataLayer
```

### Step 3: Wait for GSI to be ACTIVE

Monitor until `itemCategory-gameVersion-index` shows **ACTIVE** (5-10 minutes).

### Step 4: Verify Phase 2

```bash
aws dynamodb describe-table \
  --table-name wvwgg-prod \
  --query 'Table.GlobalSecondaryIndexes[*].IndexName'
```

Expected:
```json
[
  "type-interval-index",
  "matchId-interval-index",
  "gameVersion-validFrom-index",
  "itemCategory-gameVersion-index"  ← NEW!
]
```

---

## Phase 3: Deploy Third GSI

### Step 1: Uncomment Phase 3 GSI

Edit `cdk/lib/wvwgg-stack-simplified.ts`:

```typescript
// Find this section around line 63-69
// Build system queries - DEPLOY PHASE 3: Modifier source lookup
// UNCOMMENT AFTER PHASE 2 COMPLETES
// {
//   indexName: 'sourceType-sourceId-index',
//   partitionKey: { name: 'sourceType', type: cdk.aws_dynamodb.AttributeType.STRING },
//   sortKey: { name: 'sourceId', type: cdk.aws_dynamodb.AttributeType.STRING },
// }

// Change to:
// Build system queries - DEPLOY PHASE 3: Modifier source lookup
{
  indexName: 'sourceType-sourceId-index',
  partitionKey: { name: 'sourceType', type: cdk.aws_dynamodb.AttributeType.STRING },
  sortKey: { name: 'sourceId', type: cdk.aws_dynamodb.AttributeType.STRING },
}
```

### Step 2: Deploy Phase 3

```bash
cd cdk
cdk deploy WvWGG-Prod-DataLayer
```

### Step 3: Wait for GSI to be ACTIVE

Monitor until `sourceType-sourceId-index` shows **ACTIVE** (5-10 minutes).

### Step 4: Verify Phase 3 - FINAL

```bash
aws dynamodb describe-table \
  --table-name wvwgg-prod \
  --query 'Table.GlobalSecondaryIndexes[*].IndexName'
```

Expected (all 5 GSIs):
```json
[
  "type-interval-index",
  "matchId-interval-index",
  "gameVersion-validFrom-index",
  "itemCategory-gameVersion-index",
  "sourceType-sourceId-index"  ← NEW!
]
```

---

## Timeline

| Phase | Action | Wait Time | Total |
|-------|--------|-----------|-------|
| Phase 1 | Deploy first GSI | 5-10 min | 10 min |
| Phase 2 | Deploy second GSI | 5-10 min | 20 min |
| Phase 3 | Deploy third GSI | 5-10 min | 30 min |

**Total Time**: ~30 minutes for complete deployment

---

## Automation Script (Optional)

If you want to automate this, here's a bash script:

```bash
#!/bin/bash
# deploy-gsis-phased.sh

set -e

STACK_NAME="WvWGG-Prod-DataLayer"
TABLE_NAME="wvwgg-prod"

echo "=== Phase 1: Deploy gameVersion-validFrom-index ==="
cd cdk
cdk deploy $STACK_NAME --require-approval never

echo "Waiting for gameVersion-validFrom-index to be ACTIVE..."
while true; do
  STATUS=$(aws dynamodb describe-table \
    --table-name $TABLE_NAME \
    --query 'Table.GlobalSecondaryIndexes[?IndexName==`gameVersion-validFrom-index`].[IndexStatus]' \
    --output text)

  if [ "$STATUS" == "ACTIVE" ]; then
    echo "✅ Phase 1 complete!"
    break
  fi

  echo "Status: $STATUS (waiting 30s...)"
  sleep 30
done

echo ""
echo "=== Phase 2: Uncomment itemCategory-gameVersion-index ==="
echo "Please uncomment Phase 2 GSI in cdk/lib/wvwgg-stack-simplified.ts"
echo "Press ENTER when ready to deploy Phase 2..."
read

cdk deploy $STACK_NAME --require-approval never

echo "Waiting for itemCategory-gameVersion-index to be ACTIVE..."
while true; do
  STATUS=$(aws dynamodb describe-table \
    --table-name $TABLE_NAME \
    --query 'Table.GlobalSecondaryIndexes[?IndexName==`itemCategory-gameVersion-index`].[IndexStatus]' \
    --output text)

  if [ "$STATUS" == "ACTIVE" ]; then
    echo "✅ Phase 2 complete!"
    break
  fi

  echo "Status: $STATUS (waiting 30s...)"
  sleep 30
done

echo ""
echo "=== Phase 3: Uncomment sourceType-sourceId-index ==="
echo "Please uncomment Phase 3 GSI in cdk/lib/wvwgg-stack-simplified.ts"
echo "Press ENTER when ready to deploy Phase 3..."
read

cdk deploy $STACK_NAME --require-approval never

echo "Waiting for sourceType-sourceId-index to be ACTIVE..."
while true; do
  STATUS=$(aws dynamodb describe-table \
    --table-name $TABLE_NAME \
    --query 'Table.GlobalSecondaryIndexes[?IndexName==`sourceType-sourceId-index`].[IndexStatus]' \
    --output text)

  if [ "$STATUS" == "ACTIVE" ]; then
    echo "✅ Phase 3 complete!"
    break
  fi

  echo "Status: $STATUS (waiting 30s...)"
  sleep 30
done

echo ""
echo "🎉 All 3 GSIs deployed successfully!"
aws dynamodb describe-table \
  --table-name $TABLE_NAME \
  --query 'Table.GlobalSecondaryIndexes[*].IndexName'
```

Save as `deploy-gsis-phased.sh`, make executable:
```bash
chmod +x deploy-gsis-phased.sh
./deploy-gsis-phased.sh
```

---

## Troubleshooting

### Stack Still in UPDATE_ROLLBACK_COMPLETE

If the stack is stuck in rollback state, you may need to continue the rollback:

```bash
aws cloudformation continue-update-rollback \
  --stack-name WvWGG-Prod-DataLayer
```

Then wait for status to return to `UPDATE_ROLLBACK_COMPLETE` or `UPDATE_COMPLETE` before proceeding with Phase 1.

### GSI Takes Too Long (>15 minutes)

This is normal for tables with lots of data. DynamoDB is backfilling the index. You can continue to use the table - GSI creation happens in the background.

### Deployment Fails Again

If a deployment fails:
1. Check CloudWatch Logs for the stack
2. Verify you only have ONE new GSI uncommented
3. Ensure previous GSIs are ACTIVE before adding next one

---

## Quick Reference

**Current State**: Phase 1 ready to deploy (first GSI uncommented)

**Next Step**: Run `cd cdk && cdk deploy WvWGG-Prod-DataLayer`

**After Each Phase**:
1. Wait for GSI to be ACTIVE
2. Uncomment next GSI
3. Deploy again
4. Repeat

---

For questions or issues, check `docs/BUILD_SCHEMA_MIGRATION.md` or open a GitHub issue.
