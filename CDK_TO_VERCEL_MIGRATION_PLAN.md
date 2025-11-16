# WvW.gg Migration Plan: AWS CDK → Vercel

## Executive Summary

This document outlines the migration strategy for porting the WvW.gg application from AWS CDK-based infrastructure (`adekau/wvwgg`) to Vercel-native deployment (`adekau/wvwgg-vibecoded`), and migrating pages from the old resizable panel layout to the new v2 layout.

**Migration Scope:**
- Infrastructure: AWS Lambda + CloudFront + DynamoDB → Vercel Serverless + Edge + DynamoDB
- Frontend: Old resizable 3-panel layout → New simplified layout
- Data Layer: Keep DynamoDB as external database (hybrid approach)
- Automation: Keep AWS Step Functions for guild sync (hybrid approach)

> **📘 Alternative Plan Available:** This document covers the hybrid AWS/Vercel approach. For a **fully AWS-free architecture using Supabase + Vercel**, see [SUPABASE_VERCEL_ALTERNATIVE.md](./SUPABASE_VERCEL_ALTERNATIVE.md)

---

## Table of Contents

1. [Current AWS Infrastructure Analysis](#1-current-aws-infrastructure-analysis)
2. [Target Vercel Architecture](#2-target-vercel-architecture)
3. [Migration Strategy](#3-migration-strategy)
4. [Page Layout Migration](#4-page-layout-migration)
5. [Data Layer Migration](#5-data-layer-migration)
6. [Deployment & Configuration](#6-deployment--configuration)
7. [Testing & Validation](#7-testing--validation)
8. [Rollback Plan](#8-rollback-plan)
9. [Timeline & Phases](#9-timeline--phases)

---

## 1. Current AWS Infrastructure Analysis

### 1.1 AWS Services in Use

#### **Compute Services**
- **Lambda Functions:**
  - `nextjs-lambda` (1024MB, 30s timeout, response streaming enabled)
  - `get-matches` (fetches WvW match data every 60 seconds)
  - `get-worlds` (fetches world data every 24 hours)
  - `get-wvw-guilds` (fetches guild IDs by region)
  - `get-guild-batch` (batch processes guild details)

#### **Data Storage**
- **DynamoDB Table:** `{stage}-WvWGGTable`
  - Single table design
  - Partition key: `type` (STRING), Sort key: `id` (STRING)
  - On-demand billing
  - Data types: `matches`, `worlds`, `guild`

- **S3 Buckets:**
  - Next.js static assets bucket (`_next/static`, `public`)
  - Automation results bucket (guild batch processing)

#### **Distribution & CDN**
- **CloudFront Distribution:**
  - Lambda Function URL as origin (with OAC authentication)
  - S3 origin for static assets
  - Custom cache policies for Next.js headers
  - Security headers (HSTS, XSS protection, CSP)
  - CloudFront Function for `x-forwarded-host` fix

#### **Orchestration**
- **Step Functions:** `WvWGGSyncGuildsStepFunction`
  - Distributed map processing for guild batching
  - 25 guilds per batch
  - 5-second wait between batches (rate limiting for GW2 API)

#### **Scheduling**
- **EventBridge Rules:**
  - Cron: Fetch matches every 60 seconds
  - Cron: Fetch worlds every 24 hours

#### **DNS & Certificates**
- **Route53:** Hosted zone for `wvw.gg`
- **ACM:** Wildcard certificate (`*.wvw.gg`)

### 1.2 Current Application Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  EventBridge    │────▶│  Lambda          │────▶│  GW2 API        │
│  (Cron Jobs)    │     │  (Data Fetchers) │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  DynamoDB        │
                        │  (Cache Layer)   │
                        └──────────────────┘
                               ▲
                               │
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  CloudFront     │────▶│  Next.js Lambda  │────▶│  DynamoDB       │
│  (CDN)          │     │  (SSR)           │     │  (Queries)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │
       ▼
┌─────────────────┐
│  S3 Bucket      │
│  (Static Assets)│
└─────────────────┘
```

### 1.3 Current Page Structure

**Old Layout (adekau/wvwgg):**
```
Root Layout (layout.tsx)
├── Parallel Routes: @content, (sidebar)
├── Resizable Panel System (3 panels)
│   ├── Left Panel: MainNav (collapsible navigation)
│   ├── Middle Panel: children (sidebar content)
│   └── Right Panel: content (main content area)
├── Jotai State Management
│   ├── MatchesProvider (server-fetched matches)
│   └── WorldsProvider (server-fetched worlds)
└── User Preferences (cookie-based panel sizes)

Routes:
- / → Redirects to /matches
- /matches → Match list (sidebar)
- /matches/[id] → Match details (content)
- /guilds → Guild table (content)
```

**Key Features:**
- Resizable panels with saved preferences
- Parallel routes for complex layouts
- Server-side data fetching in root layout
- Jotai atoms for client-side state sharing

---

## 2. Target Vercel Architecture

### 2.1 Vercel Services Mapping

| AWS Service | Vercel Equivalent | Notes |
|-------------|-------------------|-------|
| Lambda (Next.js) | Vercel Serverless Functions | Native Next.js support |
| Lambda (Data Fetchers) | Vercel Cron Jobs | Scheduled serverless functions |
| CloudFront | Vercel Edge Network | Automatic global CDN |
| S3 (Static Assets) | Vercel Build Output | Automatic asset optimization |
| EventBridge | Vercel Cron Jobs | Max 1 cron per function |
| Step Functions | **Keep in AWS** or Queue-based | No direct equivalent |
| DynamoDB | **Keep as external DB** | Use AWS SDK with credentials |
| Route53/ACM | Vercel Domains | Managed DNS & SSL |

### 2.2 Hybrid Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL                                    │
│                                                                  │
│  ┌───────────────┐     ┌────────────────────────────┐          │
│  │ Vercel Cron   │────▶│ Serverless Functions       │          │
│  │ Jobs          │     │ - /api/cron/matches        │          │
│  └───────────────┘     │ - /api/cron/worlds         │          │
│                        └────────────────────────────┘          │
│                                  │                              │
│                                  ▼                              │
│  ┌───────────────┐     ┌────────────────────────────┐          │
│  │ Vercel Edge   │────▶│ Next.js App (SSR)          │          │
│  │ Network       │     │ - /matches                 │          │
│  │               │     │ - /matches/[id]            │          │
│  │               │     │ - /guilds                  │          │
│  └───────────────┘     └────────────────────────────┘          │
│                                  │                              │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  EXTERNAL SERVICES   │
                        ├──────────────────────┤
                        │  DynamoDB (AWS)      │
                        │  - Managed via SDK   │
                        │  - IAM credentials   │
                        │    in Vercel Secrets │
                        └──────────────────────┘
                                   │
                        ┌──────────────────────┐
                        │  Step Functions (AWS)│
                        │  - Guild sync worker │
                        │  - Keep existing     │
                        └──────────────────────┘
```

### 2.3 New V2 Layout Structure

**Target Layout (adekau/wvwgg-vibecoded):**
```
Root Layout (layout.tsx)
├── Simple single-page layout
├── No parallel routes
├── ThemeProvider (next-themes)
├── Vercel Analytics
└── Shared header component

Routes:
- /matches → Match grid (single page)
- /matches/[matchId] → Match details (single page)
- /guilds → Guild cards (single page)

Components:
- MatchesHeader (shared navigation)
- RegionTabs (NA/EU filtering)
- MatchesGrid (match display)
- Match cards with tier badges
```

**Key Differences:**
- Simplified layout (no resizable panels)
- Single-page views instead of split panels
- Mock data (ready for real data integration)
- Modern UI with Radix primitives
- Tailwind CSS v4

---

## 3. Migration Strategy

### 3.1 Phase-Based Approach

#### **Phase 1: Infrastructure Setup** (Week 1)
1. Configure Vercel project
2. Set up environment variables
3. Configure AWS credentials for DynamoDB access
4. Set up Vercel Cron Jobs
5. Test DynamoDB connectivity

#### **Phase 2: Data Layer Integration** (Week 1-2)
1. Port server query functions from old repo
2. Create API route handlers for data fetching
3. Set up Vercel Cron Jobs for:
   - `GET /api/cron/matches` (every 60 seconds)
   - `GET /api/cron/worlds` (every 24 hours)
4. Test data fetching and caching

#### **Phase 3: Page Migration** (Week 2-3)
1. Migrate match list page
2. Migrate match detail page
3. Migrate guilds page
4. Replace mock data with real queries
5. Implement server components for SSR

#### **Phase 4: Guild Sync Migration** (Week 3-4)
**Option A: Keep in AWS (Recommended)**
- No changes needed
- Keep Step Functions + Lambda in AWS
- Continue using existing automation stack

**Option B: Migrate to Queue-based System**
- Implement Vercel Edge Config for guild IDs
- Create `/api/cron/sync-guilds-batch` endpoint
- Use external queue (Upstash, Redis) for batch tracking
- Implement rate limiting logic

#### **Phase 5: Testing & Optimization** (Week 4)
1. End-to-end testing
2. Performance optimization
3. SEO verification
4. Analytics verification

#### **Phase 6: DNS Cutover** (Week 5)
1. Deploy to production
2. Update DNS records
3. Monitor for issues
4. Decommission old AWS stack (optional)

### 3.2 Detailed Migration Steps

#### **Step 1: Vercel Project Configuration**

```bash
# Install Vercel CLI
npm i -g vercel

# Link project to Vercel
cd /home/user/wvwgg-vibecoded
vercel link

# Configure project settings
vercel env pull  # Download environment variables
```

**Environment Variables to Set:**
```env
# AWS Credentials (for DynamoDB access)
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-east-1

# DynamoDB Configuration
TABLE_NAME=prod-WvWGGTable  # or dev-WvWGGTable
WVWGG_STAGE=prod  # or dev

# Guild Wars 2 API Endpoints
ANET_MATCHES_ENDPOINT=https://api.guildwars2.com/v2/wvw/matches
ANET_WORLDS_ENDPOINT=https://api.guildwars2.com/v2/worlds
ANET_GUILD_ENDPOINT=https://api.guildwars2.com/v2/guild
WVW_GUILDS_ENDPOINT=https://api.guildwars2.com/v2/wvw/guilds

# Next.js Configuration
NODE_ENV=production
```

**vercel.json Configuration:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/matches",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/worlds",
      "schedule": "0 0 * * *"
    }
  ],
  "regions": ["iad1"],
  "functions": {
    "app/**/*.tsx": {
      "maxDuration": 30
    },
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

#### **Step 2: Port Server Query Functions**

**File: `/server/queries.ts`** (create this directory)

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { unstable_cache } from 'next/cache';

// Types (copy from old repo)
interface IFormattedMatch { /* ... */ }
interface IWorld { /* ... */ }
interface IGuild { /* ... */ }

// DynamoDB Client Setup
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

// Query Functions
export const getMatches = unstable_cache(
  async (): Promise<Record<string, IFormattedMatch> | null> => {
    try {
      const response = await docClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { type: 'matches', id: 'all' },
        })
      );

      if (!response.Item?.data) {
        // Fallback to GW2 API
        const apiResponse = await fetch(
          `${process.env.ANET_MATCHES_ENDPOINT}?ids=all`
        );
        return await apiResponse.json();
      }

      return response.Item.data;
    } catch (error) {
      console.error('Error fetching matches:', error);
      return null;
    }
  },
  ['matches'],
  { revalidate: 60, tags: ['matches'] }
);

export const getWorlds = unstable_cache(
  async (): Promise<IWorld[] | null> => {
    // Similar implementation
  },
  ['worlds'],
  { revalidate: 36000, tags: ['worlds'] }
);

export const getGuilds = unstable_cache(
  async (): Promise<IGuild[]> => {
    const response = await docClient.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':type': 'guild' },
      })
    );

    return response.Items?.map(item => item.data) || [];
  },
  ['guilds'],
  { revalidate: 86400, tags: ['guilds'] }
);
```

#### **Step 3: Create Vercel Cron API Routes**

**File: `/app/api/cron/matches/route.ts`**

```typescript
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { revalidateTag } from 'next/cache';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch from GW2 API
    const response = await fetch(
      `${process.env.ANET_MATCHES_ENDPOINT}?ids=all`
    );
    const matches = await response.json();

    // Format matches (copy formatting logic from old repo)
    const formattedMatches = formatMatches(matches);

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          type: 'matches',
          id: 'all',
          data: formattedMatches,
          updatedAt: new Date().toISOString(),
        },
      })
    );

    // Revalidate Next.js cache
    revalidateTag('matches');

    return Response.json({ success: true, count: Object.keys(formattedMatches).length });
  } catch (error) {
    console.error('Cron error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function formatMatches(matches: any[]): Record<string, any> {
  // Copy formatting logic from /home/user/wvwgg/cdk/lambdas/get-matches/index.ts
  return {};
}
```

**File: `/app/api/cron/worlds/route.ts`**

Similar implementation for worlds data.

#### **Step 4: Update next.config.mjs**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,  // Enable type checking
  },
  images: {
    unoptimized: false,  // Enable Vercel image optimization
  },
  output: 'standalone',  // Required for Docker/Vercel
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
```

---

## 4. Page Layout Migration

### 4.1 Old Layout Analysis

**Old Structure:**
- Root layout with parallel routes (`@content`, `(sidebar)`)
- 3-panel resizable system (nav, sidebar, content)
- Server-side data fetching in root layout
- Jotai providers for global state
- Cookie-based preference persistence

**Old Files to Reference:**
```
/home/user/wvwgg/web/app/
├── layout.tsx                      # Root layout with providers
├── page.tsx                        # Root redirect
├── (sidebar)/
│   ├── matches/
│   │   ├── page.tsx               # Match list (sidebar panel)
│   │   └── [id]/page.tsx          # Match sidebar detail
│   └── guilds/page.tsx            # Guild sidebar
├── @content/
│   ├── matches/
│   │   ├── page.tsx               # Match content panel
│   │   └── [id]/page.tsx          # Match detail content
│   └── guilds/page.tsx            # Guild content panel
└── components/
    ├── main-layout.tsx            # Resizable panel wrapper
    └── main-nav.tsx               # Left navigation
```

### 4.2 New V2 Layout Structure

**New Structure:**
- Simple single-page layouts
- Shared header component
- No resizable panels or parallel routes
- Server components for data fetching
- Mock data ready to be replaced

**Current V2 Files:**
```
/home/user/wvwgg-vibecoded/app/
├── layout.tsx                      # Simple root layout
├── matches/
│   ├── page.tsx                   # Match grid (mock data)
│   └── [matchId]/page.tsx         # Match detail (mock data)
├── guilds/page.tsx                # Guild cards (mock data)
└── components/
    ├── matches-header.tsx         # Shared header
    ├── region-tabs.tsx            # NA/EU tabs
    ├── matches-grid.tsx           # Match grid
    └── match-card.tsx             # Individual match card
```

### 4.3 Migration Tasks

#### **Task 1: Replace Mock Data in Matches Page**

**Current:** `/app/matches/page.tsx` (uses mock data)
**Target:** Fetch real data from DynamoDB

```typescript
import { MatchesHeader } from '@/components/matches-header'
import { RegionTabs } from '@/components/region-tabs'
import { MatchesGrid } from '@/components/matches-grid'
import { getMatches, getWorlds } from '@/server/queries'

export default async function MatchesPage() {
  const matches = await getMatches();
  const worlds = await getWorlds();

  if (!matches || !worlds) {
    return <div>Loading...</div>;
  }

  // Transform data for display
  const displayMatches = Object.values(matches).map(match => {
    // Format match data for MatchesGrid component
    return {
      tier: `${match.region}-${match.tier}`,
      worlds: match.all_worlds.map(world => ({
        name: worlds.find(w => w.id === world.id)?.name || '',
        kills: world.kills,
        deaths: world.deaths,
        color: world.color,
      })),
    };
  });

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
  )
}
```

#### **Task 2: Create Match Detail Page**

**File:** `/app/matches/[matchId]/page.tsx`

Currently exists but needs real data integration. Reference old implementation:
- `/home/user/wvwgg/web/app/@content/matches/[id]/page.tsx`

**Implementation:**
```typescript
import { notFound } from 'next/navigation';
import { getMatches, getWorlds } from '@/server/queries';

export default async function MatchDetailPage({
  params,
}: {
  params: { matchId: string }
}) {
  const matches = await getMatches();
  const worlds = await getWorlds();

  const match = matches?.[params.matchId];
  if (!match) {
    notFound();
  }

  // Build match detail view
  // Reference old components from:
  // /home/user/wvwgg/web/app/@content/matches/[id]/page.tsx

  return (
    <div className="min-h-screen">
      {/* Match detail implementation */}
    </div>
  );
}
```

#### **Task 3: Migrate Guilds Page**

**Current:** `/app/guilds/page.tsx` (mock data)
**Target:** Fetch real guild data

```typescript
import { MatchesHeader } from '@/components/matches-header'
import { getGuilds } from '@/server/queries'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function GuildsPage() {
  const guilds = await getGuilds();

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Guilds</h1>
          <p className="text-muted-foreground">
            Guild Wars 2 WvW Guilds
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guilds.map((guild, idx) => (
            <Card key={guild.id} className="panel-border inset-card">
              {/* Guild card implementation */}
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
```

#### **Task 4: Port Shared Components**

Components to port from old repo:
1. Match statistics displays
2. World vs World map visualizations (if any)
3. Guild table/filtering logic
4. Score tracking components

**Old Components Location:**
```
/home/user/wvwgg/web/app/components/
├── match-stats.tsx
├── world-card.tsx
├── guild-table.tsx
└── ...
```

Copy and adapt to new layout system.

### 4.4 Layout Comparison Table

| Feature | Old Layout | New V2 Layout | Migration Action |
|---------|-----------|---------------|------------------|
| Panel System | 3 resizable panels | Single page | **Remove** resizable panels, merge content |
| Navigation | Left sidebar (collapsible) | Top header | **Move** nav to header component |
| Match List | Sidebar panel | Full page grid | **Convert** sidebar to full grid |
| Match Detail | Right content panel | Dedicated page | **Create** `/matches/[id]` page |
| Guilds | Right content panel | Dedicated page | Already exists, needs data |
| State Management | Jotai providers | Server components | **Replace** with async data fetching |
| Preferences | Cookie-based panel sizes | Not needed | **Remove** preference system |
| Parallel Routes | `@content`, `(sidebar)` | Standard routes | **Simplify** to standard routing |

### 4.5 UI Component Updates

The new layout uses more modern UI components. Update imports:

**Old (custom components):**
```typescript
import { ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useAtom } from 'jotai';
```

**New (keep existing Radix components):**
```typescript
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
```

---

## 5. Data Layer Migration

### 5.1 Database Strategy: Hybrid Approach (Recommended)

**Keep DynamoDB in AWS** and access it from Vercel using AWS SDK.

**Pros:**
- No data migration needed
- Maintains existing data structure
- Can keep automation stack in AWS
- Minimal disruption

**Cons:**
- Requires AWS credentials in Vercel
- Additional latency from Vercel → AWS
- Still dependent on AWS services

**Alternative: Full Migration to Vercel Postgres/KV**

| Current (DynamoDB) | Vercel Alternative | Migration Effort |
|--------------------|-------------------|------------------|
| Matches cache | Vercel KV (Redis) | Medium |
| Worlds cache | Vercel KV (Redis) | Medium |
| Guild data | Vercel Postgres | High |

**Not recommended** due to:
- Data migration complexity
- Need to rewrite all queries
- Step Functions still needs DynamoDB access

### 5.2 DynamoDB Access from Vercel

**IAM User Setup:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/prod-WvWGGTable"
    }
  ]
}
```

**Vercel Environment Variables:**
```env
AWS_ACCESS_KEY_ID=<iam-user-access-key>
AWS_SECRET_ACCESS_KEY=<iam-user-secret-key>
AWS_REGION=us-east-1
TABLE_NAME=prod-WvWGGTable
```

### 5.3 Caching Strategy

**Old (AWS):**
- DynamoDB as cache layer
- Lambda unstable_cache with revalidation
- EventBridge triggers cache refresh

**New (Vercel):**
- Keep DynamoDB as cache layer
- Next.js unstable_cache with revalidation
- Vercel Cron Jobs trigger cache refresh

**Cache Revalidation:**
```typescript
// In server queries
export const getMatches = unstable_cache(
  async () => { /* ... */ },
  ['matches'],
  {
    revalidate: 60,  // Seconds
    tags: ['matches']
  }
);

