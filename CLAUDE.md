# CLAUDE.md - AI Assistant Guide for WvW.gg

This document provides comprehensive guidance for AI assistants working with the WvW.gg codebase.

## Project Overview

**WvW.gg** is a production-grade analytics platform for Guild Wars 2's World vs World (WvW) competitive game mode. The application provides real-time match tracking, historical performance analysis, guild information, build optimization tools, and predictive analytics for competitive play.

**Key Features:**
- Real-time WvW match tracking (3-team competitive mode)
- Historical match data and statistical analysis
- Guild search and directory
- Admin dashboard for data management
- Character build optimizer with gear calculations
- Monte Carlo simulations for match outcome predictions
- Prime-time performance analytics

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.0.3 (App Router), React 19.2.0, TypeScript 5 |
| **UI Components** | shadcn/ui with Radix UI primitives (30+ components) |
| **Styling** | Tailwind CSS 4.1.9 with CSS variables, responsive design |
| **State Management** | TanStack React Query v5.90.10 |
| **Forms** | react-hook-form + Zod validation |
| **Database** | AWS DynamoDB with 2 Global Secondary Indexes |
| **Authentication** | AWS Cognito (amazon-cognito-identity-js) |
| **Backend** | Next.js API Routes, AWS Lambda (Node.js 22.x) |
| **Infrastructure** | AWS CDK, EventBridge, S3, Vercel OIDC |
| **Testing** | Vitest 4.0.10 with UI |
| **Deployment** | Vercel (frontend), AWS (backend infrastructure) |
| **External APIs** | Guild Wars 2 API v2 |

## Directory Structure

```
/home/user/wvwgg-vibecoded/
├── app/                          # Next.js 16 App Router
│   ├── api/                      # API routes (17 endpoints)
│   │   ├── admin/               # Admin-gated endpoints
│   │   ├── gw2/                 # GW2 game data proxies
│   │   ├── guilds/              # Guild operations
│   │   └── [match routes]       # Match data endpoints
│   ├── admin/                    # Protected admin pages
│   │   ├── dashboard/           # Admin overview
│   │   ├── guilds/              # Guild management
│   │   ├── audit-logs/          # Activity logs
│   │   └── login/               # Cognito authentication
│   ├── builds/                   # Build creation/editing tools
│   ├── guilds/                   # Guild pages
│   ├── matches/                  # Match listings and details
│   │   └── [matchId]/           # Individual match pages
│   │       └── scenarios/       # VP scenario analyzer
│   ├── maps/                     # WvW map visualizations
│   ├── legend/                   # Game mechanics documentation
│   ├── layout.tsx                # Root layout (providers)
│   └── page.tsx                  # Home page
│
├── components/                   # 94 React components
│   ├── ui/                       # shadcn/ui components (30+)
│   │   ├── button.tsx           # Base button component
│   │   ├── card.tsx             # Compound card component
│   │   ├── form.tsx             # Form components
│   │   └── [other-ui].tsx       # Radix-based primitives
│   ├── enhanced-match-card.tsx  # Match display
│   ├── guild-search-modal.tsx   # Guild discovery
│   ├── navbar.tsx               # Site navigation
│   └── [feature-components].tsx # Domain-specific components
│
├── lib/                          # Business logic and utilities
│   ├── gw2/                      # Guild Wars 2 integration
│   │   ├── api.ts               # GW2 v2 API client
│   │   ├── types.ts             # 615+ lines of interfaces
│   │   ├── build-calculator.ts  # Character stat calculations
│   │   └── gear-optimizer.ts    # Equipment optimization
│   ├── auth-context.tsx         # Cognito auth provider
│   ├── game-constants.ts        # WvW mechanics (PPT, VP, timings)
│   ├── monte-carlo-simulator.ts # Match prediction engine
│   ├── historical-performance.ts# Team statistics analysis
│   ├── ppt-calculator.ts        # Points per tick calculations
│   ├── vp-scenario-solver-*.ts  # VP outcome solvers (3 variants)
│   └── utils.ts                 # Shared utilities (cn, etc.)
│
├── server/                       # Server-side data layer
│   ├── queries.ts               # DynamoDB query functions
│   └── aws-credentials.ts       # OIDC credential provider
│
├── cdk/                          # AWS Infrastructure as Code
│   ├── lib/
│   │   ├── wvwgg-stack-simplified.ts  # Main stack
│   │   └── automation-stack.ts        # Lambda orchestration
│   ├── lambda/                  # Lambda function handlers
│   │   ├── get-matches.ts       # Fetch match data
│   │   ├── get-worlds.ts        # Fetch world data
│   │   └── [other-lambdas].ts   # Data processing
│   └── shared/                  # Shared Lambda utilities
│
├── __tests__/                    # Unit tests (Vitest)
├── hooks/                        # Custom React hooks
├── public/                       # Static assets
├── docs/                         # Documentation
└── styles/                       # Global styles
```

