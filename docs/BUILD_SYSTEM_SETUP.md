# Build System Database Setup - Summary

This document summarizes the database schema design for the bidirectional build editor with propagator networks.

## What We've Created

### 1. Database Schema Documentation
**File**: `docs/BUILD_DATABASE_SCHEMA.md`

Complete specification for 5 new entity types:
- **itemstat**: Stat combinations (Berserker, Marauder, etc.)
- **enhanced-item**: Items with modifiers (runes, sigils, infusions, food)
- **stat-modifier**: Individual stat modifications from gear
- **stat-formula**: Stat formulas with bidirectional support
- **game-version**: Version tracking for balance patches

### 2. TypeScript Type Definitions
**File**: `lib/gw2/build-data-types.ts`

Complete TypeScript interfaces for:
- All 5 entity types
- Query results
- Sync operations
- Balance patch application
- Helper types

### 3. DynamoDB GSIs (Global Secondary Indexes)
**File**: `cdk/lib/wvwgg-stack-simplified.ts`

Added 3 new GSIs to support build system queries:
- `gameVersion-validFrom-index`: Version tracking
- `itemCategory-gameVersion-index`: Item categorization (all runes, all sigils, etc.)
- `sourceType-sourceId-index`: Modifier source lookup

## Database Design Highlights

### Single Table Design
All new entities use your existing `wvwgg-{stage}` table:
- **Partition Key**: `type` (STRING)
- **Sort Key**: `id` (STRING)

No new tables required! ✅

### Entity Structure

```
wvwgg-dev
├─ type: "itemstat" (150 items, ~75 KB)
│  └─ Berserker, Marauder, Assassin, etc.
│
├─ type: "enhanced-item" (~450 items, ~580 KB)
│  ├─ Runes (80 items)
│  ├─ Sigils (120 items)
│  ├─ Infusions (50 items)
│  └─ Food/Utility (200 items)
│
├─ type: "stat-modifier" (~1000 items, ~800 KB)
│  ├─ Flat bonuses (+25 Power)
│  ├─ Percentage bonuses (+10% Might Duration)
│  ├─ Formulas (Gain X equal to 13% of Y)
│  └─ Conditional (while health > 90%)
│
├─ type: "stat-formula" (~20 items, ~30 KB)
│  ├─ Critical Chance
│  ├─ Critical Damage
│  ├─ Effective Power
│  └─ etc.
│
└─ type: "game-version" (~50 items, ~100 KB)
   └─ Tracks balance patches
```

**Total Size**: ~1.6 MB
**Monthly Cost**: ~$0.23/month (storage + reads + writes)

### Key Features

#### 1. Bidirectional Support
Every formula has both forward and inverse functions:
```typescript
// Critical Chance Formula
{
  "baseFormula": "(precision - 895) / 21",
  "bidirectionalFormulas": {
    "forward": "(precision - 895) / 21",      // precision → critChance
    "inverse": ["critChance * 21 + 895"]      // critChance → precision
  }
}
```

#### 2. Modifier Extraction
All stat bonuses automatically extracted from GW2 API:
```typescript
// Superior Rune of the Scholar
{
  "bonuses": [
    "+25 Power",        → flat modifier
    "+50 Power",        → flat modifier
    "+100 Power",       → flat modifier
    "+5% damage >=90%"  → conditional modifier
  ]
}
```

#### 3. Version Management
Balance patches update formulas without breaking history:
```typescript
// When ArenaNet changes critical damage formula
{
  "type": "game-version",
  "changes": [{
    "type": "modify-formula",
    "formulaId": "formula-critDamage",
    "technicalDetails": "Changed ferocity coefficient from 1500 to 1600"
  }]
}

// Old formula marked invalid
{
  "id": "formula-critDamage",
  "baseFormula": "1.5 + (ferocity / 1500)",
  "validUntil": "2025-02-15"  // ← marked as invalid
}

// New formula created
{
  "id": "formula-critDamage-2025-02-15",
  "baseFormula": "1.5 + (ferocity / 1600)",  // ← new coefficient
  "validFrom": "2025-02-15"
}
```

#### 4. Efficient Queries
3 new GSIs enable fast lookups:

```typescript
// Get all runes
const runes = await query({
  IndexName: 'itemCategory-gameVersion-index',
  KeyConditionExpression: 'itemCategory = :category',
  ExpressionAttributeValues: { ':category': 'rune' }
});

// Get all modifiers from Scholar Rune
const modifiers = await query({
  IndexName: 'sourceType-sourceId-index',
  KeyConditionExpression: 'sourceType = :type AND sourceId = :id',
  ExpressionAttributeValues: { ':type': 'rune', ':id': '24836' }
});

// Get active formulas for game version
const formulas = await query({
  IndexName: 'gameVersion-validFrom-index',
  KeyConditionExpression: 'gameVersion = :version',
  ExpressionAttributeValues: { ':version': '2025-01-22' }
});
```

## Data Flow

### Initial Setup
```
GW2 API
  ↓
sync-game-data Lambda (to be created)
  ↓
Extract modifiers from items/traits
  ↓
Store in DynamoDB (wvwgg-{stage})
  ↓
Ready for propagator network!
```

