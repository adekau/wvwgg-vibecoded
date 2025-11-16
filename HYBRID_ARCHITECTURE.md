# WvW.gg Hybrid Architecture (AWS + Vercel)

## Overview

This is the **simplified CDK stack** for the WvW.gg hybrid architecture, where:
- **AWS:** Handles data fetching and storage (EventBridge, Lambda, DynamoDB, Step Functions)
- **Vercel:** Handles frontend hosting and serving (Next.js app from `adekau/wvwgg-vibecoded`)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          AWS (Data Layer)                        │
│                                                                  │
│  ┌───────────────────┐                                          │
│  │  EventBridge      │                                          │
│  │  Rules            │                                          │
│  ├───────────────────┤                                          │
│  │ Every 60s  ───────┼──▶ fetchMatchesLambda ───┐              │
│  │ Every 24h  ───────┼──▶ fetchWorldsLambda ────┤              │
│  └───────────────────┘                           │              │
│                                                  ▼              │
│  ┌────────────────────────────────────────────────────┐         │
│  │           DynamoDB Table                           │         │
│  │  - type: STRING (PK)                               │         │
│  │  - id: STRING (SK)                                 │         │
│  │  - data: { matches, worlds, guilds }               │         │
│  └────────────────────────────────────────────────────┘         │
│                    ▲                      ▲                     │
│                    │                      │                     │
│  ┌─────────────────┴──────────┐  ┌───────┴──────────┐          │
│  │  Step Functions            │  │  IAM User        │          │
│  │  (Guild Sync)              │  │  (Vercel)        │          │
│  │  ├─ getWvWGuildsLambda    │  │  - Read/Write    │          │
│  │  └─ getGuildBatchLambda   │  │    DynamoDB      │          │
│  └────────────────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                           │ DynamoDB Access
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Vercel (Frontend)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Next.js App (adekau/wvwgg-vibecoded)             │         │
│  │  - Server components fetch from DynamoDB           │         │
│  │  - Cached with Next.js tags                        │         │
│  │  - Static assets served by Vercel Edge Network     │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  https://wvwgg.vercel.app                                       │
└─────────────────────────────────────────────────────────────────┘
```

## What's Removed from Original CDK Stack

The following components have been **removed** as Vercel now handles them:

- ❌ **CloudFront Distribution** - Vercel Edge Network
- ❌ **Next.js Lambda (Docker)** - Vercel Serverless Functions
- ❌ **S3 Assets Bucket** - Vercel Build Output
- ❌ **WvWGGBuild construct** - Vercel handles builds
- ❌ **WvWGGAssets construct** - Vercel handles assets
- ❌ **WvWGGDistribution construct** - Vercel CDN
- ❌ **DNS Stack** - Managed by Vercel (optional: can keep for custom domain)

## What's Kept from Original CDK Stack

The following components are **still managed by AWS CDK**:

- ✅ **DynamoDB Table** - Shared data store
- ✅ **fetchMatchesLambda** - Updates matches every 60 seconds
- ✅ **fetchWorldsLambda** - Updates worlds every 24 hours
- ✅ **EventBridge Rules** - Triggers for Lambda functions
- ✅ **AutomationStack** - Guild sync with Step Functions
  - `getWvWGuildsLambda` - Fetches guild IDs by region
  - `getGuildBatchLambda` - Processes guild details in batches
  - Step Function orchestration with distributed map

## What's Added

- ✅ **IAM User (`vercel-deployment-user`)** - For Vercel to access DynamoDB
- ✅ **IAM Policy (`VercelDynamoDbAccess`)** - Grants read/write permissions to DynamoDB

## Stack Components

### 1. DynamoDB Table

**Purpose:** Centralized data store for matches, worlds, and guilds

**Schema:**
```
- Partition Key: type (STRING) - "matches", "worlds", "guild"
- Sort Key: id (STRING) - "all", guild ID, etc.
- Attributes: data (MAP), updatedAt (STRING)
```

**Data Types:**
- `matches:all` - All WvW matches formatted for display
- `worlds:all` - All world names and IDs
- `guild:{id}` - Individual guild details

### 2. Data Fetching Lambdas

**fetchMatchesLambda:**
- Trigger: EventBridge Rule (every 60 seconds)
- Source: GW2 API (`/v2/wvw/matches?ids=all`)
- Action: Fetch, format, and store in DynamoDB

**fetchWorldsLambda:**
- Trigger: EventBridge Rule (every 24 hours)
- Source: GW2 API (`/v2/worlds?ids=all`)
- Action: Fetch and store in DynamoDB

### 3. IAM User for Vercel

**User:** `vercel-deployment-user-{stage}`

**Permissions:**
- `dynamodb:GetItem` - Read single items
- `dynamodb:PutItem` - Write single items (for manual updates if needed)
- `dynamodb:Scan` - Read multiple items (for guilds)
- `dynamodb:Query` - Query by partition/sort key

**Access Keys:** Generate via AWS Console after deployment

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 22.x
3. AWS CDK installed globally: `npm install -g aws-cdk`

### Deploy Commands

**For Development:**
```bash
cd cdk
npm install
export WVWGG_STAGE=dev
cdk synth --app "npx ts-node bin/cdk-simplified.ts"
cdk deploy --all --app "npx ts-node bin/cdk-simplified.ts"
```

**For Production:**
```bash
cd cdk
npm install
export WVWGG_STAGE=prod
cdk synth --app "npx ts-node bin/cdk-simplified.ts"
cdk deploy --all --app "npx ts-node bin/cdk-simplified.ts"
```

### Post-Deployment Setup

1. **Create Access Keys for Vercel User:**
   ```bash
   aws iam create-access-key --user-name vercel-deployment-user-{stage}
   ```

2. **Configure Vercel Environment Variables:**
   ```bash
   # In the Vercel project (adekau/wvwgg-vibecoded)
   vercel env add AWS_ACCESS_KEY_ID production
   vercel env add AWS_SECRET_ACCESS_KEY production
   vercel env add AWS_REGION production
   vercel env add TABLE_NAME production
   ```

3. **Set Environment Variable Values:**
   - `AWS_ACCESS_KEY_ID`: From step 1
   - `AWS_SECRET_ACCESS_KEY`: From step 1
   - `AWS_REGION`: `us-east-1`
   - `TABLE_NAME`: Check CDK output for table name

## Outputs

After deployment, CDK will output:

- `DynamoDbTableName-{stage}`: Table name for Vercel configuration
- `VercelUserArn-{stage}`: IAM user ARN
- `VercelUserName-{stage}`: IAM user name for access key creation

## Cost Comparison

### Old Architecture (Full AWS)
- CloudFront: ~$10-20/month
- Lambda (Next.js): ~$20-30/month
- Lambda (Data fetchers): ~$5/month
- S3: ~$5/month
- DynamoDB: ~$10-20/month
- EventBridge: ~$1/month
- **Total: ~$51-76/month**

### New Hybrid Architecture (AWS + Vercel)
- Lambda (Data fetchers): ~$5/month
- DynamoDB: ~$10-20/month
- EventBridge: ~$1/month
- Vercel Hobby: $0/month (or Pro $20/month)
- **Total: ~$16-26/month** (Hobby) or **~$36-46/month** (Pro)

**Savings: ~$25-50/month (33-66% reduction)**

## Migration from Old Stack

If you have the old CDK stack deployed:

1. **Export DynamoDB data** (if needed):
   ```bash
   aws dynamodb scan --table-name <old-table-name> > backup.json
   ```

2. **Deploy new simplified stack** (this will create new resources)

3. **Update Vercel** to point to new DynamoDB table

4. **Verify** everything works in Vercel

5. **Destroy old stack**:
   ```bash
   export WVWGG_STAGE=dev  # or prod
   cdk destroy --all --app "npx ts-node bin/cdk.ts"
   ```

## Monitoring

**CloudWatch Logs:**
- `/aws/lambda/WvWGGFetchMatchesLambda-{stage}`
- `/aws/lambda/WvWGGFetchWorldsLambda-{stage}`
- `/aws/lambda/WvWGGGetWvWGuildsLambda`
- `/aws/lambda/WvWGGGetGuildBatchLambda`

**CloudWatch Metrics:**
- Lambda invocations
- Lambda errors
- Lambda duration
- DynamoDB read/write capacity

**Alarms** (Optional - add to CDK stack):
- Lambda error rate > 5%
- DynamoDB throttling
- Lambda timeout

## Troubleshooting

### Issue: Vercel can't connect to DynamoDB

**Check:**
1. IAM user has correct permissions (check policy)
2. Access keys are configured correctly in Vercel
3. Table name matches exactly (check CDK output)
4. Region is set to `us-east-1`

**Debug:**
```bash
# Test access with AWS CLI using Vercel credentials
export AWS_ACCESS_KEY_ID=<vercel-key>
export AWS_SECRET_ACCESS_KEY=<vercel-secret>
aws dynamodb get-item --table-name <table-name> \
  --key '{"type":{"S":"matches"},"id":{"S":"all"}}'
