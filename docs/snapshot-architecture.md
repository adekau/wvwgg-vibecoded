# WvW Match Snapshot Architecture

## Overview

The WvW Match Tracker maintains a historical record of match data by taking periodic snapshots of the current match state. This allows users to analyze performance trends over time, view prime time statistics, and track match progression.

## System Components

### 1. Snapshot Collection (Lambda)

**File**: `/cdk/lambda/get-matches.ts`

**Trigger**: EventBridge Rule runs every 60 seconds

**Process**:
1. Fetches current match data from ArenaNet API (`https://api.guildwars2.com/v2/wvw/matches?ids=all`)
2. Fetches world data (cached in DynamoDB, refreshed every 24 hours)
3. Formats and saves current match state to DynamoDB (`type: "matches", id: "all"`)
4. **Creates historical snapshot every 15 minutes** based on interval calculation

#### 15-Minute Interval Calculation

```typescript
const now = Date.now(); // Current timestamp in milliseconds
const current15Min = Math.floor(now / (1000 * 60 * 15)); // 15-minute interval ID
const snapshotId = `snapshot-${current15Min}`;
```

**Example**:
- Current time: `2025-11-17 22:30:00 UTC`
- Timestamp: `1763418600000` ms
- Interval: `1763418600000 / 900000 = 1959354`
- Snapshot ID: `snapshot-1959354`

Each interval represents a 15-minute window. The interval number increments every 15 minutes.

#### Deduplication Logic

Before creating a snapshot, the Lambda checks if one already exists for the current interval:

```typescript
const existingSnapshot = await dynamoDb.get({
  TableName: TABLE_NAME,
  Key: { type: "match-history", id: snapshotId }
});

if (!existingSnapshot.Item) {
  // Create new snapshot
  await dynamoDb.put({
    TableName: TABLE_NAME,
    Item: {
      type: "match-history",
      id: snapshotId,
      timestamp: now,
      interval: current15Min,
      data: formattedMatches,
      ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60) // 7 days
    }
  });
}
```

This ensures only one snapshot is created per 15-minute interval, even though the Lambda runs every 60 seconds.

### 2. Data Storage (DynamoDB)

**Table**: `wvwgg-{stage}` (e.g., `wvwgg-prod`)

**Schema**:
- **Partition Key**: `type` (String)
- **Sort Key**: `id` (String)

#### Snapshot Item Structure

```typescript
{
  type: "match-history",           // Partition key
  id: "snapshot-1959354",          // Sort key (snapshot ID)
  timestamp: 1763418600000,        // Actual timestamp in milliseconds
  interval: 1959354,               // 15-minute interval number
  data: {                          // Match data for all matches
    "1-1": { /* match data */ },
    "1-2": { /* match data */ },
    // ... all matches
  },
  ttl: 1764023400                  // Expiration timestamp (7 days later)
}
```

#### TTL (Time To Live)

Snapshots automatically expire after **7 days** to control storage costs:

```typescript
ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60)
```

The `ttl` field must be in **seconds** (not milliseconds), which is why we divide by 1000.

### 3. Data Retrieval (API)

**Endpoint**: `/api/history/[matchId]`

**Files**:
- Route Handler: `/app/api/history/[matchId]/route.ts`
- Query Function: `/server/queries.ts` (`getMatchHistory`)

#### Query Process

1. Calculate the time range to fetch (default: last 24 hours)
2. Calculate the starting interval:
   ```typescript
   const current15Min = Math.floor(Date.now() / (1000 * 60 * 15));
   const intervalsToFetch = hours * 4; // 4 intervals per hour
   const startInterval = current15Min - intervalsToFetch;
   ```

3. **Scan DynamoDB with pagination** to retrieve all snapshots:
   ```typescript
   let allSnapshots = [];
   let lastEvaluatedKey = undefined;

   do {
     const response = await docClient.send(
       new ScanCommand({
         TableName: process.env.TABLE_NAME,
         FilterExpression: '#type = :type AND #interval >= :startInterval',
         ExpressionAttributeNames: {
           '#type': 'type',
           '#interval': 'interval',
         },
         ExpressionAttributeValues: {
           ':type': 'match-history',
           ':startInterval': startInterval,
         },
         ExclusiveStartKey: lastEvaluatedKey,
       })
     );

     allSnapshots = allSnapshots.concat(response.Items || []);
     lastEvaluatedKey = response.LastEvaluatedKey;
   } while (lastEvaluatedKey);
   ```

4. Sort snapshots by timestamp (oldest first)
5. Extract data for the specific match ID
6. Return formatted history data

#### Why Pagination is Critical