// In cron route
revalidateTag('matches');  // Force refresh
```

### 5.4 Data Formatting

**Copy formatting logic from:**
```
/home/user/wvwgg/cdk/lambdas/get-matches/index.ts
/home/user/wvwgg/cdk/lambdas/get-worlds/index.ts
```

**Create utility functions:**
```
/server/formatters/
├── matches.ts
├── worlds.ts
└── guilds.ts
```

---

## 6. Deployment & Configuration

### 6.1 Vercel Project Setup

**Initial Setup:**
```bash
# Login to Vercel
vercel login

# Link project
cd /home/user/wvwgg-vibecoded
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Project Settings:**
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node Version:** 20.x

### 6.2 Environment Variables

**Required Variables:**

| Variable | Value | Environment |
|----------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user key | Production, Preview |
| `AWS_SECRET_ACCESS_KEY` | IAM secret | Production, Preview |
| `AWS_REGION` | `us-east-1` | Production, Preview |
| `TABLE_NAME` | `prod-WvWGGTable` | Production |
| `TABLE_NAME` | `dev-WvWGGTable` | Preview |
| `WVWGG_STAGE` | `prod` | Production |
| `WVWGG_STAGE` | `dev` | Preview |
| `CRON_SECRET` | Random secret | Production, Preview |
| `ANET_MATCHES_ENDPOINT` | GW2 API URL | Production, Preview |
| `ANET_WORLDS_ENDPOINT` | GW2 API URL | Production, Preview |
| `ANET_GUILD_ENDPOINT` | GW2 API URL | Production, Preview |
| `WVW_GUILDS_ENDPOINT` | GW2 API URL | Production, Preview |

