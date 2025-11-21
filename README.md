# WvW.gg - Guild Wars 2 World vs. World Analytics Platform

A comprehensive analytics and planning platform for Guild Wars 2's World vs. World (WvW) competitive game mode. This application provides real-time match analysis, performance metrics, scenario planning, and build optimization to help guilds and players make data-driven strategic decisions.

## 🎯 Overview

**WvW.gg** helps competitive WvW players and guilds:
- **Analyze Matches**: Track live match progress, PPT (Points Per Tick), and Victory Point trends
- **Predict Outcomes**: Use Monte Carlo simulations to forecast match results with confidence intervals
- **Plan Scenarios**: Calculate VP requirements for desired placements and skirmish outcomes
- **Optimize Builds**: Create and optimize character builds with stat calculators
- **Track Performance**: Monitor prime time performance across different regions (NA, EU, OCX, SEA)
- **Manage Guilds**: Associate guilds with worlds and track alliance relationships

## 🏗️ Architecture

### High-Level System Design

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  GW2 API v2     │─────>│  AWS Lambda      │─────>│   DynamoDB      │
│  (Official)     │      │  (Data Fetchers) │      │  (Match Data)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                             │
                                                             │
                         ┌───────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Next.js Frontend    │
              │  (Vercel)            │
              │  - Match Dashboard   │
              │  - VP Planner        │
              │  - Build Editor      │
              │  - Guild Management  │
              └──────────────────────┘