## Architecture Patterns

### Server vs Client Components

**Server Components (Default):**
- All page components (`page.tsx`)
- Layout components without state/interactivity
- Data-fetching components
- Components that access backend directly

**Client Components (`'use client'`):**
- Components with interactivity (useState, useEffect)
- Event handlers (onClick, onChange)
- Browser-only APIs (localStorage, window)
- Context providers (AuthContext, QueryProvider)
- Real-time updates via React Query

### Data Flow

```
GW2 API (source of truth)
    ↓
EventBridge (scheduled rules) → Lambda functions
    ↓
DynamoDB (wvwgg-{stage} table)
    ↓
Next.js API routes (/app/api/**/route.ts)
    ↓
React Query (client-side caching)
    ↓
React Components
```

### DynamoDB Schema

**Table:** `wvwgg-{stage}` (dev/prod)

**Keys:**
- Partition Key: `type` (STRING) - Entity type
- Sort Key: `id` (STRING) - Entity identifier

**Global Secondary Indexes:**
1. **type-interval-index**
   - PK: `type` (STRING)
   - SK: `interval` (NUMBER) - Timestamp for historical data

2. **matchId-interval-index**
   - PK: `matchId` (STRING)
   - SK: `interval` (NUMBER) - For querying match history

**Data Types:**
- `type: 'matches'` - Current match states
- `type: 'worlds'` - World populations
- `type: 'guild'` - Guild directory
- `type: 'match-history'` - Compressed time-series snapshots
- `type: 'prime-time-stats'` - Pre-computed statistics

**Important Patterns:**
- Historical snapshots are gzip-compressed and base64-encoded
- Pagination uses DynamoDB's `LastEvaluatedKey`
- Caching with `unstable_cache` and revalidation tags
- Fallback to GW2 API if DynamoDB is unavailable

## Code Conventions

### TypeScript Standards

**Configuration:**
- Strict mode enabled (`"strict": true`)
- Path aliases: `@/*` maps to project root
- Module resolution: Bundler (modern ESM)
- JSX: `react-jsx` (no React import needed)

**Naming Conventions:**

```typescript
// Files
PascalCase.tsx           // Components (MatchCard.tsx)
kebab-case.ts           // Utilities (game-constants.ts)
use-kebab-case.ts       // Hooks (use-mobile.ts)
route.ts                // API routes
page.tsx                // Pages
layout.tsx              // Layouts

// Variables and Functions
camelCase               // Variables, functions
PascalCase              // Classes, Types, Interfaces
UPPER_SNAKE_CASE        // Constants

// Interfaces and Types
interface MatchData { } // Prefer interfaces for objects
type MatchId = string   // Prefer types for unions/primitives
```

**Import Organization:**

```typescript
// 1. React and Next.js
import { useState } from 'react'
import { Metadata } from 'next'

// 2. Third-party libraries
import { QueryClient } from '@tanstack/react-query'
import { cn } from 'class-variance-authority'

// 3. Local absolute imports (@/*)
import { getMatches } from '@/server/queries'
import { Button } from '@/components/ui/button'
import { PPT_RATES } from '@/lib/game-constants'

// 4. Relative imports (use sparingly)
import { helper } from './utils'
```

### Component Patterns

**Compound Components:**