**Set via Vercel CLI:**
```bash
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
# etc...
```

### 6.3 Domain Configuration

**Current Domains (AWS):**
- `wvw.gg` (production)
- `www.wvw.gg` (redirect)
- `beta.wvw.gg` (dev)

**Vercel Domain Setup:**
1. Add domains in Vercel dashboard
2. Update DNS records:
   - `wvw.gg` A → Vercel IP
   - `www.wvw.gg` CNAME → cname.vercel-dns.com
   - `beta.wvw.gg` CNAME → cname.vercel-dns.com
3. Enable automatic SSL (handled by Vercel)

**DNS Migration Steps:**
1. Lower TTL on Route53 records (1 hour before migration)
2. Deploy to Vercel production
3. Test with `/etc/hosts` override
4. Update Route53 records
5. Monitor traffic shift
6. Raise TTL after 24 hours

### 6.4 Vercel Cron Jobs Configuration

**File:** `vercel.json`

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
    }
  ]
}
```

**Cron Schedule Format:**
- `* * * * *` - Every minute
- `0 0 * * *` - Daily at midnight UTC

**Note:** Vercel cron jobs run in UTC timezone only.

### 6.5 Build Configuration

**Update `package.json` scripts:**
```json
{
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "start": "next start",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  }
}
```

**Re-enable type checking in `next.config.mjs`:**
```javascript
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,  // Change from true
  },
  images: {
    unoptimized: false,  // Enable Vercel optimization
  },
}
```

---

## 7. Testing & Validation

### 7.1 Pre-Migration Testing

**Local Testing:**
```bash
# Install dependencies
npm install