```

### Deployment

- **Frontend**: Next.js 16 deployed on Vercel with ISR (Incremental Static Regeneration)
- **Backend**: AWS Lambda functions triggered by EventBridge (cron)
- **Database**: DynamoDB with TTL for historical data retention
- **CDN**: Vercel Edge Network + CloudFront for static assets
- **Infrastructure**: AWS CDK (TypeScript)

### Data Flow

1. **Data Collection**: Lambda functions fetch match data from GW2 API every 60 seconds
2. **Snapshot Creation**: 15-minute snapshots stored in DynamoDB for historical analysis
3. **Real-time Updates**: Frontend polls API routes for live objective counts and PPT
4. **Analysis**: Client-side algorithms process data for predictions and scenario planning

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm or pnpm
- AWS Account (for backend deployment)
- AWS CLI configured (for CDK deployment)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wvwgg-vibecoded
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Configure required variables:
   - `AWS_REGION`: AWS region for DynamoDB (e.g., `us-east-1`)
   - `AWS_ACCESS_KEY_ID`: AWS access key
   - `AWS_SECRET_ACCESS_KEY`: AWS secret key
   - `DYNAMODB_TABLE_MATCHES`: DynamoDB table name for matches
   - `DYNAMODB_TABLE_WORLDS`: DynamoDB table name for worlds
   - `DYNAMODB_TABLE_GUILDS`: DynamoDB table name for guilds

4. **Run development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run tests**
   ```bash
   npm test           # Run tests in watch mode
   npm run test:ui    # Run tests with UI
   npm run test:coverage  # Generate coverage report
   ```

### Backend Deployment

1. **Navigate to CDK directory**
   ```bash
   cd cdk
   npm install
   ```

2. **Bootstrap CDK (first time only)**
   ```bash
   npx cdk bootstrap
   ```

3. **Deploy infrastructure**
   ```bash
   npx cdk deploy --all
   ```

   This deploys:
   - DynamoDB tables (matches, worlds, guilds)
   - Lambda functions (match fetcher, world sync, guild sync)
   - EventBridge rules (cron schedules)
   - IAM roles and policies

## 📁 Project Structure

```
wvwgg-vibecoded/
├── app/                      # Next.js App Router
│   ├── api/                  # API route handlers (19 routes)
│   │   ├── worlds/          # World data endpoints
│   │   ├── objectives/      # Live objective counts
│   │   ├── history/         # Historical match data
│   │   ├── admin/           # Guild management
│   │   └── gw2/             # GW2 API proxies
│   ├── matches/             # Match list and detail pages
│   ├── builds/              # Build editor
│   ├── admin/               # Admin dashboard
│   ├── guilds/              # Guild pages
│   └── maps/                # Interactive map view
│
├── components/              # React components (97 files)
│   ├── ui/                  # Radix UI styled components
│   ├── admin/               # Admin-specific components
│   ├── build-editor/        # Build editor components
│   ├── match-dashboard.tsx  # Main match analysis view
│   ├── interactive-vp-planner.tsx  # VP scenario planner
│   ├── vp-probability-analysis.tsx # Monte Carlo visualizations
│   └── ...                  # Other feature components
│
├── lib/                     # Core business logic
│   ├── gw2/                 # GW2 API integration
│   │   ├── api.ts           # API client with caching
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── build-calculator.ts  # Stat calculations
│   │   └── gear-optimizer.ts    # Gear optimization
│   ├── game-constants.ts    # Game mechanics values
│   ├── ppt-calculator.ts    # Points Per Tick calculations
│   ├── vp-tiers.ts          # Victory Point tier logic
│   ├── monte-carlo-simulator.ts  # Outcome predictions
│   ├── historical-performance.ts # Past performance analysis
│   ├── vp-scenario-solver-greedy.ts  # VP scenario solver
│   ├── vp-scenario-solver-dfs.ts     # DFS optimization
│   └── vp-scenario-solver-random.ts  # Random search hybrid
│
├── server/                  # Server-side utilities
│   ├── queries.ts           # DynamoDB query functions
│   └── aws-credentials.ts   # AWS SDK configuration
│
├── cdk/                     # AWS CDK infrastructure
│   ├── lib/                 # Stack definitions
│   ├── lambda/              # Lambda function handlers
│   │   ├── get-matches.ts   # Match data fetcher (60s interval)
│   │   ├── get-worlds.ts    # World cache (24h interval)
│   │   └── get-wvw-guilds.ts # Guild synchronization
│   └── shared/              # Shared utilities
│
├── docs/                    # Documentation
│   ├── HYBRID_ARCHITECTURE.md      # System architecture
│   ├── snapshot-architecture.md    # Data collection design
│   ├── build-editor-plan.md        # Build editor specs
│   ├── vp-scenario-algorithm.md    # VP solver algorithm
│   └── vp-probability-analysis.md  # Monte Carlo details
│
├── __tests__/               # Test files
├── hooks/                   # React hooks
├── styles/                  # Global CSS
├── public/                  # Static assets
└── middleware.ts            # Next.js middleware (caching)
```

## 🔧 Technology Stack

### Frontend
- **Framework**: Next.js 16.0.3 (React 19.2.0)
- **Styling**: Tailwind CSS 4.1.9, PostCSS
- **UI Library**: Radix UI (100+ components)
- **Forms**: React Hook Form 7.60.0, Zod 3.25.76
- **Data Fetching**: TanStack React Query 5.90.10
- **Charts**: Recharts 2.15.4
- **Maps**: Leaflet 1.9.4, React Leaflet 5.0.0
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js (AWS Lambda)
- **AWS Services**:
  - DynamoDB (NoSQL database)
  - Lambda (serverless compute)
  - EventBridge (scheduling)
  - Step Functions (orchestration)
- **Infrastructure**: AWS CDK (TypeScript)

### Third-Party APIs
- **Guild Wars 2 API v2**: https://api.guildwars2.com/v2
  - Endpoints: `/worlds`, `/matches`, `/objectives`, `/guilds`, `/items`, `/skills`, `/traits`

### Optimization & Algorithms
- **MILP Solver**: glpk.js (WASM-based)
- **Custom Algorithms**: DFS solver, Greedy solver, Random hybrid, Monte Carlo simulation

### Development Tools
- **Testing**: Vitest 4.0.10
- **Linting**: ESLint
- **TypeScript**: 5.x (strict mode)
- **Package Manager**: npm/pnpm

## 📊 Key Features

### 1. Live Match Tracking
- Real-time match data from GW2 API
- Auto-refresh with configurable intervals
- PPT (Points Per Tick) calculations
- Objective counts (castles, keeps, towers, camps)
- K/D ratios and activity metrics

**Key Files**:
- `components/match-dashboard.tsx`
- `lib/ppt-calculator.ts`
- `app/api/objectives/[matchId]/route.ts`

### 2. Victory Point (VP) Scenario Planning
- Interactive planner with undo/redo
- Calculates VP requirements for desired placements
- Supports skirmish-by-skirmish planning
- Visual feedback on achievability

**Key Files**:
- `components/interactive-vp-planner.tsx`
- `lib/vp-scenario-solver-greedy.ts`
- `lib/vp-scenario-solver-dfs.ts`

### 3. Match Outcome Predictions
- Monte Carlo simulation (10,000+ iterations)
- Confidence intervals for predictions
- Historical performance analysis
- Placement probability calculations

**Key Files**:
- `components/vp-probability-analysis.tsx`
- `lib/monte-carlo-simulator.ts`
- `lib/historical-performance.ts`

### 4. Prime Time Analysis
- Performance tracking across regions (NA, EU, OCX, SEA)
- VP gains during prime time windows
- Off-hours performance comparison

**Key Files**:
- `components/prime-time-performance.tsx`
- `lib/prime-time-windows.ts`
- `lib/prime-time-stats.ts`

### 5. Build Editor & Optimizer
- Character stat calculator (Effective Power, Effective Health, DPS)
- Gear optimization for specific goals
- Trait and skill integration
- GW2 API data integration

**Key Files**:
- `app/builds/page.tsx`
- `lib/gw2/build-calculator.ts`
- `lib/gw2/gear-optimizer.ts`

### 6. Guild Management
- Guild-world associations
- Alliance relationship tracking
- Guild verification system
- Admin dashboard for CRUD operations

**Key Files**:
- `app/admin/page.tsx`
- `components/admin/guilds-list.tsx`
- `app/api/admin/guilds/route.ts`

## 🔌 API Routes

All API routes follow REST conventions and return JSON responses.

### Match Data
- `GET /api/worlds` - List all world names and IDs
- `GET /api/objectives/[matchId]` - Live objective counts for a match
- `GET /api/history/[matchId]` - Historical snapshots (7-day window)
- `GET /api/match-history` - List all available historical matches

### Guild Management
- `GET /api/admin/guilds` - List guild associations
- `POST /api/admin/guilds` - Create guild association
- `PUT /api/admin/guilds/[guildId]` - Update guild
- `DELETE /api/admin/guilds/[guildId]` - Delete guild
- `POST /api/guilds/verify-ownership` - Verify guild ownership

### GW2 Data Proxies
- `GET /api/gw2/professions` - Character professions
- `GET /api/gw2/professions/[id]` - Profession details
- `GET /api/gw2/skills` - Skill definitions
- `GET /api/gw2/traits` - Trait definitions
- `GET /api/gw2/itemstats` - Gear stat combinations

### Admin
- `POST /api/revalidate` - Trigger ISR cache revalidation

See `docs/API_REFERENCE.md` for detailed request/response schemas (to be created).

## 🧮 Core Algorithms

### PPT Calculator (`lib/ppt-calculator.ts`)
Calculates Points Per Tick based on objective ownership:
- Castles: 12 PPT
- Keeps: 8 PPT (10 with guild upgrades)
- Towers: 4 PPT (6 with guild upgrades)
- Camps: 2 PPT

### VP Tier System (`lib/vp-tiers.ts`)
Determines Victory Point awards based on:
- Skirmish number (2h intervals)
- Region (NA, EU, both)
- PPT placement (1st, 2nd, 3rd)

### Monte Carlo Simulator (`lib/monte-carlo-simulator.ts`)
Predicts match outcomes using:
- Historical skirmish performance
- Placement probabilities
- VP tier calculations
- 10,000+ simulation runs

### VP Scenario Solvers
Three solving strategies:
1. **Greedy** (`vp-scenario-solver-greedy.ts`): Fast heuristic approach
2. **DFS** (`vp-scenario-solver-dfs.ts`): Deterministic exhaustive search with branch & bound
3. **Random Hybrid** (`vp-scenario-solver-random.ts`): Random search with local optimization

See `docs/vp-scenario-algorithm.md` for detailed algorithm explanations.

## 📚 Documentation

- **Architecture**: `docs/HYBRID_ARCHITECTURE.md` - System design and AWS setup
- **Snapshots**: `docs/snapshot-architecture.md` - Historical data collection
- **Build Editor**: `docs/build-editor-plan.md` - Build editor specifications
- **VP Scenarios**: `docs/vp-scenario-algorithm.md` - VP solver algorithms
- **Monte Carlo**: `docs/vp-probability-analysis.md` - Prediction methodology
- **Features**: `docs/FEATURES_COMPLETE.md` - Feature list and status
- **Testing**: `docs/README.test.md` - Testing guide

## 🧪 Testing

Run the test suite:
```bash
npm test              # Watch mode
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
```

Test files:
- `__tests__/vp-scenario-solver.test.ts` - VP solver tests
- `__tests__/game-constants.test.ts` - Game mechanics validation

Coverage goal: 80%+ for core business logic in `/lib/`

## 🔐 Environment Variables

Create `.env.local` with:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# DynamoDB Tables
DYNAMODB_TABLE_MATCHES=wvwgg-matches
DYNAMODB_TABLE_WORLDS=wvwgg-worlds
DYNAMODB_TABLE_GUILDS=wvwgg-guilds

# Optional: AWS Cognito (for admin auth)
NEXT_PUBLIC_USER_POOL_ID=your_pool_id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your_client_id
```