```tsx
// Export multiple related components together
export function Card({ children, className, ...props }: CardProps) { }
export function CardHeader({ children, className, ...props }: CardHeaderProps) { }
export function CardTitle({ children, className, ...props }: CardTitleProps) { }

// Usage
<Card>
  <CardHeader>
    <CardTitle>Match Details</CardTitle>
  </CardHeader>
</Card>
```

**Slot Pattern:**

```tsx
// Use data-slot for CSS targeting
<div data-slot="icon" className="size-4">
  <Icon />
</div>
```

**Responsive Design:**

```tsx
// Mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Content */}
</div>
```

### API Route Patterns

**File Structure:**
```typescript
// app/api/matches/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
```

**Dynamic Routes:**
```typescript
// app/api/matches/[matchId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { matchId: string } }
) {
  const { matchId } = params
  // Use matchId
}
```

### Styling Conventions

**Tailwind Usage:**

```tsx
import { cn } from '@/lib/utils'

// Use cn() utility for conditional classes
<div className={cn(
  "base-classes",
  variant === "primary" && "primary-classes",
  className // Allow prop overrides
)}>
```

**CSS Variables:**

```css
/* Defined in styles/globals.css */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--card: 0 0% 100%;
--primary: 222.2 47.4% 11.2%;

/* Usage in Tailwind */
<div className="bg-background text-foreground">
```

## Domain Knowledge: Guild Wars 2 WvW

Understanding WvW mechanics is crucial for working with this codebase.

### Core Concepts

**WvW Basics:**
- 3-team competitive mode (Red vs Blue vs Green)
- Matches last 1 week (Friday 18:00 UTC to Friday 18:00 UTC)
- Each team controls objectives to earn points
- Winner determined by Victory Points (VP)

**Scoring System:**

```typescript
// Points Per Tick (PPT)
TICK_INTERVAL = 5 minutes
POINTS_PER_TICK = Sum of all controlled objectives

// Victory Points (VP)
SKIRMISH_DURATION = 2 hours
VP_AWARDS: 1st place = 5 VP, 2nd = 4 VP, 3rd = 3 VP
SKIRMISHES_PER_MATCH = 84 (7 days × 12 per day)
```

**Objective Types:**
- **Camps**: 5 PPT each
- **Towers**: 10 PPT each
- **Keeps**: 25 PPT each
- **Stonemist Castle**: 35 PPT
- **Tier Bonuses**: Additional PPT based on control percentage

### Key Constants

Located in `/home/user/wvwgg-vibecoded/lib/game-constants.ts`:

```typescript
TICK_INTERVAL_MS = 300000 (5 minutes)
SKIRMISH_DURATION_MS = 7200000 (2 hours)
TICK_POINTS_BASE = { camp: 5, tower: 10, keep: 25, castle: 35 }
TIER_THRESHOLDS = [0, 100, 250, 400] // PPT thresholds
VP_DISTRIBUTION = [5, 4, 3] // 1st, 2nd, 3rd place
```

### Important Calculations

**PPT Calculator** (`lib/ppt-calculator.ts`):
- Calculates points per tick from objective control
- Accounts for tier bonuses
- Used for real-time match scoring

**VP Scenario Solver** (`lib/vp-scenario-solver-*.ts`):
- Determines possible VP outcomes for remaining skirmishes
- Three implementations:
  - `vp-scenario-solver.ts` - Original
  - `vp-scenario-solver-hybrid.ts` - Hybrid approach
  - `vp-scenario-solver-optimized.ts` - Performance optimized
- Uses constraint satisfaction (logic-solver) and linear programming (glpk.js)

**Monte Carlo Simulator** (`lib/monte-carlo-simulator.ts`):
- Predicts match outcomes based on historical performance
- Runs 10,000+ simulations
- Accounts for prime-time statistics
- Tests located in `__tests__/monte-carlo-simulator.test.ts`

## Development Workflows

### Local Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
# Open http://localhost:3000

# Run tests
npm test            # Run all tests
npm run test:ui     # Interactive test UI
npm run test:coverage  # Coverage report

# Build for production
npm run build
npm start

