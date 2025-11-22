# Glicko-2 Rating System Setup

This document explains how to deploy and initialize the Glicko-2 rating system for WvW alliance guilds.

## Overview

The Glicko-2 rating system tracks the skill level of alliance guilds based on their WvW match performance. This provides:

- **Accurate predictions** for match outcomes, especially after alliance relinking
- **Skill-based ratings** that persist across world restructuring
- **Hybrid predictions** combining Glicko ratings with historical time-window performance

## Components

### 1. Lambda Functions

**update-glicko-ratings.ts**
- **Purpose**: Automatically updates guild ratings after matches complete
- **Schedule**: Runs weekly on Fridays at 18:05 UTC (5 minutes after match reset)
- **Process**:
  1. Fetches completed matches
  2. Determines final standings (1st, 2nd, 3rd by VP)
  3. Calculates new ratings using Glicko-2 algorithm
  4. Updates guild ratings in DynamoDB

**populate-initial-glicko-ratings.ts**
- **Purpose**: One-time setup to initialize default ratings
- **Trigger**: Manual invocation
- **Process**:
  1. Finds all alliance guilds without ratings
  2. Sets default Glicko-2 ratings (1500 rating, 350 RD, 0.06 volatility)
  3. Updates guilds in DynamoDB

### 2. Rating Values

Default Glicko-2 ratings for new guilds:

```typescript
{
  rating: 1500,           // Skill level (standard starting point)
  ratingDeviation: 350,   // Uncertainty (max for new players)
  volatility: 0.06,       // Consistency (standard value)
  matchCount: 0,          // No matches played yet
  lastUpdated: ISO string // Current timestamp
}
```

### 3. Rating Tiers

Guilds are categorized into tiers based on rating:

| Tier | Rating Range | Color |
|------|-------------|-------|
| Legendary | 2200+ | Orange |
| Diamond | 2000-2199 | Cyan |
| Platinum | 1800-1999 | Teal |
| Gold | 1600-1799 | Gold |
| Silver | 1400-1599 | Silver |
| Bronze | 1200-1399 | Bronze |
| Iron | 0-1199 | Gray |

## Deployment

### Step 1: Deploy CDK Stack

Deploy the updated CDK stack to create the Lambda functions:

```bash
cd cdk

# Deploy to dev environment
cdk deploy WvWGG-Dev-DataLayer

# Deploy to prod environment (when ready)
cdk deploy WvWGG-Prod-DataLayer
```

This creates:
- `WvWGGUpdateGlickoRatingsLambda-{stage}` - Weekly rating updates
- `WvWGGPopulateInitialGlickoRatingsLambda-{stage}` - One-time initialization
- EventBridge rule for automatic weekly updates

### Step 2: Populate Initial Ratings

After deployment, populate default ratings for all alliance guilds.

#### Option A: Using the Helper Script (Recommended)

```bash
cd cdk

# Dry run first (shows what will be updated without making changes)
./scripts/populate-initial-ratings.sh dev true

# If the dry run looks good, run for real
./scripts/populate-initial-ratings.sh dev false

# For production
./scripts/populate-initial-ratings.sh prod false
```

#### Option B: Using AWS CLI Directly

```bash
# Get the function ARN from CloudFormation outputs
FUNCTION_ARN=$(aws cloudformation describe-stacks \
  --stack-name WvWGG-Dev-DataLayer \
  --query 'Stacks[0].Outputs[?OutputKey==`PopulateInitialGlickoRatingsLambdaArn-dev`].OutputValue' \
  --output text)

# Dry run
aws lambda invoke \
  --function-name "${FUNCTION_ARN}" \
  --payload '{"dryRun": true}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json | jq '.'

# Actual run
aws lambda invoke \
  --function-name "${FUNCTION_ARN}" \
  --payload '{"dryRun": false}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json | jq '.'
```

#### Option C: Using AWS Console

1. Go to AWS Lambda console
2. Find function: `WvWGG-{stage}-WvWGGPopulateInitialGlickoRatingsLambda-{stage}`
3. Create a test event with payload: `{"dryRun": true}`
4. Test to see dry run results
5. Update payload to `{"dryRun": false}` and invoke to populate ratings

### Step 3: Verify Setup

Check that ratings were populated:

```bash
# Query DynamoDB to check guild ratings
aws dynamodb query \
  --table-name wvwgg-dev \
  --key-condition-expression "#type = :type" \
  --expression-attribute-names '{"#type":"type"}' \
  --expression-attribute-values '{":type":{"S":"guild"}}' \
  --projection-expression "id,#data.#name,classification,glickoRating" \
  --expression-attribute-names '{"#type":"type","#data":"data","#name":"name"}' \
  --limit 5
```

