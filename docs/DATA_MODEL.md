# Data Model & DynamoDB Schema

This document describes the data model and database schema used in the WvW.gg application.

## Table of Contents

- [Overview](#overview)
- [DynamoDB Tables](#dynamodb-tables)
- [Data Entities](#data-entities)
- [Data Flow](#data-flow)
- [Caching Strategy](#caching-strategy)
- [Data Retention](#data-retention)

---

## Overview

WvW.gg uses **DynamoDB** as its primary database, optimized for:
- **High-frequency writes**: Match snapshots every 15 minutes
- **Low-latency reads**: Cached queries with Next.js ISR
- **Scalability**: Serverless auto-scaling for traffic spikes
- **Cost efficiency**: On-demand pricing for variable workloads

### Design Principles

1. **Single Table Design**: Uses a single DynamoDB table with different entity types
2. **Composite Keys**: `type` (partition key) + `id` (sort key) for flexible queries
3. **Compression**: Historical data compressed with gzip to reduce storage costs
4. **TTL**: Time-to-live for automatic cleanup of old snapshots
5. **Fallback**: GW2 API as fallback when DynamoDB is unavailable

---

## DynamoDB Tables

### Primary Table: `wvwgg-data`

**Table Configuration**:
- **Partition Key**: `type` (String) - Entity type (e.g., "matches", "worlds", "guild")
- **Sort Key**: `id` (String) - Entity identifier
- **Billing Mode**: On-demand (auto-scaling)
- **Encryption**: AWS-managed encryption at rest
- **Point-in-time Recovery**: Enabled for production

**Table Structure**:
```
┌─────────────┬──────────────┬────────────────────────────────────────────┐
│ type (PK)   │ id (SK)      │ data                                       │
├─────────────┼──────────────┼────────────────────────────────────────────┤
│ matches     │ all          │ { matchId: MatchData, ... }                │
│ worlds      │ all          │ [ { id, name, population }, ... ]          │
│ guild       │ <guild-uuid> │ { name, tag, worldId, classification, ... }│
│ snapshot    │ <timestamp>  │ { compressed match data }                  │
└─────────────┴──────────────┴────────────────────────────────────────────┘
```

---

## Data Entities

### 1. Matches (`type: "matches"`)

Stores current active WvW matches across all tiers and regions.

**Access Pattern**: `GetItem` with `type="matches"` and `id="all"`

**Schema**:
```typescript
{
  type: "matches",
  id: "all",
  data: {
    [matchId: string]: {
      id: string;              // e.g., "1-1" (tier-region)
      region: "NA" | "EU";
      tier: number;            // 1-5
      start_time: string;      // ISO 8601 timestamp
      end_time: string;        // ISO 8601 timestamp
      all_worlds: Array<{
        id: number;            // World ID
        color: "red" | "blue" | "green";
        kills: number;
        deaths: number;
        victory_points: number;
      }>;
      scores: {
        red: number;           // Total accumulated score
        blue: number;
        green: number;
      };
      skirmish: {
        id: number;            // Current skirmish number (1-84)
        scores: {
          red: number;         // Current skirmish score
          blue: number;
          green: number;
        };
        map_scores: Array<{
          type: string;        // "RedHome", "BlueHome", "GreenHome", "Center"
          scores: {
            red: number;
            blue: number;
            green: number;
          };
        }>;
      };
    };
  };
  updatedAt: number;           // Unix timestamp (milliseconds)
}
```

**Update Frequency**: Every 60 seconds (Lambda cron)

**Cache Duration**: 60 seconds (Next.js ISR)

**Source**: `cdk/lambda/get-matches.ts`

---

### 2. Worlds (`type: "worlds"`)

Stores all GW2 world (server) names and IDs.

**Access Pattern**: `GetItem` with `type="worlds"` and `id="all"`

**Schema**:
```typescript
{
  type: "worlds",
  id: "all",
  data: Array<{
    id: number;                // World ID (e.g., 1001)
    name: string;              // World name (e.g., "Anvil Rock")
    population: string;        // "Low", "Medium", "High", "VeryHigh", "Full"
  }>;
  updatedAt: number;           // Unix timestamp (milliseconds)
}
```

**Update Frequency**: Every 24 hours (Lambda cron)

**Cache Duration**: 24 hours (Next.js ISR)

**Source**: `cdk/lambda/get-worlds.ts`

---

### 3. Guilds (`type: "guild"`)

Stores guild associations with worlds, including alliance relationships.

**Access Pattern**: `Query` with `type="guild"` (fetches all guilds)

**Schema**:
```typescript
{
  type: "guild",
  id: string;                  // Guild UUID from GW2 API
  data: {
    name: string;              // Guild name
    tag: string;               // Guild tag (e.g., "[TAG]")
    worldId: number;           // Associated world ID
    level?: number;            // Guild level (1-80)
    favor?: number;            // Favor points
    member_count?: number;     // Number of members
    emblem?: {                 // Guild emblem data
      background: {
        id: number;
        colors: number[];
      };
      foreground: {
        id: number;
        colors: number[];
      };
      flags: string[];
    };
  };
  classification?: "alliance" | "member" | "independent";
  allianceGuildId?: string;    // Parent alliance guild ID (if member guild)
  memberGuildIds?: string[];   // Child member guild IDs (if alliance guild)
  description?: string;         // Guild description
  contact_info?: string;        // Discord, website, etc.
  recruitment_status?: "open" | "closed" | "by_application";
  notes?: string;               // Admin notes
  updatedAt: number;            // Unix timestamp (milliseconds)
  auditLog?: Array<{            // Change history
    timestamp: number;
    action: string;
    user: string;
    changes: Record<string, any>;
  }>;
}
```

**Update Frequency**: Manual (via admin dashboard) or periodic sync

**Cache Duration**: 60 seconds (Next.js ISR)

**Source**: `app/api/admin/guilds/route.ts`

**Guild Classification**:
- **alliance**: Parent guild in an alliance (has `memberGuildIds`)
- **member**: Child guild in an alliance (has `allianceGuildId`)
- **independent**: Not part of an alliance

---

### 4. Snapshots (`type: "snapshot"`)

Stores historical match data at 15-minute intervals for trend analysis.

**Access Pattern**: `Query` with `type="snapshot"` and timestamp range

**Schema**:
```typescript
{
  type: "snapshot",
  id: string;                  // Unix timestamp (milliseconds) as string
  timestamp: number;           // Unix timestamp (milliseconds)
  data: string | {             // Compressed (base64 gzip) or decompressed
    [matchId: string]: {
      red: {
        totalScore: number;
        kills: number;
        deaths: number;
        victoryPoints: number;
      };
      blue: {
        totalScore: number;
        kills: number;
        deaths: number;
        victoryPoints: number;
      };
      green: {
        totalScore: number;
        kills: number;
        deaths: number;
        victoryPoints: number;
      };
      maps: Array<{
        type: string;
        scores: { red: number; blue: number; green: number };
        objectives: Array<{
          id: string;
          type: string;        // "Castle", "Keep", "Tower", "Camp"
          owner: string;       // "Red", "Blue", "Green", "Neutral"
        }>;
      }>;
    };
  };
  ttl?: number;                // Unix timestamp for automatic deletion (7 days)
}
```

**Compression**:
- **Storage**: Data compressed with gzip and base64 encoded
- **Runtime**: Decompressed on read using `gunzipSync`
- **Savings**: ~70% storage reduction

**Update Frequency**: Every 15 minutes (Lambda cron)

**Retention**: 7 days (TTL auto-cleanup)

**Source**: `cdk/lambda/get-matches.ts` (creates snapshots)

**Query Example** (TypeScript):
```typescript
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const response = await docClient.send(
  new QueryCommand({
    TableName: 'wvwgg-data',
    KeyConditionExpression: '#type = :type AND #id BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#type': 'type',
      '#id': 'id',
    },
    ExpressionAttributeValues: {
      ':type': 'snapshot',
      ':start': startTimestamp.toString(),
      ':end': endTimestamp.toString(),
    },
  })
);
```

---

## Data Flow

### Match Data Pipeline

```
┌─────────────────┐
│  GW2 API v2     │
│  /wvw/matches   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Lambda: get-matches.ts         │
│  Trigger: Every 60 seconds      │
│  - Fetch match data             │
│  - Create 15-min snapshots      │
│  - Compress snapshot data       │
│  - Update current matches       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  DynamoDB: wvwgg-data           │
│  - matches (type="matches")     │
│  - snapshots (type="snapshot")  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Next.js API Routes             │
│  - /api/worlds                  │
│  - /api/objectives/[matchId]    │
│  - /api/history/[matchId]       │
│  Cache: 60s-2min ISR            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  React Components               │
│  - React Query (30s stale)      │
│  - Auto-refresh (60s interval)  │
└─────────────────────────────────┘
```

### Guild Data Pipeline

```
┌─────────────────┐
│  Admin Dashboard│
│  /admin/guilds  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  API Route: /api/admin/guilds   │
│  - POST: Create guild           │
│  - PUT: Update guild            │
│  - DELETE: Delete guild         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  DynamoDB: wvwgg-data           │
│  - guilds (type="guild")        │
│  - Indexed by guild ID          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  React Components               │
│  - Guild associations           │
│  - Alliance relationships       │
└─────────────────────────────────┘
```

---

## Caching Strategy

WvW.gg uses a **multi-layer caching strategy** to minimize API calls and database queries:

### Layer 1: Next.js ISR (Incremental Static Regeneration)

**Purpose**: Server-side cache for API routes

**Configuration**:
```typescript
export const revalidate = 60; // Revalidate every 60 seconds
```

**Benefits**:
- Reduces DynamoDB read costs
- Improves response times (serve cached data)
- Automatic background revalidation

**Usage**:
- Match data: 60 seconds
- Historical data: 2 minutes
- Objectives: 30 seconds
- GW2 API proxies: 1 hour

### Layer 2: React Query (TanStack Query)

**Purpose**: Client-side cache for API responses

**Configuration**:
```typescript
const { data } = useQuery({
  queryKey: ['matches'],
  queryFn: fetchMatches,
  staleTime: 30000,        // 30 seconds
  refetchInterval: 60000,  // Auto-refresh every 60 seconds
});
```

**Benefits**:
- Reduces API calls from client
- Background refetching for live updates
- Optimistic updates for mutations

### Layer 3: DynamoDB Cache

**Purpose**: Cache GW2 API responses in DynamoDB

**Items**:
- Worlds: 24-hour cache
- Matches: 60-second cache
- Guild data: Persistent (manual updates)

**Benefits**:
- Reduces load on GW2 API
- Survives Lambda cold starts
- Shared cache across all users

### Cache Invalidation

**Manual Revalidation**:
```typescript
POST /api/revalidate
{
  "path": "/matches"
}
```

**Automatic Revalidation**:
- ISR: Time-based (configurable per route)
- React Query: Stale-while-revalidate
- DynamoDB TTL: Automatic cleanup

---

## Data Retention

### Retention Policies

| Data Type | Retention Period | Cleanup Method |
|-----------|------------------|----------------|
| Current Matches | 7 days (match duration) | Overwritten when match ends |
| Snapshots | 7 days | DynamoDB TTL |
| Guild Data | Indefinite | Manual deletion only |
| World Data | Indefinite | Overwritten daily |

### Snapshot Retention Details

**Why 7 days?**
- Covers one full match cycle (Friday 18:00 to Friday 18:00)
- Sufficient for historical analysis and predictions
- Balances storage costs with data utility

**Storage Calculation**:
```
Snapshots per day: 96 (4 per hour × 24 hours)
Matches tracked: ~30 (5 tiers × 2 regions × 3 teams)
Compressed size per snapshot: ~50KB
Total storage per day: 96 × 50KB = 4.8MB
Total storage (7 days): ~33.6MB
Cost: ~$0.01/month at $0.25/GB-month
```

**TTL Configuration** (`cdk/lib/database-stack.ts`):
```typescript
const table = new Table(this, 'WvWDataTable', {
  partitionKey: { name: 'type', type: AttributeType.STRING },
  sortKey: { name: 'id', type: AttributeType.STRING },
  billingMode: BillingMode.ON_DEMAND,
  timeToLiveAttribute: 'ttl', // Automatic cleanup
});
```

**Setting TTL** (Lambda):
```typescript
const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
await docClient.send(
  new PutCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      type: 'snapshot',
      id: timestamp.toString(),
      data: compressedData,
      ttl, // Automatically deleted after 7 days
    },
  })
);
```

---

## Query Optimization

### Best Practices

1. **Use GetItem for single-item lookups**
   ```typescript
   // Good: Direct key lookup
   const matches = await getMatches(); // GetItem with type="matches", id="all"

   // Bad: Query for single item
   const matches = await queryMatches(); // Query with KeyConditionExpression
   ```

2. **Use Query for range queries**
   ```typescript
   // Good: Query snapshots in time range
   const snapshots = await querySnapshots(startTime, endTime);

   // Bad: Scan entire table
   const snapshots = await scanSnapshots();
   ```

3. **Compress large data**
   ```typescript
   // Good: Compress before storing
   const compressed = gzipSync(JSON.stringify(data)).toString('base64');

   // Bad: Store uncompressed JSON (costly and slow)
   const raw = JSON.stringify(data);
   ```

4. **Use unstable_cache for expensive queries**
   ```typescript
   export const getMatches = unstable_cache(
     async () => { /* query logic */ },
     ['matches-v2'],
     { revalidate: 60, tags: ['matches'] }
   );
   ```

5. **Batch reads when possible**
   ```typescript
   // Good: BatchGetItem
   const guilds = await batchGetGuilds(guildIds);

   // Bad: Multiple GetItem calls
   const guilds = await Promise.all(guildIds.map(id => getGuild(id)));
   ```

---

## Monitoring & Alerting

### CloudWatch Metrics

**Key Metrics**:
- **Read Capacity**: Should stay < 50% of provisioned (on-demand auto-scales)
- **Write Capacity**: Spikes every 15 minutes (snapshot writes)
- **Throttled Requests**: Should be 0 (indicates capacity issues)
- **GetItem Latency**: Should be < 10ms (p50)
- **Query Latency**: Should be < 50ms (p50)

**Alarms** (to be configured):
- Throttled requests > 10 in 5 minutes
- GetItem latency > 100ms (p99)
- Write failures > 5 in 1 minute

### Cost Monitoring

**DynamoDB Costs**:
- **Storage**: ~$0.25/GB-month (compressed snapshots: ~100MB = $0.025/month)
- **Reads**: $0.25 per million read request units (on-demand)
- **Writes**: $1.25 per million write request units (on-demand)

**Expected Monthly Costs**:
- Storage: $0.03
- Reads: $2.00 (8M requests/month at 60s cache)
- Writes: $0.20 (150K requests/month at 15min snapshots)
- **Total**: ~$2.25/month

---

## Migration & Backup

### Backup Strategy

**Point-in-time Recovery** (PITR):
- Enabled on production table
- Restore to any point in last 35 days
- Cost: ~$0.20/GB-month

**On-demand Backups**:
- Triggered before schema changes
- Stored in S3 for long-term retention

### Schema Migrations

**Adding New Attributes**:
- DynamoDB is schema-less, no migration needed
- Add validation in application code

**Changing Keys**:
- Create new table
- Migrate data with Step Functions
- Update Lambda environment variables
- Delete old table after verification

---

## TypeScript Interfaces

### Complete Type Definitions

See `server/queries.ts` for canonical type definitions:

```typescript
export interface IWorld {
  id: number;
  name: string;
  population: string;
}

export interface IWorldTeam {
  id: number;
  color: 'red' | 'blue' | 'green';
  kills: number;
  deaths: number;
  victory_points: number;
}

export interface IFormattedMatch {
  id: string;
  region: 'NA' | 'EU';
  tier: number;
  start_time: string;
  end_time: string;
  all_worlds: IWorldTeam[];
  scores: {
    red: number;
    blue: number;
    green: number;
  };
  skirmish: {
    id: number;
    scores: {
      red: number;
      blue: number;
      green: number;
    };
    map_scores: Array<{
      type: string;
      scores: {
        red: number;
        blue: number;
        green: number;
      };
    }>;
  };
}

export interface IGuild {
  id: string;
  name: string;
  tag: string;
  worldId: number;
  level?: number;
  favor?: number;
  member_count?: number;
  emblem?: any;
  classification?: 'alliance' | 'member' | 'independent';
  allianceGuildId?: string;
  memberGuildIds?: string[];
  description?: string;
  contact_info?: string;
  recruitment_status?: 'open' | 'closed' | 'by_application';
}
```

---

## Related Documentation

- [HYBRID_ARCHITECTURE.md](./HYBRID_ARCHITECTURE.md) - System architecture overview
- [snapshot-architecture.md](./snapshot-architecture.md) - Snapshot collection design
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoint documentation
- [BUILD_DATABASE_SCHEMA.md](./BUILD_DATABASE_SCHEMA.md) - Build system database schema (NEW)

---

For questions about the data model, please open a GitHub issue or contact the development team.