# Create .env.local with AWS credentials
cat > .env.local << EOF
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=us-east-1
TABLE_NAME=dev-WvWGGTable
EOF

# Run development server
npm run dev

# Test pages:
# http://localhost:3000/matches
# http://localhost:3000/guilds
```

**Vercel Preview Testing:**
```bash
# Deploy to preview
vercel

# Test preview URL
# Verify data fetching
# Check cron jobs in Vercel dashboard
```

### 7.2 Data Validation Checklist

- [ ] Matches data displays correctly
- [ ] Match detail pages load
- [ ] World names resolve correctly
- [ ] Guild data displays
- [ ] Filters work (NA/EU tabs)
- [ ] Score statistics calculate correctly
- [ ] Server components render with data
- [ ] Cron jobs execute successfully
- [ ] Cache revalidation works

### 7.3 Performance Testing

**Metrics to Monitor:**
- [ ] Time to First Byte (TTFB) < 500ms
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] DynamoDB query latency
- [ ] Edge network response time

**Tools:**
- Vercel Analytics
- Chrome DevTools
- Lighthouse CI
- WebPageTest

### 7.4 Functional Testing

**Test Cases:**
1. **Match List Page**
   - [ ] Displays all matches
   - [ ] NA/EU filtering works
   - [ ] Tier badges show correctly
   - [ ] Links to match details work

2. **Match Detail Page**
   - [ ] Shows detailed statistics
   - [ ] World information displays
   - [ ] Score tracking works
   - [ ] Back navigation functions

3. **Guilds Page**
   - [ ] Guild cards render
   - [ ] Guild data is accurate
   - [ ] Filtering/search works (if implemented)

4. **Cron Jobs**
   - [ ] Matches update every minute
   - [ ] Worlds update daily
   - [ ] DynamoDB writes succeed
   - [ ] Cache invalidation works

5. **Error Handling**
   - [ ] DynamoDB connection failures
   - [ ] GW2 API failures
   - [ ] Missing data gracefully handled
   - [ ] Loading states display

---

## 8. Rollback Plan

### 8.1 Rollback Triggers

Rollback if:
- Critical functionality broken
- Data not displaying correctly
- Performance degradation > 50%
- Cron jobs failing consistently
- DynamoDB connection issues
- User-reported critical bugs

### 8.2 Rollback Steps

**DNS Rollback (< 5 minutes):**
```bash
# In Route53, update A record for wvw.gg
# Point back to CloudFront distribution ID