# Analyze bundle
npm run build:analyze
```

### Environment Variables

Required variables (see `.env.example`):

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::{account}:role/vercel-oidc-{stage}
TABLE_NAME=wvwgg-{stage}
WVWGG_STAGE=dev  # or prod

# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXX
NEXT_PUBLIC_COGNITO_REGION=us-east-1

# GW2 API Endpoints
ANET_MATCHES_ENDPOINT=https://api.guildwars2.com/v2/wvw/matches
ANET_WORLDS_ENDPOINT=https://api.guildwars2.com/v2/worlds
ANET_GUILD_ENDPOINT=https://api.guildwars2.com/v2/guild

# Security
CRON_SECRET={your-secret}
NODE_ENV=development
```

### Working with DynamoDB

**Query Patterns:**

```typescript
// File: server/queries.ts

// Get all matches
const matches = await getMatches()

// Get match history
const history = await getMatchHistory(matchId, limit)

// Get worlds with pagination
const { worlds, cursor } = await getWorlds(pageSize, cursor)

// Get guild by ID
const guild = await getGuildById(guildId)
```

**Important Notes:**
- Always handle pagination with `LastEvaluatedKey`
- Use appropriate GSI for historical queries
- Implement fallback to GW2 API for resilience
- Compress large payloads (match history)

### Working with React Query

**Query Keys Convention:**

```typescript
// Consistent query key structure
['matches']                    // All matches
['match', matchId]            // Single match
['match-history', matchId]    // Match history
['guilds', { search }]        // Guilds with filters
['worlds']                    // All worlds
```

**Usage Pattern:**

```typescript
import { useQuery } from '@tanstack/react-query'

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const res = await fetch('/api/matches')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000, // Auto-refresh every minute
  })
}
```

### Testing Guidelines

**Unit Tests:**
- Located in `__tests__/`
- Use Vitest framework
- Focus on complex algorithms (Monte Carlo, VP solvers)
- Mock external dependencies

**Example Test:**

```typescript
import { describe, it, expect } from 'vitest'
import { runMonteCarlo } from '@/lib/monte-carlo-simulator'

describe('Monte Carlo Simulator', () => {
  it('should predict outcomes within confidence bounds', () => {
    const result = runMonteCarlo(historicalData, 10000)
    expect(result.confidence).toBeGreaterThan(0.9)
  })
})
```

### Git Workflow

**Branch Naming:**
- `claude/*` - Claude AI-generated branches (used by this project)
- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code refactoring

**Commit Messages:**
- Be descriptive and concise
- Follow conventional commits style
- Reference issues when applicable

**Example:**
```
feat: Add Monte Carlo simulation for match predictions

- Implement 10,000 iteration simulator
- Add historical performance weighting
- Include confidence intervals
```

## Common Tasks

### Adding a New UI Component

1. **Generate with shadcn/ui:**
```bash
npx shadcn@latest add [component-name]
# Components added to components/ui/
```

2. **Customize if needed:**
```tsx
// components/ui/my-component.tsx
import { cn } from '@/lib/utils'

export function MyComponent({ className, ...props }) {
  return (
    <div className={cn("base-classes", className)} {...props} />
  )
}
```

3. **Use in pages/components:**
```tsx
import { MyComponent } from '@/components/ui/my-component'
```

### Creating a New API Route

1. **Create route file:**
```typescript
// app/api/new-endpoint/route.ts
import { NextResponse } from 'next/server'
import { getDataFromDB } from '@/server/queries'

export async function GET(request: Request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const param = searchParams.get('param')

    // Fetch data
    const data = await getDataFromDB(param)

    // Return JSON response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

2. **Add to server/queries.ts if needed:**
```typescript
export async function getDataFromDB(param: string) {
  const client = await getDynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)

  const command = new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'type = :type',
    ExpressionAttributeValues: {
      ':type': 'your-type',
    },
  })

  const result = await docClient.send(command)
  return result.Items
}
```

### Adding a New Page

1. **Create page file:**
```tsx
// app/new-page/page.tsx
import { Metadata } from 'next'
import { MyComponent } from '@/components/my-component'

export const metadata: Metadata = {
  title: 'Page Title | WvW.gg',
  description: 'Page description',
}