DynamoDB Scan operations return a maximum of **1 MB** of data per request. Without pagination:
- Only the first ~40-50 snapshots would be returned
- Recent snapshots would be missing
- Prime time analysis would show incomplete data

The pagination loop continues until `LastEvaluatedKey` is `undefined`, ensuring all matching snapshots are retrieved.

### 4. Client-Side Consumption

**Component**: `/components/prime-time-performance.tsx`

**Process**:
1. Fetches historical data from `/api/history/${matchId}`
2. Groups snapshots by prime time window (NA Prime, EU Prime, OCX, SEA, Off Hours)
3. Calculates aggregate statistics (kills, deaths, K/D, VP, score) for each window
4. Displays performance breakdown by coverage period
5. **Auto-refreshes every 2 minutes** to show live updates during active windows

## Data Flow Diagram

```
┌─────────────────┐
│  EventBridge    │  Triggers every 60 seconds
│      Rule       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lambda Function│  get-matches.ts
│  (every 60s)    │
└────────┬────────┘
         │
         ├──► Fetch from ArenaNet API
         │
         ├──► Save current state to DynamoDB
         │
         └──► Create snapshot (every 15 min)
                │
                ▼
         ┌─────────────────┐
         │   DynamoDB      │
         │   wvwgg-prod    │
         │                 │
         │ type: "match-   │
         │ history"        │
         │ id: "snapshot-  │
         │ {interval}"     │
         │                 │
         │ TTL: 7 days     │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  API Route      │  /api/history/[matchId]
         │                 │
         │ • Scan with     │
         │   pagination    │
         │ • Filter by     │
         │   interval      │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Frontend       │
         │  Component      │
         │                 │
         │ • Group by      │
         │   time window   │
         │ • Calculate     │
         │   stats         │
         │ • Display       │
         │   metrics       │
         └─────────────────┘
```

## Time Windows & Classification

**File**: `/lib/prime-time-windows.ts`

Snapshots are classified into time windows based on their UTC hour:

| Window | UTC Hours | Example Local Time (EST) |
|--------|-----------|-------------------------|
| NA Prime | 0-5 | 7 PM - 12 AM EST |
| EU Prime | 18-23 | 1 PM - 6 PM EST |
| OCX | 8-13 | 3 AM - 8 AM EST |
| SEA | 11-16 | 6 AM - 11 AM EST |
| Off Hours | All other hours | 8 AM - 1 PM, 6 PM - 7 PM, 12 AM - 3 AM EST |

**Note**: OCX and SEA overlap (11-13 UTC). Timestamps in the overlap are classified as OCX (first match in the array).

### Off Hours Calculation

Off hours are **exclusive** of all prime time windows. The system:
1. Creates a set of all hours covered by prime time windows
2. Identifies continuous ranges of uncovered hours
3. Displays them with line breaks for readability

Example off hours periods (in UTC):
- 5-8 UTC (3 hours)
- 16-18 UTC (2 hours)
- 23-24 UTC (1 hour)

## Performance Considerations

### Lambda Optimization

- **Execution Time**: ~2-7 seconds per invocation
- **Memory**: 128 MB (sufficient for current workload)
- **Timeout**: 15 seconds
- **Cold Start**: ~350ms initialization time
- **Cost**: Minimal (~$0.20/month for 2.6M invocations)

### DynamoDB Optimization

- **On-Demand Billing**: Scales automatically with usage
- **Scan Performance**: ~50-200ms per scan operation
- **Pagination Overhead**: +100-150ms per additional page
- **Storage**: ~10 MB per day of snapshots (7 days × 10 MB = 70 MB max)

### API Caching

```typescript
export const revalidate = 300; // Cache for 5 minutes
```

The Next.js API route caches responses for 5 minutes to reduce DynamoDB queries.

## Common Issues & Troubleshooting

### Issue 1: No Recent Snapshots Appearing

**Symptoms**: Frontend shows old data, missing recent snapshots

**Diagnosis**:
1. Check Lambda logs: `aws logs tail /aws/lambda/WvWGGFetchMatchesLambda-prod --follow`
2. Look for `[SNAPSHOT]` log entries
3. Verify snapshots are being created in DynamoDB

**Common Causes**:
- ✅ **SOLVED**: Pagination not implemented (only first page returned)
- EventBridge rule disabled
- Lambda execution errors
- DynamoDB write throttling

**Solution**: Implemented pagination loop in `getMatchHistory` (see above)

### Issue 2: Interval Calculation Mismatch

**Symptoms**: Snapshot IDs don't match expected times