## 🤝 Contributing

### Development Workflow
1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and add tests
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Commit with descriptive messages
6. Push and create a pull request

### Commit Conventions
Follow conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation updates
- `refactor:` Code refactoring
- `test:` Test additions/updates
- `chore:` Maintenance tasks

### Code Style
- TypeScript strict mode enforced
- ESLint configuration in `.eslintrc.json`
- Prettier for formatting
- Tailwind CSS for styling (no inline styles)

## 📈 Performance Optimization

- **ISR**: Pages revalidated every 60 seconds for fresh data
- **React Query**: Aggressive caching with stale-while-revalidate
- **Code Splitting**: Dynamic imports for heavy components
- **Bundle Analysis**: Run `npm run build:analyze` to inspect bundle size
- **Lazy Loading**: Maps and charts loaded on-demand

## 🐛 Known Issues

See `TODO.md` for current issues and planned features.

## 📄 License

[License information to be added]

## 🙏 Acknowledgments

- **ArenaNet** for the Guild Wars 2 API
- **WvW Community** for feedback and feature requests
- **Contributors** for bug reports and improvements

## 📞 Support

For issues and feature requests:
- GitHub Issues: [Create an issue]
- Discord: [Community server link]
- Email: [Support email]

---

**Built with ❤️ for the Guild Wars 2 WvW community**