export default async function NewPage() {
  // Server-side data fetching (optional)
  const data = await fetchData()

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Page Title</h1>
      <MyComponent data={data} />
    </div>
  )
}
```

2. **Add navigation link (if needed):**
```tsx
// components/navbar.tsx
<Link href="/new-page">New Page</Link>
```

### Deploying Infrastructure Changes

**Deploy to Dev:**
```bash
cd cdk
cdk deploy WvWGG-Dev-DataLayer
cdk deploy WvWGG-Automation
```

**Deploy to Prod:**
```bash
cd cdk
cdk deploy WvWGG-Prod-DataLayer
cdk deploy WvWGG-Automation
```

**Important:**
- Always test in dev first
- Review CloudFormation changeset before confirming
- Monitor logs after deployment
- Verify DynamoDB tables and Lambda functions

## Important Files Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `app/layout.tsx` | Root layout with providers | QueryProvider, ThemeProvider, AuthProvider |
| `server/queries.ts` | DynamoDB query functions | getMatches, getMatchHistory, getWorlds, getGuildById |
| `lib/gw2/api.ts` | GW2 API client | fetchProfessions, fetchSkills, fetchTraits, etc. |
| `lib/game-constants.ts` | WvW mechanics constants | PPT_RATES, VP_DISTRIBUTION, TICK_INTERVAL_MS |
| `lib/auth-context.tsx` | Cognito authentication | AuthContext, useAuth hook |
| `lib/utils.ts` | Shared utilities | cn (className merger) |
| `components/ui/card.tsx` | Base card component | Card, CardHeader, CardTitle, CardContent |
| `middleware.ts` | Request middleware | Prevents caching of guild pages |
| `cdk/lib/wvwgg-stack-simplified.ts` | Infrastructure | DynamoDB, Lambda, EventBridge setup |

## Troubleshooting

### Common Issues

**1. DynamoDB Access Errors**
- Verify AWS credentials are set (OIDC role)
- Check `AWS_ROLE_ARN` and `TABLE_NAME` env vars
- Ensure Vercel OIDC is configured correctly
- Test with `aws sts get-caller-identity`

**2. Build Errors**
- TypeScript errors are ignored in build (`ignoreBuildErrors: true`)
- Check for missing dependencies: `npm install`
- Clear Next.js cache: `rm -rf .next`
- Verify environment variables are set

**3. React Query Issues**
- Check query keys are consistent
- Verify API endpoints are returning correct data
- Use React Query DevTools: `useQueryDevtools()`
- Check browser console for errors

**4. Styling Issues**
- Ensure Tailwind classes are correct
- Check CSS variable definitions in `styles/globals.css`
- Verify component className prop is passed through
- Use browser DevTools to inspect computed styles

**5. Authentication Issues**
- Verify Cognito pool ID and client ID
- Check admin routes have `<ProtectedRoute>` wrapper
- Test Cognito credentials in AWS console
- Check browser cookies and local storage

### Performance Optimization

**Server Components:**
- Fetch data at page level, not in child components
- Use `unstable_cache` for expensive queries
- Set appropriate `revalidate` times

**Client Components:**
- Minimize use of `'use client'`
- Use React.memo for expensive renders
- Implement pagination for large lists
- Lazy load heavy components

**Database Queries:**
- Use GSIs for filtering/sorting
- Implement pagination with LastEvaluatedKey
- Compress large payloads (gzip)
- Cache frequently accessed data

**Bundle Size:**
- Dynamic imports for large libraries
- Tree-shake unused code
- Use bundle analyzer: `npm run build:analyze`
- Optimize images with Next.js Image component

## AWS Infrastructure

### CDK Stack Overview

**WvWGG-{Stage}-DataLayer:**
- DynamoDB table with GSIs
- Lambda functions for data fetching
- IAM roles with least privilege
- CloudWatch log groups

**WvWGG-Automation:**
- EventBridge scheduled rules (every 5 minutes)
- Lambda orchestration
- Guild sync automation
- Error handling and retries

### Lambda Functions

Located in `cdk/lambda/`:

| Function | Schedule | Purpose |
|----------|----------|---------|
| `get-matches.ts` | Every 5 min | Fetch current match data from GW2 API |
| `get-worlds.ts` | Every 24 hrs | Update world population data |
| `get-guilds.ts` | On-demand | Sync guild information |
| `compute-stats.ts` | Every 2 hrs | Calculate prime-time statistics |

**Lambda Patterns:**
- Use shared utilities from `cdk/shared/`
- Implement error handling and retries
- Log to CloudWatch for debugging
- Keep functions small and focused

### Monitoring

**CloudWatch Metrics:**
- Lambda invocation counts
- Lambda error rates
- DynamoDB read/write capacity
- API Gateway request counts

**Logs:**
- Lambda logs: `/aws/lambda/wvwgg-{function}-{stage}`
- DynamoDB streams (if enabled)
- Application logs via Vercel

## Best Practices for AI Assistants

### Code Generation

1. **Always check existing patterns** before creating new code
2. **Use TypeScript interfaces** for all data structures
3. **Follow the established naming conventions**
4. **Include error handling** in all async operations
5. **Add JSDoc comments** for complex functions
6. **Write tests** for new algorithms or complex logic
7. **Use existing components** from `components/ui/` when possible
8. **Leverage React Query** for data fetching
9. **Prefer server components** unless interactivity is needed
10. **Keep bundle size in mind** - use dynamic imports for large dependencies

### Code Review Checklist

Before submitting code, verify:

- [ ] TypeScript compiles without errors
- [ ] Follows naming conventions (PascalCase, camelCase, kebab-case)
- [ ] Imports organized correctly (React → third-party → local)
- [ ] Components use `cn()` for className merging
- [ ] Server/client components used appropriately
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Responsive design considered (mobile-first)
- [ ] Accessibility attributes added (aria-*, role)
- [ ] Tests written (if applicable)
- [ ] Documentation updated (if needed)

### Understanding Game Mechanics

When working with WvW-specific code:

1. **Consult** `lib/game-constants.ts` for all game-related values
2. **Never hardcode** PPT values, VP distributions, or timings
3. **Understand skirmishes** - 2-hour periods that determine VP awards
4. **Know tier bonuses** - PPT increases at specific control thresholds
5. **Respect data types** - Matches have complex nested structures
6. **Consider edge cases** - Ties, incomplete data, API failures

### Working with External APIs

**GW2 API Best Practices:**
- Always handle rate limiting (200 requests per minute)
- Implement fallback logic for API failures
- Cache responses when appropriate
- Validate response schemas
- Handle API version changes gracefully

**Example:**
```typescript
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## Resources