```

### Issue: Data not updating

**Check EventBridge Rules:**
```bash
aws events list-rules
aws events list-targets-by-rule --rule WvWGGFetchMatchesRule-{stage}
```

**Check Lambda execution:**
```bash
aws logs tail /aws/lambda/WvWGGFetchMatchesLambda-{stage} --follow
```

## Development Workflow

1. **AWS Infrastructure changes** → Update CDK stack in this repo
2. **Frontend changes** → Update Next.js app in `adekau/wvwgg-vibecoded`
3. **Lambda function changes** → Update in `cdk/lambda/` and redeploy CDK
4. **Data schema changes** → Coordinate between Lambda formatters and Next.js queries

## Files

- `cdk/lib/wvwgg-stack-simplified.ts` - Main simplified stack
- `cdk/bin/cdk-simplified.ts` - CDK app entry point
- `cdk/lambda/get-matches.ts` - Matches fetcher Lambda
- `cdk/lambda/get-worlds.ts` - Worlds fetcher Lambda
- `cdk/lib/automation-stack.ts` - Guild sync automation
- `HYBRID_ARCHITECTURE.md` - This file

## Links

- **Vercel App:** https://github.com/adekau/wvwgg-vibecoded
- **CDK Stack:** https://github.com/adekau/wvwgg (this repo)
- **Production URL:** https://wvwgg.vercel.app (or custom domain)
- **Migration Plan:** See `CDK_TO_VERCEL_MIGRATION_PLAN.md` in Vercel repo