# Old CloudFront URL: <distribution-id>.cloudfront.net
# Update record to old CNAME target
```

**Vercel Deployment Rollback:**
```bash
# In Vercel dashboard:
# Deployments → Find previous working deployment → Promote to Production

# Or via CLI:
vercel rollback <deployment-url>
```

**Partial Rollback:**
- Keep Vercel deployment live at `beta.wvw.gg`
- Keep production at old AWS stack
- Debug issues before retry

### 8.3 Rollback Communication

**User Notification:**
- Post status update if downtime > 5 minutes
- Communicate via social media / Discord (if applicable)
- Update status page

---

## 9. Timeline & Phases

### 9.1 Estimated Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Setup** | 2-3 days | Vercel project, environment variables, AWS credentials |
| **Phase 2: Data Layer** | 3-5 days | Port queries, create cron jobs, test DynamoDB access |
| **Phase 3: Page Migration** | 5-7 days | Migrate all pages, replace mock data, test functionality |
| **Phase 4: Guild Sync** | 2-3 days | Decision on AWS vs Vercel, implementation |
| **Phase 5: Testing** | 3-5 days | E2E testing, performance optimization, bug fixes |
| **Phase 6: DNS Cutover** | 1 day | DNS changes, monitoring, stabilization |
| **Total** | **3-4 weeks** | |

### 9.2 Milestones

**Week 1:**
- ✅ Vercel project configured
- ✅ DynamoDB connectivity tested
- ✅ Server query functions ported
- ✅ Cron jobs created and tested

**Week 2:**
- ✅ Matches page migrated
- ✅ Match detail page migrated
- ✅ Real data replacing mock data

**Week 3:**
- ✅ Guilds page migrated
- ✅ All components functional
- ✅ Guild sync decision made
- ✅ Full E2E testing complete

**Week 4:**
- ✅ Performance optimization done
- ✅ Preview deployment validated
- ✅ DNS cutover completed
- ✅ Production monitoring stable

### 9.3 Critical Path

```
Setup Vercel → Port Queries → Create Cron Jobs → Test Data Fetching
                                                         ↓
                                          Migrate Match List Page
                                                         ↓
                                         Migrate Match Detail Page
                                                         ↓
                                            Migrate Guilds Page
                                                         ↓
                                              E2E Testing
                                                         ↓
                                             DNS Cutover