### Documentation

- [Next.js Docs](https://nextjs.org/docs) - Framework documentation
- [React Query Docs](https://tanstack.com/query/latest) - Data fetching
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/docs) - Styling
- [GW2 API Wiki](https://wiki.guildwars2.com/wiki/API) - External API reference
- [AWS CDK Docs](https://docs.aws.amazon.com/cdk/) - Infrastructure

### Internal Documentation

- `HYBRID_ARCHITECTURE.md` - VP solver architecture details
- `HYBRID_SOLVER_IMPLEMENTATION.md` - Solver implementation guide
- `FEATURES_COMPLETE.md` - Completed features list
- `IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `optimizer.md` - Build optimizer documentation
- `TODO.md` - Project roadmap and tasks

### Key External APIs

**Guild Wars 2 API:**
- Base URL: `https://api.guildwars2.com/v2/`
- No authentication required for public endpoints
- Rate limit: 200 requests/minute
- Documentation: https://wiki.guildwars2.com/wiki/API:2

**Endpoints Used:**
- `/v2/wvw/matches` - Current match data
- `/v2/worlds` - World information
- `/v2/guild/:id` - Guild details
- `/v2/professions` - Character professions
- `/v2/skills` - Skill database
- `/v2/traits` - Trait database
- `/v2/items` - Item database
- `/v2/itemstats` - Stat combinations

## Version Information

- **Next.js:** 16.0.3 (App Router)
- **React:** 19.2.0
- **TypeScript:** 5.x
- **Node.js:** 22.x (Lambda runtime)
- **Tailwind CSS:** 4.1.9
- **React Query:** 5.90.10
- **Vitest:** 4.0.10

Last Updated: 2025-11-21