**Diagnosis**:
```typescript
// Calculate what interval a specific UTC time should be
const dt = new Date(Date.UTC(2025, 10, 17, 18, 0, 0)); // Nov 17, 2025 18:00 UTC
const ts = dt.getTime();
const interval = Math.floor(ts / (1000 * 60 * 15));
console.log(`18:00 UTC = interval ${interval}`);
```

**Common Causes**:
- Using naive datetime (local timezone instead of UTC)
- Timezone conversion errors
- Off-by-one errors in interval math

**Solution**: Always use UTC for calculations, verify with `new Date(timestamp).toISOString()`

### Issue 3: Prime Time Windows Show Zero Data

**Symptoms**: Specific time windows show no data despite snapshots existing

**Diagnosis**:
1. Check that snapshots exist in DynamoDB for that time range
2. Verify `getPrimeTimeWindow()` classifies timestamps correctly
3. Check browser console for grouping logs

**Common Causes**:
- Timestamp format issues (string vs number)
- UTC hour calculation errors
- Window overlap conflicts

**Solution**: Added proper timestamp handling for all types (string | Date | number)

### Issue 4: TTL Not Expiring Old Snapshots

**Symptoms**: Snapshots older than 7 days still in DynamoDB

**Diagnosis**:
- Check if TTL is enabled on the table
- Verify TTL field is in seconds (not milliseconds)
- TTL deletion can take up to 48 hours

**Solution**: Ensure `ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60)`

## Monitoring & Observability

### CloudWatch Metrics

**Lambda Metrics**:
- `Invocations`: Should be ~60 per hour (one per minute)
- `Errors`: Should be 0
- `Duration`: Should be 2-7 seconds
- `ConcurrentExecutions`: Should be 1

**DynamoDB Metrics**:
- `ConsumedReadCapacityUnits`: Monitor for throttling
- `ConsumedWriteCapacityUnits`: Should show writes every 15 minutes
- `SystemErrors`: Should be 0

### Log Analysis

**Useful Log Queries**:

```bash
# Check snapshot creation
aws logs filter-pattern /aws/lambda/WvWGGFetchMatchesLambda-prod "[SNAPSHOT]" --since 1h

# Check for errors
aws logs filter-pattern /aws/lambda/WvWGGFetchMatchesLambda-prod "ERROR" --since 24h

# View history API fetches
aws logs filter-pattern /aws/lambda/WvWGGFetchMatchesLambda-prod "[HISTORY]" --since 1h
```

### Debug Logging

Current debug logs in production:

**Lambda** (`get-matches.ts`):
```typescript
console.log(`[SNAPSHOT] Current interval: ${current15Min}, ID: ${snapshotId}`);
console.log(`[SNAPSHOT] Existing snapshot check:`, existingSnapshot.Item ? 'FOUND' : 'NOT FOUND');
console.log(`[SNAPSHOT] Creating new snapshot ${snapshotId}...`);
console.log(`[SNAPSHOT] Successfully created snapshot ${snapshotId}`);
console.log(`[SNAPSHOT] Skipping - snapshot ${snapshotId} already exists`);
```

**API** (`queries.ts`):
```typescript
console.log(`[HISTORY] Fetched ${allSnapshots.length} snapshots for last ${hours} hours (intervals >= ${startInterval})`);
```

**Frontend** (`prime-time-performance.tsx`):
```typescript
console.log('Prime Time Performance - Total history points:', data.length);
console.log('Prime Time Stats - Grouped data counts:', /* ... */);
```

## Future Improvements

### Potential Optimizations

1. **Global Secondary Index (GSI)**: Add GSI on `interval` field for faster queries
2. **Query Instead of Scan**: Use Query operation with GSI for better performance
3. **Batch Writes**: Accumulate snapshot data and write in batches
4. **Compression**: Compress snapshot data to reduce storage costs
5. **Incremental Snapshots**: Only store deltas instead of full match state

### Feature Enhancements

1. **Configurable Snapshot Frequency**: Allow admins to adjust from 15 minutes to other intervals
2. **Snapshot Validation**: Detect and flag stale or corrupted snapshots
3. **Backup & Restore**: Export/import snapshot data for long-term archival
4. **Real-time Notifications**: Alert when significant events occur (match flips, large score swings)

## Version History

- **2025-11-17**: Fixed pagination bug in `getMatchHistory` - now retrieves all snapshots
- **2025-11-17**: Added debug logging to Lambda and API for troubleshooting
- **2025-11-17**: Implemented off-hours exclusivity and active window highlighting
- **Initial**: Basic snapshot system with 15-minute intervals and 7-day TTL

## References

- [DynamoDB Scan API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html)
- [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [EventBridge Scheduled Rules](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