Or check via the admin UI:
- Go to `/admin/ratings` in your app
- You should see all alliance guilds with their default ratings

## Monitoring

### CloudWatch Logs

Monitor Lambda executions:

```bash
# View recent rating update logs
aws logs tail /aws/lambda/WvWGG-Dev-WvWGGUpdateGlickoRatingsLambda-dev --follow

# View initialization logs
aws logs tail /aws/lambda/WvWGG-Dev-WvWGGPopulateInitialGlickoRatingsLambda-dev --follow
```

### Lambda Metrics

Check Lambda metrics in CloudWatch:
- Invocation count
- Error count
- Duration
- Throttles

### DynamoDB Metrics

Monitor DynamoDB table:
- Read/write capacity usage
- Throttled requests
- Latency

## Troubleshooting

### Issue: Lambda times out

**Cause**: Too many guilds to process in timeout window

**Solution**: Increase Lambda timeout in CDK stack:
```typescript
timeout: cdk.Duration.minutes(15), // Increase if needed
memorySize: 1024, // Increase memory for faster processing
```

### Issue: Guilds still show no ratings after population

**Possible causes**:
1. Lambda didn't execute successfully - check CloudWatch logs
2. Guild classification is not set to 'alliance' - verify in database
3. DynamoDB write was throttled - check DynamoDB metrics

**Solution**: Re-run populate Lambda or manually check guild records

### Issue: Rating updates not happening weekly

**Possible causes**:
1. EventBridge rule disabled - check rule status
2. Lambda permissions issue - verify IAM role has DynamoDB access
3. No completed matches to process - check if matches exist

**Solution**: Check EventBridge rule status and Lambda execution logs

## Manual Rating Updates

To manually trigger a rating update (outside the weekly schedule):

```bash
# Get function name
FUNCTION_NAME="WvWGG-Dev-WvWGGUpdateGlickoRatingsLambda-dev"

# Invoke manually
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  response.json

cat response.json | jq '.'
```

## Data Model

Guild records in DynamoDB:

```json
{
  "type": "guild",
  "id": "guild-uuid-here",
  "data": {
    "name": "Example Alliance",
    "tag": "EXMP",
    "worldId": 1001
  },
  "classification": "alliance",
  "glickoRating": {
    "rating": 1500,
    "ratingDeviation": 350,
    "volatility": 0.06,
    "matchCount": 0,
    "lastUpdated": "2025-01-15T18:05:00.000Z"
  }
}
```

## Testing

### Test Rating Calculation

Create a test event for the update Lambda:

```json
{
  "testMode": true,
  "mockMatches": [
    {
      "id": "1-1",
      "all_worlds": [
        {"id": 1001, "color": "red"},
        {"id": 1002, "color": "blue"},
        {"id": 1003, "color": "green"}
      ],
      "red": {"victoryPoints": 500},
      "blue": {"victoryPoints": 400},
      "green": {"victoryPoints": 300}
    }
  ]
}
```

### Test Dry Run

Always test with dry run first:

```bash
./scripts/populate-initial-ratings.sh dev true
```

Review output before running with `false`.

## Maintenance

### Re-initialize Ratings

If you need to reset all ratings (e.g., after a major game update):

1. Set all alliance guilds' ratings to default values
2. Run populate Lambda with `dryRun: false`
3. Wait for next match cycle to build up new ratings

### Add New Alliance Guilds

When new alliance guilds are added to the database:

1. Set their classification to 'alliance'
2. Run populate Lambda (it will only update guilds without ratings)
3. Alternatively, manually set their rating to default values

## Performance Optimization

For large numbers of guilds (100+):

1. **Increase Lambda memory**: More memory = faster CPU
2. **Batch processing**: Implemented in update Lambda (processes 25 guilds per batch)
3. **Parallel processing**: Consider splitting by region if needed
4. **DynamoDB provisioned capacity**: Switch from on-demand if usage is predictable

## Cost Considerations

Estimated AWS costs (dev environment):

- **Lambda executions**:
  - Weekly updates: ~$0.01/month
  - One-time populate: ~$0.001
- **DynamoDB storage**: ~$0.25/GB/month for ratings data
- **EventBridge**: Free tier covers weekly schedule

Production costs will be similar unless traffic scales significantly.

## Support

For issues or questions:

1. Check CloudWatch logs first
2. Review this documentation
3. Check `CLAUDE.md` for general codebase info
4. File an issue in the repository