### Balance Patch Update
```
Admin Dashboard
  ↓
POST /api/admin/balance-patch
  ↓
apply-balance-patch Lambda (to be created)
  ↓
Update formulas/modifiers with versioning
  ↓
Invalidate build cache
  ↓
Users see updated stats automatically!
```

## What This Enables

### ✅ Forward Mode: Gear → Stats
```typescript
// User selects gear
network.setGear('helm', BERSERKER_STAT_ID)
network.setGear('coat', BERSERKER_STAT_ID)
// ... set all gear

// Solve
const solution = await network.solve()
console.log(solution.stats)
// { power: 3045, precision: 2340, critChance: 68.8%, ... }
```

### ✅ Backward Mode: Stats → Gear
```typescript
// User sets target stats
network.setTargetStat('critChance', 100)  // Want 100% crit
network.setTargetStat('health', { min: 20000 })  // At least 20k health

// Solve
const solution = await network.solve()
console.log(solution.gear)
// { helm: { statId: BERSERKER_ID }, coat: { statId: MARAUDER_ID }, ... }
console.log(`Found ${solution.possibilities} builds`)
// "Found 127 possible builds"
```

### ✅ Partial Mode: Mixed
```typescript
// User fixes some gear + sets some stats
network.setGear('helm', BERSERKER_STAT_ID)  // Fixed
network.setGear('coat', BERSERKER_STAT_ID)  // Fixed
network.setTargetStat('critChance', 100)     // Target

// Solve - fills in the rest!
const solution = await network.solve()
console.log(solution.gear)
// {
//   helm: { statId: BERSERKER_ID },      // Fixed
//   coat: { statId: BERSERKER_ID },      // Fixed
//   gloves: { statId: ASSASSIN_ID },     // Computed!
//   leggings: { statId: ASSASSIN_ID },   // Computed!
//   ...
// }
```

## Next Steps

### Phase 1: Deploy Infrastructure (Ready!)
The CDK stack is updated and ready to deploy:

```bash
cd cdk
cdk deploy WvWGG-Dev-DataLayer
```

This will add the 3 new GSIs to your DynamoDB table.

### Phase 2: Data Sync (To Be Created)
Create Lambda function to populate database:

**File to create**: `cdk/lambda/sync-game-data.ts`

Tasks:
1. Fetch all itemstats from GW2 API
2. Fetch all items (runes, sigils, infusions, food)
3. Extract modifiers from item bonuses
4. Create stat formulas
5. Store in DynamoDB

**Estimated Time**: 1-2 days

### Phase 3: Query Layer (To Be Created)
Create server-side query functions:

**File to create**: `server/build-queries.ts`

Functions:
- `getItemStats()`: Get all stat combinations
- `getItemsByCategory(category)`: Get all runes, sigils, etc.
- `getModifiersBySource(sourceType, sourceId)`: Get modifiers for an item
- `getActiveFormulas()`: Get current formulas
- `getGameVersion(version)`: Get version info

**Estimated Time**: 2-3 days

### Phase 4: Propagator Engine (From Main Plan)
Implement the core propagator network (see main implementation plan)

**Estimated Time**: 1-2 weeks

## Files Created

1. ✅ `docs/BUILD_DATABASE_SCHEMA.md` - Complete schema specification (30 pages)
2. ✅ `lib/gw2/build-data-types.ts` - TypeScript interfaces
3. ✅ `cdk/lib/wvwgg-stack-simplified.ts` - Updated with new GSIs
4. ✅ `docs/BUILD_SYSTEM_SETUP.md` - This summary document

## Files to Create (Next Phase)

1. ⏳ `cdk/lambda/sync-game-data.ts` - Data sync Lambda
2. ⏳ `server/build-queries.ts` - Query functions
3. ⏳ `lib/propagators/engine.ts` - Core propagator engine (see main plan)
4. ⏳ `lib/propagators/gw2-propagators.ts` - GW2-specific propagators
5. ⏳ `lib/propagators/build-network.ts` - Build network setup

## Example Usage (Once Built)

```typescript
import { BuildPropagatorNetwork } from '@/lib/propagators/build-network'

// Initialize network
const network = new BuildPropagatorNetwork(
  'Warrior',
  itemStatsMap,    // From getItemStats()
  modifiers        // From getModifiersBySource()
)

// Bidirectional editing!
network.setGear('helm', BERSERKER_ID)       // Forward
network.setTargetStat('critChance', 100)    // Backward

// Solve
const solution = await network.solve()

// Show results
console.log('Gear:', solution.gear)
console.log('Stats:', solution.stats)
console.log('Possibilities:', solution.possibilities)
```

## Storage & Cost Summary

| Resource | Size | Monthly Cost |
|----------|------|--------------|
| Storage | 1.6 MB | $0.0004 |
| Reads (100K builds/month) | 700K RRUs | $0.175 |
| Writes (daily sync) | ~1500/day | $0.05 |
| **TOTAL** | | **~$0.23/month** |

---

## Questions?

- **Schema Details**: See `docs/BUILD_DATABASE_SCHEMA.md`
- **Type Definitions**: See `lib/gw2/build-data-types.ts`
- **Main Implementation Plan**: See earlier conversation (propagator network design)

Ready to proceed with data sync implementation!
