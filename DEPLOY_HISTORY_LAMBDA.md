# Deploy Historical Snapshot Lambda

The Lambda function has been updated to store hourly snapshots of match data. Follow these steps to deploy it to production:

## Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- CDK CLI installed (`npm install -g aws-cdk`)

## Deployment Steps

### Option 1: Deploy from CDK Directory (Recommended)

```bash
cd /home/alex/wvwgg/cdk

# Install dependencies
npm install

# Set environment
export WVWGG_STAGE=prod

# Deploy the Lambda function
cdk deploy --all --app "npx ts-node bin/cdk-simplified.ts"
```

### Option 2: Update Lambda Function Directly

If you don't want to redeploy the entire stack:

```bash
cd /home/alex/wvwgg/cdk/lambda

# Build the Lambda
npm run build  # or compile TypeScript manually

# Package the Lambda
zip -r get-matches.zip get-matches.js node_modules/

# Update Lambda function
aws lambda update-function-code \
  --function-name WvWGGFetchMatchesLambda-prod \
  --zip-file fileb://get-matches.zip \
  --region us-east-1
```

## What Happens After Deployment

1. **Hourly Snapshots**: Every hour, the Lambda will store a snapshot of all match data
2. **7-Day Retention**: Snapshots automatically expire after 7 days (DynamoDB TTL)
3. **No Duplicates**: Only one snapshot per hour to save storage costs
4. **Gradual Data**: History will build up over time (full 7 days after 1 week)

## Verify Deployment

Check if snapshots are being created:

```bash
# Query DynamoDB for match-history items
aws dynamodb scan \
  --table-name WvWGG-Prod-WvWGGTableprod11E5AA77-5V5DG8BCDEQ4 \
  --filter-expression "#type = :type" \
  --expression-attribute-names '{"#type":"type"}' \
  --expression-attribute-values '{":type":{"S":"match-history"}}' \
  --region us-east-1 \
  --max-items 5
```

## Frontend Features Now Available

Once snapshots start accumulating (after a few hours):
- **Score progression charts** on match detail pages
- **Lead time statistics** showing % time each team was winning
- **Time range selection** (24h, 3d, 7d views)
- **Metric switching** between Score, Kills, and Victory Points
- **Auto-refresh** every 5 minutes

## Cost Impact

Minimal - approximately:
- **Storage**: ~1MB per hour × 168 hours (7 days) = ~168MB per week
- **Queries**: ~10-20 reads per user per page load
- **Estimated cost**: < $0.50/month additional

## Rollback

If needed, the Lambda will continue to work without the snapshot feature - it will just skip that part if it fails.
