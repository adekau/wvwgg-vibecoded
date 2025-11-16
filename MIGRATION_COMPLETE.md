# WvW.gg Migration Complete ✓

## Summary

Successfully migrated WvW.gg from full AWS CDK deployment to a **hybrid Vercel + AWS architecture**.

## Architecture

### AWS (Data Layer)
- **DynamoDB**: Stores match and world data
  - Production table: `WvWGG-Prod-WvWGGTableprod11E5AA77-5V5DG8BCDEQ4`
  - Dev table: `WvWGG-Dev-WvWGGTabledev77F8C70B-I81QVBU2SHQF`
- **Lambda Functions**: Fetch data from GW2 API
  - `get-matches`: Runs every 60 seconds
  - `get-worlds`: Runs every 24 hours
- **EventBridge**: Triggers Lambda functions on schedule
- **IAM**: `vercel-deployment-user` with read-only DynamoDB access

### Vercel (Frontend Layer)
- **Next.js 16**: Server-side rendering with Turbopack
- **Deployment**: https://wvwgg.vercel.app
- **Region**: iad1 (US East)
- **Environment Variables**: Configured for production DynamoDB access

## Data Flow

```
GW2 API → AWS Lambda (60s) → DynamoDB → Vercel (SSR) → Users
```

1. AWS Lambda fetches match data from GW2 API every 60 seconds
2. Data is formatted and stored in DynamoDB
3. Vercel Next.js pages query DynamoDB directly using AWS SDK
4. Pages use `unstable_cache` with 60s revalidation for performance

## Completed Work

### Phase 1: Infrastructure ✓
- Created IAM user with least-privilege DynamoDB access
- Configured Vercel environment variables
- Identified correct production table name

### Phase 2: Data Layer ✓
- Created DynamoDB query functions in `server/queries.ts`
- Configured AWS SDK with proper credentials
- Added fallback to GW2 API if DynamoDB data unavailable

### Phase 3: Page Migration ✓
- **Matches List** (`/matches`): Displays all 9 WvW matches with real data
- **Match Detail** (`/matches/[matchId]`): Shows detailed stats for each match
- Adapted to actual DynamoDB data structure (red/blue/green objects)
- Dynamic rendering with forced cache revalidation

### Phase 4: Cleanup ✓
- Removed debug endpoints
- Removed unused cron API routes
- Cleaned up console.log statements
- Deleted test files

## Key Fixes

### Issue: Environment Variables with Trailing Newlines
**Problem**: All Vercel env vars had literal `\n` characters causing:
- Invalid AWS region: `"us-east-1\n"`
- Invalid table names
- Invalid credentials

**Solution**: Recreated all env vars using `echo -n` to prevent newlines

### Issue: Wrong Production Table
**Problem**: Using old retained table `WvWGG-Prod-WvWGGTableprod11E5AA77-14Q0B0NYHUE9F`

**Solution**: Updated to correct table `WvWGG-Prod-WvWGGTableprod11E5AA77-5V5DG8BCDEQ4`

### Issue: Data Structure Mismatch
**Problem**: Pages expected `all_worlds[]` array, but data had `red/blue/green` objects

**Solution**: Updated page transformation logic to work with actual structure

### Issue: Stubborn Cache
**Problem**: `unstable_cache` served stale empty data even after fixing env vars

**Solution**:
- Changed cache keys (`matches-v2`, `worlds-v2`)
- Added `force-dynamic` to pages
- Data now updates correctly

## Environment Variables (Production)

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA3ISBV3TLUKSV2AMD
AWS_SECRET_ACCESS_KEY=(configured in Vercel)
TABLE_NAME=WvWGG-Prod-WvWGGTableprod11E5AA77-5V5DG8BCDEQ4
WVWGG_STAGE=prod
```

## CDK Infrastructure

Located in `/home/alex/wvwgg/cdk/`:
- Simplified stack removing CloudFront, S3, and Next.js Lambda
- Keeps DynamoDB, Lambda functions, EventBridge, and IAM
- Ready for deployment if needed to recreate infrastructure

## Remaining Tasks

### Future Enhancements
1. **Guilds Page**: Migrate from mock data to real DynamoDB guild data
2. **Cache Keys**: Revert from `-v2` to normal keys (or keep for versioning)
3. **Error Messaging**: Update "Data updated daily at 12:00 UTC" to "Data updated every 60 seconds"
4. **Match Dates**: Add start_time/end_time to Lambda data output
5. **Objectives**: Fetch and display map objectives if desired
6. **Deploy CDK**: Deploy simplified CDK stack to production if infrastructure needs updating

### Nice to Have
- Add loading states
- Add error boundaries
- Implement real-time WebSocket updates
- Add guild claim tracking
- Add historical match data

## Cost Comparison

### Before (Full AWS)
- CloudFront CDN
- S3 storage
- Lambda@Edge for SSR
- DynamoDB
- EventBridge
- Lambda functions
**Estimated**: $20-50/month

### After (Hybrid)
- Vercel Hobby (free) or Pro ($20/month)
- DynamoDB on-demand (~$1-5/month)
- Lambda invocations (~$0.20/month)
- EventBridge ($0)
**Estimated**: $1-25/month

## Deployment

```bash
# Deploy frontend
vercel --prod

# Deploy infrastructure (if needed)
cd cdk
npm install
export WVWGG_STAGE=prod
cdk deploy --all --app "npx ts-node bin/cdk-simplified.ts"
```

## Links

- **Production**: https://wvwgg.vercel.app
- **Matches**: https://wvwgg.vercel.app/matches
- **Vercel Dashboard**: https://vercel.com/adekaus-projects/wvwgg
- **GitHub**: adekau/wvwgg-vibecoded

## Notes

- Data updates every **60 seconds** via AWS Lambda (not daily)
- Match IDs: `1-X` = NA tier X, `2-X` = EU tier X
- Data structure uses embedded world objects, not separate lookups
- Pages use forced dynamic rendering for real-time data
