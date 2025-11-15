# Alternative Migration Plan: Supabase + Vercel Serverless

## Overview

This document presents an **alternative architecture** to the hybrid AWS/Vercel approach, using **Supabase** (PostgreSQL) instead of DynamoDB and **Vercel Serverless Functions** instead of AWS Lambda/Step Functions.

**Benefits of This Approach:**
- ✅ **100% AWS-free** - No AWS credentials needed
- ✅ **Simpler architecture** - All services in Vercel ecosystem
- ✅ **Better querying** - PostgreSQL vs DynamoDB single-table design
- ✅ **Lower cost** - Supabase free tier + Vercel hosting
- ✅ **Better DX** - Native Vercel integration
- ✅ **Real-time capabilities** - Supabase subscriptions (if needed)
- ✅ **Easier local development** - Supabase CLI + local Postgres

**Trade-offs:**
- ⚠️ **Data migration required** - DynamoDB → Supabase
- ⚠️ **Guild sync complexity** - Need to replace Step Functions
- ⚠️ **Learning curve** - If team unfamiliar with Supabase

---

## Table of Contents

1. [Architecture Comparison](#1-architecture-comparison)
2. [Supabase Database Design](#2-supabase-database-design)
3. [Vercel Serverless Functions](#3-vercel-serverless-functions)
4. [Guild Sync Solution](#4-guild-sync-solution)
5. [Migration Steps](#5-migration-steps)
6. [Code Examples](#6-code-examples)
7. [Cost Analysis](#7-cost-analysis)
8. [Implementation Timeline](#8-implementation-timeline)

---

## 1. Architecture Comparison

### Current AWS Architecture
```
EventBridge → Lambda → DynamoDB
                  ↓
Step Functions → Lambda (batch) → DynamoDB
                  ↓
CloudFront → Next.js Lambda → DynamoDB
```

### Hybrid Approach (Original Plan)
```
Vercel Cron → Vercel Functions → DynamoDB (AWS)
                                       ↑
                                 AWS credentials
                                       ↓
                              Step Functions (AWS)
                                       ↓
                              Lambda (AWS) → DynamoDB
```

### Supabase + Vercel Approach (This Plan)
```
Vercel Cron → Vercel Functions → Supabase PostgreSQL
                  ↓
Vercel Queue (QStash) → Vercel Functions → Supabase PostgreSQL
                  ↓
Next.js (Vercel) → Supabase PostgreSQL
```

**Key Differences:**
- No AWS services at all
- PostgreSQL instead of DynamoDB
- Queue-based processing instead of Step Functions
- Native Vercel/Supabase integration

---

## 2. Supabase Database Design

### 2.1 Schema Design

**Current DynamoDB Structure:**
```
Single Table: {stage}-WvWGGTable
PK: type | SK: id | Data
------------------------
matches | all | { ...matchData }
worlds  | all | { ...worldsArray }
guild   | {id} | { ...guildData }
```

**Proposed Supabase Schema:**

```sql
-- Matches table
CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    tier INTEGER NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_worlds JSONB NOT NULL,
    scores JSONB NOT NULL,
    deaths JSONB NOT NULL,
    kills JSONB NOT NULL,
    victory_points JSONB NOT NULL,
    skirmishes JSONB NOT NULL,
    maps JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by region/tier
CREATE INDEX idx_matches_region_tier ON matches(region, tier);
CREATE INDEX idx_matches_updated_at ON matches(updated_at DESC);

-- Worlds table
CREATE TABLE worlds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    population TEXT,
    region TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_worlds_region ON worlds(region);

-- Guilds table
CREATE TABLE guilds (
    id TEXT PRIMARY KEY,
    name TEXT,
    tag TEXT,
    level INTEGER,
    emblem JSONB,
    region TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guilds_region ON guilds(region);
CREATE INDEX idx_guilds_updated_at ON guilds(updated_at DESC);

-- Guild sync status table (for tracking batch progress)
CREATE TABLE guild_sync_batches (
    id SERIAL PRIMARY KEY,
    region TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    guild_ids TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_batches_status ON guild_sync_batches(status, created_at);
```

### 2.2 Data Migration Script

**File:** `/scripts/migrate-dynamodb-to-supabase.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createClient } from '@supabase/supabase-js';

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1' })
);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function migrateMatches() {
  console.log('Migrating matches...');

  const { Item } = await dynamoClient.send(
    new ScanCommand({
      TableName: 'prod-WvWGGTable',
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: { ':type': 'matches' },
    })
  );

  if (!Item?.data) return;

  const matches = Object.entries(Item.data).map(([id, match]: [string, any]) => ({
    id,
    region: match.region,
    tier: match.tier,
    start_time: match.start_time,
    end_time: match.end_time,
    all_worlds: match.all_worlds,
    scores: match.scores,
    deaths: match.deaths,
    kills: match.kills,
    victory_points: match.victory_points,
    skirmishes: match.skirmishes,
    maps: match.maps,
  }));

  const { error } = await supabase.from('matches').upsert(matches);

  if (error) {
    console.error('Error migrating matches:', error);
  } else {
    console.log(`Migrated ${matches.length} matches`);
  }
}

async function migrateWorlds() {
  console.log('Migrating worlds...');

  const { Item } = await dynamoClient.send(
    new ScanCommand({
      TableName: 'prod-WvWGGTable',
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: { ':type': 'worlds' },
    })
  );

  if (!Item?.data) return;

  const worlds = Item.data.map((world: any) => ({
    id: world.id,
    name: world.name,
    population: world.population,
    region: world.id >= 2000 ? 'EU' : 'NA',
  }));

  const { error } = await supabase.from('worlds').upsert(worlds);

  if (error) {
    console.error('Error migrating worlds:', error);
  } else {
    console.log(`Migrated ${worlds.length} worlds`);
  }
}

async function migrateGuilds() {
  console.log('Migrating guilds...');

  let lastEvaluatedKey;
  let totalGuilds = 0;

  do {
    const { Items, LastEvaluatedKey } = await dynamoClient.send(
      new ScanCommand({
        TableName: 'prod-WvWGGTable',
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'guild' },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (Items && Items.length > 0) {
      const guilds = Items.map((item) => ({
        id: item.id,
        name: item.data.name,
        tag: item.data.tag,
        level: item.data.level,
        emblem: item.data.emblem,
        region: item.data.region,
      }));

      const { error } = await supabase.from('guilds').upsert(guilds);

      if (error) {
        console.error('Error migrating guild batch:', error);
      } else {
        totalGuilds += guilds.length;
        console.log(`Migrated ${totalGuilds} guilds so far...`);
      }
    }

    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Migration complete: ${totalGuilds} total guilds`);
}

async function main() {
  await migrateMatches();
  await migrateWorlds();
  await migrateGuilds();
}

main().catch(console.error);
```

---

## 3. Vercel Serverless Functions

### 3.1 Match Update Function

**File:** `/app/api/cron/matches/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { revalidateTag } from 'next/cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const runtime = 'edge'; // Use Edge Runtime for faster cold starts
export const maxDuration = 30;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch from GW2 API
    const response = await fetch(
      'https://api.guildwars2.com/v2/wvw/matches?ids=all'
    );
    const rawMatches = await response.json();

    // Format matches
    const matches = rawMatches.map((match: any) => ({
      id: match.id,
      region: match.id.includes('-') ? match.id.split('-')[0] : 'NA',
      tier: parseInt(match.id.split('-')[1] || '1'),
      start_time: match.start_time,
      end_time: match.end_time,
      all_worlds: match.all_worlds,
      scores: match.scores,
      deaths: match.deaths,
      kills: match.kills,
      victory_points: match.victory_points,
      skirmishes: match.skirmishes,
      maps: match.maps,
      updated_at: new Date().toISOString(),
    }));

    // Upsert to Supabase
    const { error } = await supabase
      .from('matches')
      .upsert(matches, { onConflict: 'id' });

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Revalidate Next.js cache
    revalidateTag('matches');

    return Response.json({
      success: true,
      count: matches.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error updating matches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### 3.2 Worlds Update Function

**File:** `/app/api/cron/worlds/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { revalidateTag } from 'next/cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const runtime = 'edge';
export const maxDuration = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(
      'https://api.guildwars2.com/v2/worlds?ids=all'
    );
    const rawWorlds = await response.json();

    const worlds = rawWorlds.map((world: any) => ({
      id: world.id,
      name: world.name,
      population: world.population,
      region: world.id >= 2000 ? 'EU' : 'NA',
    }));

    const { error } = await supabase
      .from('worlds')
      .upsert(worlds, { onConflict: 'id' });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    revalidateTag('worlds');

    return Response.json({
      success: true,
      count: worlds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 4. Guild Sync Solution

### Problem: Replacing Step Functions

The current AWS setup uses Step Functions with distributed map to:
1. Fetch all guild IDs by region (thousands of guilds)
2. Split into batches of 25 guilds
3. Process each batch with 5-second delays (rate limiting)
4. Store guild details in DynamoDB

**Vercel Constraints:**
- Max function duration: 10s (Hobby), 60s (Pro), 300s (Enterprise)
- No built-in workflow orchestration
- Need to implement batching manually

### Solution: Queue-Based Processing with QStash

**Architecture:**
```
Vercel Cron (daily) → /api/cron/init-guild-sync
                              ↓
                        Create batches in Supabase
                              ↓
                        Enqueue jobs to QStash
                              ↓
                        QStash → /api/jobs/process-guild-batch
                              ↓
                        Fetch guild details → Supabase
```

### 4.1 Initialize Guild Sync

**File:** `/app/api/cron/init-guild-sync/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { Client } from '@upstash/qstash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const regions = ['na', 'eu'];
    let totalBatches = 0;

    for (const region of regions) {
      // Fetch all guild IDs for region
      const response = await fetch(
        `https://api.guildwars2.com/v2/wvw/guilds/${region}`
      );
      const guildIds: string[] = await response.json();

      // Split into batches of 25
      const batchSize = 25;
      const batches = [];
      for (let i = 0; i < guildIds.length; i += batchSize) {
        batches.push(guildIds.slice(i, i + batchSize));
      }

      // Create batch records in Supabase
      const batchRecords = batches.map((batch, index) => ({
        region,
        batch_number: index + 1,
        total_batches: batches.length,
        guild_ids: batch,
        status: 'pending',
      }));

      const { data, error } = await supabase
        .from('guild_sync_batches')
        .insert(batchRecords)
        .select('id');

      if (error) {
        console.error('Error creating batches:', error);
        continue;
      }

      // Enqueue jobs to QStash with delays
      for (let i = 0; i < data.length; i++) {
        const batch = data[i];
        const delaySeconds = i * 5; // 5 seconds between batches

        await qstash.publishJSON({
          url: `${process.env.VERCEL_URL}/api/jobs/process-guild-batch`,
          body: { batchId: batch.id },
          delay: delaySeconds,
        });
      }

      totalBatches += batches.length;
    }

    return Response.json({
      success: true,
      totalBatches,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### 4.2 Process Guild Batch

**File:** `/app/api/jobs/process-guild-batch/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { verifySignatureEdge } from '@upstash/qstash/nextjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const runtime = 'edge';
export const maxDuration = 30;

async function handler(request: Request) {
  try {
    const { batchId } = await request.json();

    // Get batch details
    const { data: batch, error: fetchError } = await supabase
      .from('guild_sync_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (fetchError || !batch) {
      return Response.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Update status to processing
    await supabase
      .from('guild_sync_batches')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', batchId);

    // Fetch guild details from GW2 API
    const guildIds = batch.guild_ids.join(',');
    const response = await fetch(
      `https://api.guildwars2.com/v2/guild?ids=${guildIds}`
    );
    const guilds = await response.json();

    // Format and store guilds
    const formattedGuilds = guilds.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      tag: guild.tag,
      level: guild.level,
      emblem: guild.emblem,
      region: batch.region,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('guilds')
      .upsert(formattedGuilds, { onConflict: 'id' });

    if (upsertError) {
      // Update batch status to failed
      await supabase
        .from('guild_sync_batches')
        .update({
          status: 'failed',
          error: upsertError.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      return Response.json({ error: upsertError.message }, { status: 500 });
    }

    // Update batch status to completed
    await supabase
      .from('guild_sync_batches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    return Response.json({
      success: true,
      batchId,
      guildsProcessed: formattedGuilds.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Verify QStash signature for security
export const POST = verifySignatureEdge(handler);
```

### 4.3 Alternative: Simpler Approach Without Queue

If you don't want to use QStash, you can implement a simpler version:

**File:** `/app/api/cron/sync-guilds/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const maxDuration = 300; // Requires Pro or Enterprise plan

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const regions = ['na', 'eu'];
    let totalGuilds = 0;

    for (const region of regions) {
      // Fetch all guild IDs
      const idsResponse = await fetch(
        `https://api.guildwars2.com/v2/wvw/guilds/${region}`
      );
      const guildIds: string[] = await idsResponse.json();

      // Process in batches of 25
      const batchSize = 25;
      for (let i = 0; i < guildIds.length; i += batchSize) {
        const batch = guildIds.slice(i, i + batchSize);
        const ids = batch.join(',');

        // Fetch guild details
        const response = await fetch(
          `https://api.guildwars2.com/v2/guild?ids=${ids}`
        );
        const guilds = await response.json();

        // Store in Supabase
        const formattedGuilds = guilds.map((guild: any) => ({
          id: guild.id,
          name: guild.name,
          tag: guild.tag,
          level: guild.level,
          emblem: guild.emblem,
          region,
          updated_at: new Date().toISOString(),
        }));

        await supabase
          .from('guilds')
          .upsert(formattedGuilds, { onConflict: 'id' });

        totalGuilds += guilds.length;

        // Rate limiting: wait 5 seconds between batches
        if (i + batchSize < guildIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    return Response.json({
      success: true,
      totalGuilds,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

**Note:** This requires Vercel Pro or Enterprise for 300s function duration.

---

## 5. Migration Steps

### Phase 1: Supabase Setup (2-3 days)

**Step 1: Create Supabase Project**
```bash
# Sign up at https://supabase.com
# Create new project: "wvwgg-prod"
# Note: Project URL and anon/service keys
```

**Step 2: Set Up Database Schema**
```bash
# In Supabase SQL Editor, run the schema from Section 2.1
# Create tables: matches, worlds, guilds, guild_sync_batches
# Create indexes
```

**Step 3: Configure Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx... (keep secret!)
CRON_SECRET=xxx
QSTASH_TOKEN=xxx (if using QStash)
```

**Step 4: Install Dependencies**
```bash
npm install @supabase/supabase-js
npm install @upstash/qstash  # Optional, for queue-based guild sync
```

### Phase 2: Data Migration (3-5 days)

**Step 1: Run Migration Script**
```bash
# Set AWS and Supabase credentials
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export SUPABASE_URL=xxx
export SUPABASE_SERVICE_KEY=xxx

# Run migration
npx tsx scripts/migrate-dynamodb-to-supabase.ts
```

**Step 2: Verify Data**
```bash
# Check data in Supabase dashboard
# Verify row counts match DynamoDB
# Test sample queries
```

### Phase 3: Serverless Functions (3-5 days)

**Step 1: Create API Routes**
- `/app/api/cron/matches/route.ts`
- `/app/api/cron/worlds/route.ts`
- `/app/api/cron/init-guild-sync/route.ts` (if using QStash)
- `/app/api/jobs/process-guild-batch/route.ts` (if using QStash)

**Step 2: Update Server Queries**
```typescript
// /server/queries.ts
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const getMatches = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      return null;
    }

    return data;
  },
  ['matches'],
  { revalidate: 60, tags: ['matches'] }
);

export const getWorlds = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .order('name');

    if (error) return null;
    return data;
  },
  ['worlds'],
  { revalidate: 36000, tags: ['worlds'] }
);

export const getGuilds = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('guilds')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return null;
    return data;
  },
  ['guilds'],
  { revalidate: 86400, tags: ['guilds'] }
);
```

**Step 3: Configure Vercel Cron Jobs**

Update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/matches",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/worlds",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/init-guild-sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Phase 4: Testing (3-5 days)

**Local Testing:**
```bash
# Set up local Supabase (optional)
npx supabase init
npx supabase start

# Run local dev server
npm run dev

# Test API routes manually
curl http://localhost:3000/api/cron/matches \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Preview Testing:**
```bash
vercel --prod=false
# Test preview deployment
```

### Phase 5: Deployment (1-2 days)

```bash
# Deploy to production
vercel --prod

# Update DNS (same as original plan)
# Monitor logs and metrics
```

---

## 6. Code Examples

### 6.1 Supabase Client Setup

**File:** `/lib/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**File:** `/lib/supabase/server.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
```

### 6.2 Type Definitions

**File:** `/types/database.ts`

```typescript
export interface Match {
  id: string;
  region: string;
  tier: number;
  start_time: string;
  end_time: string;
  all_worlds: any; // JSONB
  scores: any;
  deaths: any;
  kills: any;
  victory_points: any;
  skirmishes: any;
  maps: any;
  updated_at: string;
  created_at: string;
}

export interface World {
  id: number;
  name: string;
  population: string | null;
  region: string;
  created_at: string;
}

export interface Guild {
  id: string;
  name: string | null;
  tag: string | null;
  level: number | null;
  emblem: any | null;
  region: string | null;
  updated_at: string;
  created_at: string;
}

export interface GuildSyncBatch {
  id: number;
  region: string;
  batch_number: number;
  total_batches: number;
  guild_ids: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
}
```

### 6.3 Updated Page Components

**File:** `/app/matches/page.tsx`

```typescript
import { MatchesHeader } from '@/components/matches-header';
import { RegionTabs } from '@/components/region-tabs';
import { MatchesGrid } from '@/components/matches-grid';
import { getMatches, getWorlds } from '@/server/queries';

export default async function MatchesPage() {
  const matches = await getMatches();
  const worlds = await getWorlds();

  if (!matches || !worlds) {
    return <div>Loading...</div>;
  }

  // Transform Supabase data for display
  const displayMatches = matches.map((match) => ({
    tier: `${match.region.toUpperCase()}-${match.tier}`,
    worlds: match.all_worlds.map((worldId: number) => {
      const world = worlds.find((w) => w.id === worldId);
      return {
        name: world?.name || 'Unknown',
        kills: match.kills[worldId] || 0,
        deaths: match.deaths[worldId] || 0,
        color: determineColor(worldId, match), // Helper function
      };
    }),
  }));

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="brushstroke-accent rounded-lg">
          <RegionTabs />
        </div>

        <MatchesGrid matches={displayMatches} />
      </main>
    </div>
  );
}

function determineColor(worldId: number, match: any) {
  // Logic to determine red/blue/green based on match data
  return 'red'; // Placeholder
}
```

---

## 7. Cost Analysis

### Current AWS Costs (Estimated)

| Service | Monthly Cost |
|---------|-------------|
| Lambda (Next.js) | $20-40 |
| Lambda (Data fetchers) | $5-10 |
| DynamoDB (on-demand) | $10-20 |
| CloudFront | $50-100 |
| S3 | $5-10 |
| Step Functions | $5-10 |
| Route53 | $1 |
| **Total AWS** | **$96-191/month** |

### Supabase + Vercel Costs

| Service | Free Tier | Paid Plan | Estimated Cost |
|---------|-----------|-----------|----------------|
| Vercel Hobby | ✅ (100GB bandwidth) | - | $0 |
| Vercel Pro | - | $20/month | $20 (if need >60s functions) |
| Supabase Free | ✅ (500MB DB, 2GB bandwidth) | - | $0 |
| Supabase Pro | - | $25/month | $0-25 (if exceed free tier) |
| QStash Free | ✅ (500 messages/day) | - | $0 |
| QStash Pro | - | $10/month | $0-10 (if heavy guild sync) |
| **Total** | **$0-20/month** | **$20-55/month** | **Likely $20-25/month** |

**Cost Savings:** ~$70-170/month (73-89% reduction)

### Free Tier Suitability

**Supabase Free Tier:**
- 500MB database (should be sufficient for matches/worlds/guilds)
- 2GB bandwidth/month (may need upgrade if high traffic)
- 50,000 monthly active users

**Vercel Hobby:**
- 100GB bandwidth
- 100 hours serverless function execution
- 6,000 cron job invocations/month

**Recommendation:** Start with free tiers, upgrade Vercel to Pro if need >60s functions for guild sync.

---

## 8. Implementation Timeline

### Week 1: Supabase Setup & Data Migration
- Days 1-2: Create Supabase project, set up schema
- Days 3-5: Write and run data migration script
- Day 5: Verify data integrity

### Week 2: Serverless Functions & API Routes
- Days 1-2: Create matches/worlds update functions
- Days 3-4: Implement guild sync (choose QStash vs simple approach)
- Day 5: Local testing of all functions

### Week 3: Page Migration & Integration
- Days 1-3: Update server queries to use Supabase
- Days 3-5: Update all pages (matches, match detail, guilds)
- Day 5: E2E testing

### Week 4: Deployment & Monitoring
- Days 1-2: Deploy to Vercel preview, test thoroughly
- Day 3: Deploy to production
- Days 4-5: Monitor, fix issues, optimize

**Total:** 4 weeks (same as hybrid approach)

---

## 9. Comparison: Supabase vs DynamoDB Hybrid

| Factor | Supabase + Vercel | DynamoDB Hybrid |
|--------|-------------------|-----------------|
| **AWS Dependency** | ❌ None | ⚠️ Still dependent |
| **Cost** | ✅ $0-25/month | ⚠️ $30-80/month |
| **Data Migration** | ⚠️ Required | ✅ Not needed |
| **Complexity** | ✅ Simpler | ⚠️ More complex |
| **Querying** | ✅ PostgreSQL | ⚠️ DynamoDB limits |
| **Local Development** | ✅ Easy (Supabase CLI) | ⚠️ Harder (AWS mocks) |
| **Guild Sync** | ⚠️ Need to replace Step Functions | ✅ Keep existing |
| **Real-time Features** | ✅ Built-in subscriptions | ❌ Not available |
| **Vendor Lock-in** | ⚠️ Supabase | ⚠️ AWS |
| **Time to Migrate** | 4 weeks | 3-4 weeks |

### Recommendation

**Use Supabase + Vercel if:**
- ✅ You want to eliminate AWS completely
- ✅ You prefer PostgreSQL over DynamoDB
- ✅ Cost is a priority
- ✅ You want simpler architecture
- ✅ Team has SQL experience

**Use DynamoDB Hybrid if:**
- ✅ You want minimal migration risk
- ✅ Data is already in DynamoDB
- ✅ Step Functions workflow is complex
- ✅ You're okay with AWS dependency
- ✅ Want faster migration (no data migration)

**My Recommendation:** Supabase + Vercel for long-term benefits, lower cost, and simpler architecture.

---

## 10. Next Steps

1. **Decision Point:** Choose between Supabase or DynamoDB hybrid approach
2. **If Supabase:** Follow this document
3. **If DynamoDB:** Follow original migration plan
4. **Either way:** Start with Phase 1 (infrastructure setup)

---

## Appendix: QStash Setup

### Install QStash (Optional)

```bash
# Sign up at https://upstash.com
# Create QStash instance
# Get QSTASH_TOKEN
npm install @upstash/qstash
```

### Environment Variables
```env
QSTASH_TOKEN=eyJxxx...
QSTASH_CURRENT_SIGNING_KEY=sig_xxx...
QSTASH_NEXT_SIGNING_KEY=sig_xxx...
```

### Configure Vercel
```bash
vercel env add QSTASH_TOKEN
vercel env add QSTASH_CURRENT_SIGNING_KEY
vercel env add QSTASH_NEXT_SIGNING_KEY
```

---

**End of Alternative Migration Plan**