```

**Blockers:**
- AWS credentials approval
- DynamoDB IAM policy configuration
- Domain DNS propagation (24-48 hours)

---

## 10. Post-Migration Tasks

### 10.1 AWS Cleanup (Optional)

**If fully migrated to Vercel:**
- [ ] Decommission CloudFront distribution
- [ ] Delete Lambda functions (keep data fetchers if using hybrid)
- [ ] Delete S3 assets bucket
- [ ] Remove EventBridge rules (keep if using hybrid)
- [ ] Keep DynamoDB table
- [ ] Keep Step Functions (if using hybrid)
- [ ] Delete CDK stacks (after 30-day grace period)

**Cost Savings:**
- CloudFront: ~$50-100/month
- Lambda: ~$20-50/month
- S3: ~$5-10/month
- **Total:** ~$75-160/month

**Keep in AWS (Hybrid):**
- DynamoDB table: ~$10-20/month
- Step Functions + Lambda (guild sync): ~$5-10/month
- **Total AWS cost:** ~$15-30/month

### 10.2 Monitoring Setup

**Vercel Analytics:**
- Enable Web Analytics
- Set up performance budgets
- Configure alerts

**External Monitoring:**
- Uptime monitoring (UptimeRobot, Pingdom)
- Error tracking (Sentry)
- Performance monitoring (SpeedCurve)

**Custom Alerts:**
- Cron job failures
- DynamoDB connection errors
- API rate limit warnings

### 10.3 Documentation Updates

- [ ] Update README with Vercel deployment instructions
- [ ] Document environment variables
- [ ] Update architecture diagrams
- [ ] Create runbook for common issues
- [ ] Document rollback procedures

---

## 11. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| DynamoDB connection failure | High | Low | Test thoroughly, have rollback ready |
| Cron jobs not executing | High | Medium | Monitor closely, set up alerts |
| DNS propagation delay | Medium | Medium | Lower TTL beforehand, plan timing |
| Data formatting issues | Medium | Medium | Extensive testing, compare outputs |
| Performance degradation | Medium | Low | Load testing, optimization |
| AWS credential exposure | High | Low | Use Vercel secrets, rotate regularly |
| Guild sync migration complexity | Medium | High | Keep in AWS (hybrid approach) |

---

## 12. Success Criteria

**Migration is successful when:**
- [ ] All pages load correctly with real data
- [ ] Matches update every minute
- [ ] Worlds update daily
- [ ] Guild data displays accurately
- [ ] Performance metrics meet targets (LCP < 2.5s)
- [ ] No critical errors in first 24 hours
- [ ] Cron jobs execute reliably
- [ ] DynamoDB queries succeed > 99.9%
- [ ] User experience matches or exceeds old site
- [ ] Cost reduced by > 50% (AWS → Vercel)

---

## 13. Decision Matrix

### Key Decision: Guild Sync Migration

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Keep in AWS** | ✅ No migration needed<br>✅ Proven workflow<br>✅ Lower risk | ❌ Still dependent on AWS<br>❌ Higher cost | **Recommended** |
| **Migrate to Vercel** | ✅ Full Vercel migration<br>✅ Lower cost | ❌ Complex implementation<br>❌ Need queue system<br>❌ Higher risk | Not recommended |
| **Remove guild sync** | ✅ Simplest<br>✅ Lowest cost | ❌ Lose functionality<br>❌ Manual updates needed | Not recommended |

**Recommended:** Keep Step Functions + Lambda in AWS (hybrid approach)

---

## 14. References

### Old Repository Files
```
/home/user/wvwgg/
├── cdk/lib/
│   ├── wvwgg-stack.ts              # Main CDK stack
│   ├── constructs/
│   │   ├── build.ts                # Docker build system
│   │   ├── assets.ts               # S3 asset deployment
│   │   ├── distribution.ts         # CloudFront config
│   │   └── sync-guilds.ts          # Step Functions
│   └── lambdas/
│       ├── get-matches/index.ts    # Match data fetcher
│       ├── get-worlds/index.ts     # World data fetcher
│       └── get-guild-batch/index.ts # Guild batch processor
└── web/
    ├── app/
    │   ├── layout.tsx              # Root layout (resizable panels)
    │   ├── (sidebar)/              # Sidebar routes
    │   └── @content/               # Content routes
    └── server/
        └── queries.ts              # DynamoDB queries
```

### New Repository Structure
```
/home/user/wvwgg-vibecoded/
├── app/
│   ├── layout.tsx                  # Simple root layout
│   ├── matches/
│   │   ├── page.tsx               # Match grid (to be updated)
│   │   └── [matchId]/page.tsx     # Match detail (to be updated)
│   ├── guilds/page.tsx            # Guild cards (to be updated)
│   └── api/
│       └── cron/                  # Cron job routes (to be created)
├── server/
│   ├── queries.ts                 # DynamoDB queries (to be created)
│   └── formatters/                # Data formatters (to be created)
├── components/                     # UI components (existing)
└── vercel.json                    # Vercel config (to be created)
```

### External Resources
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Next.js unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Guild Wars 2 API Documentation](https://wiki.guildwars2.com/wiki/API:Main)

---

## Appendix A: Environment Variable Template

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# DynamoDB Configuration
TABLE_NAME=prod-WvWGGTable
WVWGG_STAGE=prod

# Cron Security
CRON_SECRET=

# Guild Wars 2 API Endpoints
ANET_MATCHES_ENDPOINT=https://api.guildwars2.com/v2/wvw/matches
ANET_WORLDS_ENDPOINT=https://api.guildwars2.com/v2/worlds
ANET_GUILD_ENDPOINT=https://api.guildwars2.com/v2/guild
WVW_GUILDS_ENDPOINT=https://api.guildwars2.com/v2/wvw/guilds

# Next.js
NODE_ENV=production
NEXT_PUBLIC_VERCEL_URL=
```

---

## Appendix B: Useful Commands

```bash
# Vercel Deployment
vercel                    # Deploy to preview
vercel --prod             # Deploy to production
vercel env ls             # List environment variables
vercel env pull           # Download env vars to .env.local
vercel logs               # View deployment logs
vercel rollback           # Rollback deployment

# Local Development
npm run dev               # Start dev server
npm run build             # Build production
npm run start             # Start production server
npm run lint              # Run ESLint
npm run type-check        # Run TypeScript checks

# AWS CLI (for testing DynamoDB)
aws dynamodb get-item \
  --table-name prod-WvWGGTable \
  --key '{"type":{"S":"matches"},"id":{"S":"all"}}'

# DNS Testing
dig wvw.gg                # Check DNS resolution
nslookup wvw.gg           # Alternative DNS check
```

---

## End of Migration Plan

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Author:** Migration Planning Team
**Status:** Ready for Implementation
