# Build System Database Schema

This document describes the enhanced database schema for the bidirectional build system with propagator networks.

## Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Entity Types](#entity-types)
- [GSI Strategy](#gsi-strategy)
- [Data Sync Pipeline](#data-sync-pipeline)
- [Version Management](#version-management)
- [Query Patterns](#query-patterns)

---

## Overview

The build system database extends the existing `wvwgg-{stage}` DynamoDB table with new entity types for:
- Enhanced GW2 item data (gear, runes, sigils, infusions)
- Stat modifiers (from traits, gear upgrades, food)
- Stat formulas (with bidirectional propagator support)
- Game version tracking (for balance patches)

### Key Goals

1. **Bidirectional Editing**: Support both gear→stats and stats→gear workflows
2. **Easy Updates**: Isolate game data changes for quick balance patch application
3. **Modifier Tracking**: Track all sources of stat modifications (traits, runes, sigils)
4. **Version Safety**: Maintain historical formulas when game mechanics change

---

## Design Principles

### 1. Single Table Design (Extends Existing)

Uses the existing `wvwgg-{stage}` table structure:
- **Partition Key**: `type` (STRING)
- **Sort Key**: `id` (STRING)
- **New Entity Types**: `itemstat`, `enhanced-item`, `stat-modifier`, `stat-formula`, `game-version`

### 2. GW2 API as Source of Truth

- All base data comes from GW2 API
- Enhancements stored separately, versioned independently
- Fallback to API if database unavailable

### 3. Version Tracking

- Every formula and modifier has a `gameVersion` field
- Historical versions preserved for data integrity
- Active version determined by `validFrom`/`validUntil` dates

### 4. Compression for Large Datasets

- Item lists compressed with gzip (similar to match snapshots)
- Individual items stored uncompressed for fast access

---

## Entity Types

### 1. Item Stats (`type: "itemstat"`)

Stores stat combinations (Berserker, Marauder, etc.) with attribute multipliers.

**Access Pattern**:
- `GetItem` for single stat: `type="itemstat"`, `id="{statId}"`
- `Query` for all stats: `type="itemstat"`

**Schema**:
```typescript
{
  type: "itemstat",
  id: string,                    // ItemStat ID as string (e.g., "1163")

  // GW2 API Data
  name: string,                  // "Berserker", "Marauder", etc.
  attributes: Array<{
    attribute: AttributeType,    // "Power", "Precision", "Ferocity"
    multiplier: number,          // Stat distribution (e.g., 0.35, 0.25, 0.25)
    value: number                // Base value for ascended (e.g., 63, 45, 45)
  }>,

  // Metadata
  lastGW2Sync: number,           // Unix timestamp (ms)
  gameVersion: string,           // "2025-01-22"

  // For searching/filtering
  isPvE: boolean,                // Available in PvE
  isPvP: boolean,                // Available in PvP
  isWvW: boolean,                // Available in WvW

  // Enhancement data
  aliases?: string[],            // ["Zerk", "Zerker"] for Berserker
  description?: string,          // Custom description
  buildTypes?: string[],         // ["power-dps", "hybrid"]
  metaRating?: number,           // 1-5, current meta relevance
}
```

**Example**:
```json
{
  "type": "itemstat",
  "id": "1163",
  "name": "Berserker",
  "attributes": [
    { "attribute": "Power", "multiplier": 0.35, "value": 63 },
    { "attribute": "Precision", "multiplier": 0.25, "value": 45 },
    { "attribute": "Ferocity", "multiplier": 0.25, "value": 45 }
  ],
  "lastGW2Sync": 1737590400000,
  "gameVersion": "2025-01-22",
  "isPvE": true,
  "isPvP": true,
  "isWvW": true,
  "aliases": ["Zerk", "Zerker"],
  "buildTypes": ["power-dps"],
  "metaRating": 5
}
```

---

### 2. Enhanced Items (`type: "enhanced-item"`)

Stores items (gear, runes, sigils, infusions) with enhancement data.

**Access Pattern**:
- `GetItem` for single item: `type="enhanced-item"`, `id="{itemId}"`
- `Query` all by category using GSI: `itemCategory-gameVersion-index`

**Schema**:
```typescript
{
  type: "enhanced-item",
  id: string,                    // Item ID as string (e.g., "80131")

  // GW2 API Data (raw)
  gw2Data: {
    id: number,
    name: string,
    icon: string,
    description?: string,
    type: ItemType,              // "Armor", "Weapon", "UpgradeComponent"
    rarity: ItemRarity,
    level: number,
    details?: ItemDetails,       // Type-specific details
    flags: string[],
    game_types: string[],
  },

  // Categorization
  itemCategory: string,          // "armor", "weapon", "rune", "sigil", "infusion", "food", "utility"
  itemSlot?: string,             // "helm", "coat", "greatsword", etc.
  weightClass?: string,          // "Heavy", "Medium", "Light" (for armor)

  // Stat Modifiers (extracted from bonuses)
  modifiers: string[],           // Array of modifier IDs (references stat-modifier entities)

  // Enhancement Data
  tooltipEnhancement?: {
    customDescription?: string,
    statBreakdown?: Array<{
      stat: string,
      value: number,
      source: string,
    }>,
    buildTips?: string[],
    synergies?: string[],        // Other item IDs that synergize
  },

  // Relationships
  relationships?: Array<{
    type: "requires" | "conflicts" | "synergizes" | "component_of",
    targetItemId: number,
    reason: string,
  }>,

  // Metadata
  lastGW2Sync: number,           // Unix timestamp (ms)
  gameVersion: string,           // "2025-01-22"

  // For filtering in propagator network
  statTypes: string[],           // ["Power", "Precision", "Ferocity"]
  maxStatValue?: number,         // Highest single stat value (for sorting)
}
```

**Example (Rune)**:
```json
{
  "type": "enhanced-item",
  "id": "24836",
  "gw2Data": {
    "id": 24836,
    "name": "Superior Rune of the Scholar",
    "icon": "https://render.guildwars2.com/...",
    "type": "UpgradeComponent",
    "rarity": "Exotic",
    "level": 60,
    "details": {
      "type": "Rune",
      "bonuses": [
        "+25 Power",
        "+10% Might Duration",
        "+50 Power",
        "+10% Might Duration",
        "+100 Power",
        "+5% damage while health >=90%"
      ]
    }
  },
  "itemCategory": "rune",
  "modifiers": [
    "mod-rune-24836-power-1",
    "mod-rune-24836-power-3",
    "mod-rune-24836-power-5",
    "mod-rune-24836-might-2",
    "mod-rune-24836-might-4",
    "mod-rune-24836-damage-6"
  ],
  "tooltipEnhancement": {
    "buildTips": [
      "Best for power DPS builds",
      "Maintain high health for 6-piece bonus"
    ],
    "synergies": ["24868"]
  },
  "lastGW2Sync": 1737590400000,
  "gameVersion": "2025-01-22",
  "statTypes": ["Power"],
  "maxStatValue": 175
}
```

---

### 3. Stat Modifiers (`type: "stat-modifier"`)

Stores individual stat modifications from items, traits, food, etc.

**Access Pattern**:
- `GetItem` for single modifier: `type="stat-modifier"`, `id="{modifierId}"`
- `Query` by source using GSI: `sourceType-sourceId-index`

**Schema**:
```typescript
{
  type: "stat-modifier",
  id: string,                    // Unique modifier ID (e.g., "mod-rune-24836-power-1")

  // Source Information
  sourceType: "rune" | "sigil" | "trait" | "food" | "utility" | "infusion" | "relic",
  sourceId: string,              // Item ID or Trait ID (as string)
  sourceName: string,            // Human-readable (e.g., "Superior Rune of the Scholar")

  // Modifier Details
  targetStat: string,            // "power", "precision", "critChance", "effectivePower", etc.
  modifierType: "flat" | "percentage" | "formula" | "conditional",

  // Values
  flatValue?: number,            // For flat modifiers: +175 Power
  percentValue?: number,         // For percentage: +10% (stored as 10, not 0.10)
  formula?: string,              // For complex: "ferocity * 0.13"

  // Conditions (for conditional modifiers)
  conditions?: Array<{
    type: "health" | "distance" | "boon" | "time" | "weapon" | "enemy_condition",
    operator: ">" | "<" | "==" | ">=" | "<=",
    value: any,
    description: string,         // "Health above 90%"
  }>,

  // Stacking Behavior
  stackable: boolean,            // Can it stack with itself?
  maxStacks?: number,            // Max stacks if stackable
  stackType?: "intensity" | "duration",
  uniqueGroup?: string,          // Conflicts with other modifiers in same group

  // For Runes: Piece Count Requirement
  runeCount?: number,            // 1-6 for rune bonuses

  // Display
  displayText: string,           // "+25 Power" or "10% Might Duration"
  icon?: string,
  sortOrder?: number,            // For display ordering

  // Version Tracking
  gameVersion: string,           // "2025-01-22"
  validFrom: string,             // "2025-01-22"
  validUntil?: string,           // "2025-03-15" (when it was changed/removed)

  // Metadata
  tags?: string[],               // ["power", "dps", "scholar"]
  isMeta?: boolean,              // Commonly used in meta builds
}
```

**Examples**:

```json
// Flat Power Bonus from Rune
{
  "type": "stat-modifier",
  "id": "mod-rune-24836-power-1",
  "sourceType": "rune",
  "sourceId": "24836",
  "sourceName": "Superior Rune of the Scholar",
  "targetStat": "power",
  "modifierType": "flat",
  "flatValue": 25,
  "runeCount": 1,
  "displayText": "+25 Power",
  "stackable": false,
  "gameVersion": "2025-01-22",
  "validFrom": "2020-01-01",
  "tags": ["power", "dps"]
}

// Conditional Damage Bonus
{
  "type": "stat-modifier",
  "id": "mod-rune-24836-damage-6",
  "sourceType": "rune",
  "sourceId": "24836",
  "sourceName": "Superior Rune of the Scholar",
  "targetStat": "damageMultiplier",
  "modifierType": "conditional",
  "percentValue": 5,
  "conditions": [{
    "type": "health",
    "operator": ">=",
    "value": 90,
    "description": "Health above 90%"
  }],
  "runeCount": 6,
  "displayText": "+5% damage (health >=90%)",
  "stackable": false,
  "gameVersion": "2025-01-22",
  "validFrom": "2020-01-01",
  "tags": ["damage", "conditional"],
  "isMeta": true
}

// Trait Formula Modifier
{
  "type": "stat-modifier",
  "id": "mod-trait-2049-precision",
  "sourceType": "trait",
  "sourceId": "2049",
  "sourceName": "Berserker's Power",
  "targetStat": "precision",
  "modifierType": "formula",
  "formula": "ferocity * 0.13",
  "displayText": "Gain Precision equal to 13% of your Ferocity",
  "stackable": false,
  "gameVersion": "2025-01-22",
  "validFrom": "2022-06-15",
  "tags": ["precision", "ferocity", "warrior"],
  "isMeta": true
}
```

---

### 4. Stat Formulas (`type: "stat-formula"`)

Stores formulas for derived stats with version history.

**Access Pattern**:
- `GetItem` for current formula: `type="stat-formula"`, `id="formula-{stat}"`
- `Query` all formulas: `type="stat-formula"`
- Version query using GSI: `gameVersion-index`

**Schema**:
```typescript
{
  type: "stat-formula",
  id: string,                    // "formula-critChance", "formula-effectivePower"

  // Formula Identification
  stat: string,                  // "critChance", "critDamage", "effectivePower"
  category: "derived" | "effective" | "base",

  // Formula Definition
  baseFormula: string,           // "(precision - 895) / 21"
  bidirectionalFormulas?: {      // For propagator support
    forward: string,             // "precision -> critChance"
    inverse: string[],           // ["critChance -> precision"]
  },

  // JavaScript Implementation
  forwardFunction: string,       // Serialized function for evaluation
  inverseFunctions?: string[],   // Serialized inverse functions

  // Dependencies
  inputStats: string[],          // ["precision"]
  affectedBy: string[],          // Modifier IDs that can affect this stat

  // Display
  displayFormula: string,        // "Critical Chance = (Precision - 895) / 21"
  displayName: string,           // "Critical Chance"
  explanation: string,           // "Each point of Precision above 895..."
  unit?: string,                 // "%" for percentages

  // Constraints
  minValue?: number,             // 0 for crit chance
  maxValue?: number,             // 100 for crit chance

  // Version Tracking
  gameVersion: string,           // "2025-01-22"
  validFrom: string,             // "2020-01-01"
  validUntil?: string,           // "2025-03-15" (when formula changed)
  changelog?: string,            // "Changed coefficient from 21 to 22"

  // Metadata
  tags?: string[],               // ["combat", "offensive"]
  importance?: number,           // 1-5, how important for builds
}
```

**Examples**:

```json
// Critical Chance Formula
{
  "type": "stat-formula",
  "id": "formula-critChance",
  "stat": "critChance",
  "category": "derived",
  "baseFormula": "(precision - 895) / 21",
  "bidirectionalFormulas": {
    "forward": "(precision - 895) / 21",
    "inverse": ["critChance * 21 + 895"]
  },
  "forwardFunction": "(precision) => Math.min(100, Math.max(0, (precision - 895) / 21))",
  "inverseFunctions": ["(critChance) => critChance * 21 + 895"],
  "inputStats": ["precision"],
  "affectedBy": [
    "mod-sigil-precision",
    "mod-trait-*-precision"
  ],
  "displayFormula": "Critical Chance = (Precision - 895) / 21",
  "displayName": "Critical Chance",
  "explanation": "Each point of Precision above 895 grants 1/21 = 0.0476% critical chance. Maximum 100%.",
  "unit": "%",
  "minValue": 0,
  "maxValue": 100,
  "gameVersion": "2025-01-22",
  "validFrom": "2012-08-28",
  "tags": ["combat", "offensive", "critical"],
  "importance": 5
}

// Effective Power Formula
{
  "type": "stat-formula",
  "id": "formula-effectivePower",
  "stat": "effectivePower",
  "category": "effective",
  "baseFormula": "power * (1 + (critChance / 100) * (critDamage - 1))",
  "bidirectionalFormulas": {
    "forward": "power * (1 + (critChance / 100) * (critDamage - 1))",
    "inverse": [
      "effectivePower / (1 + (critChance / 100) * (critDamage - 1))",
      "((effectivePower / power - 1) / (critDamage - 1)) * 100",
      "(effectivePower / power - 1) / (critChance / 100) + 1"
    ]
  },
  "inputStats": ["power", "critChance", "critDamage"],
  "affectedBy": [],
  "displayFormula": "Effective Power = Power × (1 + Crit% × (Crit Damage - 1))",
  "displayName": "Effective Power",
  "explanation": "Average damage multiplier accounting for critical hits. Higher is better for DPS.",
  "gameVersion": "2025-01-22",
  "validFrom": "2012-08-28",
  "tags": ["combat", "offensive", "metric"],
  "importance": 5
}
```

---

### 5. Game Version (`type: "game-version"`)

Tracks game versions and what changed in each balance patch.

**Access Pattern**:
- `GetItem` for version: `type="game-version"`, `id="version-{date}"`
- `Query` all versions: `type="game-version"` (sorted by date)

**Schema**:
```typescript
{
  type: "game-version",
  id: string,                    // "version-2025-01-22"

  // Version Info
  versionNumber: string,         // "January 22, 2025"
  patchDate: string,             // ISO date: "2025-01-22"
  patchNotes?: string,           // URL to official patch notes

  // Change Summary
  changes: Array<{
    type: "formula" | "modifier" | "item" | "trait",
    action: "added" | "modified" | "removed",
    entityId: string,            // ID of changed entity
    description: string,         // Human-readable change
    technicalDetails?: string,   // "Changed coefficient from 1500 to 1600"
  }>,

  // Affected Entities
  modifiedFormulas: string[],    // Formula IDs
  modifiedModifiers: string[],   // Modifier IDs
  newItems: number[],            // Item IDs added
  removedItems: number[],        // Item IDs removed

  // Sync Status
  dataStatus: "pending" | "syncing" | "complete" | "error",
  syncStarted?: number,          // Unix timestamp (ms)
  syncCompleted?: number,        // Unix timestamp (ms)
  syncErrors?: string[],

  // Metadata
  createdAt: number,             // Unix timestamp (ms)
  updatedAt: number,
  createdBy?: string,            // User/system that created
}
```

**Example**:
```json
{
  "type": "game-version",
  "id": "version-2025-02-15",
  "versionNumber": "February 15, 2025 Balance Patch",
  "patchDate": "2025-02-15",
  "patchNotes": "https://en-forum.guildwars2.com/topic/...",
  "changes": [
    {
      "type": "formula",
      "action": "modified",
      "entityId": "formula-critDamage",
      "description": "Reduced critical damage coefficient",
      "technicalDetails": "Changed ferocity coefficient from 1500 to 1600"
    },
    {
      "type": "modifier",
      "action": "modified",
      "entityId": "mod-rune-24836-power-5",
      "description": "Increased Scholar Rune power bonus",
      "technicalDetails": "Changed from +100 to +125 Power"
    }
  ],
  "modifiedFormulas": ["formula-critDamage"],
  "modifiedModifiers": ["mod-rune-24836-power-5"],
  "newItems": [],
  "removedItems": [],
  "dataStatus": "complete",
  "syncStarted": 1737820800000,
  "syncCompleted": 1737820850000,
  "createdAt": 1737820800000,
  "updatedAt": 1737820850000,
  "createdBy": "system"
}
```

---

## GSI Strategy

### Existing GSIs (Keep)

1. **type-interval-index**
   - PK: `type`
   - SK: `interval`
   - Use: Match history queries

2. **matchId-interval-index**
   - PK: `matchId`
   - SK: `interval`
   - Use: Match-specific history

### New GSIs (Proposed)

3. **gameVersion-validFrom-index** *(NEW)*
   - PK: `gameVersion`
   - SK: `validFrom`
   - Use: Get all entities for a specific game version
   - Projection: ALL

   ```typescript
   // Query all formulas for game version 2025-01-22
   const result = await docClient.send(new QueryCommand({
     TableName: 'wvwgg-dev',
     IndexName: 'gameVersion-validFrom-index',
     KeyConditionExpression: 'gameVersion = :version',
     FilterExpression: '#type = :type',
     ExpressionAttributeNames: {
       '#type': 'type'
     },
     ExpressionAttributeValues: {
       ':version': '2025-01-22',
       ':type': 'stat-formula'
     }
   }));
   ```

4. **itemCategory-gameVersion-index** *(NEW)*
   - PK: `itemCategory`
   - SK: `gameVersion`
   - Use: Get all items of a category (all runes, all sigils)
   - Projection: ALL

   ```typescript
   // Query all runes
   const result = await docClient.send(new QueryCommand({
     TableName: 'wvwgg-dev',
     IndexName: 'itemCategory-gameVersion-index',
     KeyConditionExpression: 'itemCategory = :category',
     ExpressionAttributeValues: {
       ':category': 'rune'
     }
   }));
   ```

5. **sourceType-sourceId-index** *(NEW)*
   - PK: `sourceType`
   - SK: `sourceId`
   - Use: Get all modifiers from a specific source
   - Projection: ALL

   ```typescript
   // Get all modifiers from Superior Rune of the Scholar
   const result = await docClient.send(new QueryCommand({
     TableName: 'wvwgg-dev',
     IndexName: 'sourceType-sourceId-index',
     KeyConditionExpression: 'sourceType = :sourceType AND sourceId = :sourceId',
     ExpressionAttributeValues: {
       ':sourceType': 'rune',
       ':sourceId': '24836'
     }
   }));
   ```

---

## Data Sync Pipeline

### 1. Initial Sync from GW2 API

```
┌──────────────────────────┐
│   GW2 API v2             │
│   /items, /itemstats,    │
│   /traits, /skills       │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Lambda: sync-game-data.ts           │
│  Trigger: Manual / Daily             │
│  ────────────────────────────────────│
│  1. Fetch all items from GW2 API     │
│  2. Fetch all itemstats              │
│  3. Extract modifiers from items     │
│  4. Build stat formulas              │
│  5. Store in DynamoDB                │
└───────────┬──────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  DynamoDB: wvwgg-{stage}             │
│  ────────────────────────────────────│
│  - itemstat                          │
│  - enhanced-item                     │
│  - stat-modifier                     │
│  - stat-formula                      │
│  - game-version                      │
└──────────────────────────────────────┘
```

### 2. Balance Patch Update Flow

```
┌──────────────────────────┐
│  Admin Dashboard         │
│  /admin/game-data        │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  API: POST /api/admin/balance-patch  │
│  ────────────────────────────────────│
│  Body: {                             │
│    version: "2025-02-15",            │
│    changes: [...]                    │
│  }                                   │
└───────────┬──────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Lambda: apply-balance-patch.ts      │
│  ────────────────────────────────────│
│  1. Create game-version record       │
│  2. Mark old formulas as invalid     │
│  3. Create new formula versions      │
│  4. Update affected modifiers        │
│  5. Invalidate build cache           │
└───────────┬──────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  DynamoDB Updates                    │
│  ────────────────────────────────────│
│  - Insert new game-version           │
│  - Update validUntil on old formulas │
│  - Insert new formula versions       │
│  - Update modifiers                  │
└──────────────────────────────────────┘
```

### 3. Modifier Extraction Logic

Modifiers are extracted from:

1. **Runes**: Parse `bonuses` array
   - "+25 Power" → flat modifier
   - "+10% Might Duration" → percentage modifier
   - Piece count determines `runeCount` field

2. **Sigils**: Parse `bonuses` array
   - "+5% Critical Chance" → percentage (convert to precision)
   - "+100 Power" → flat modifier

3. **Traits**: Parse `facts` array
   - "AttributeAdjust" facts → formula modifiers
   - "Gain X equal to Y% of Z" → formula

4. **Food/Utility**: Parse consumable effects
   - Duration-based bonuses
   - Condition requirements

---

## Version Management

### Active Version Resolution

```typescript
/**
 * Get the active formula for a stat at a given date
 */
async function getActiveFormula(
  stat: string,
  gameDate: string = new Date().toISOString().split('T')[0]
): Promise<StatFormula | null> {
  // Query all versions of this formula
  const result = await docClient.send(new QueryCommand({
    TableName: 'wvwgg-dev',
    KeyConditionExpression: '#type = :type AND begins_with(id, :prefix)',
    FilterExpression: 'validFrom <= :date AND (attribute_not_exists(validUntil) OR validUntil > :date)',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':type': 'stat-formula',
      ':prefix': `formula-${stat}`,
      ':date': gameDate
    }
  }));

  return result.Items?.[0] as StatFormula | null;
}
```

### Version Migration

When a formula changes:

1. **Preserve History**: Old formula kept with `validUntil` set
2. **Create New**: New formula created with `validFrom` set
3. **Update References**: All modifiers referencing formula updated
4. **Cache Invalidation**: Build cache cleared
5. **Notify Users**: Optional notification of breaking changes

---

## Query Patterns

### Common Queries

#### 1. Get All ItemStats
```typescript
const result = await docClient.send(new QueryCommand({
  TableName: 'wvwgg-dev',
  KeyConditionExpression: '#type = :type',
  ExpressionAttributeNames: {
    '#type': 'type'
  },
  ExpressionAttributeValues: {
    ':type': 'itemstat'
  }
}));
```

#### 2. Get Single Item with Modifiers
```typescript
// Get item
const item = await docClient.send(new GetCommand({
  TableName: 'wvwgg-dev',
  Key: {
    type: 'enhanced-item',
    id: '24836'
  }
}));

// Get its modifiers
const modifiers = await Promise.all(
  item.Item.modifiers.map(modId =>
    docClient.send(new GetCommand({
      TableName: 'wvwgg-dev',
      Key: {
        type: 'stat-modifier',
        id: modId
      }
    }))
  )
);
```

#### 3. Get All Runes
```typescript
const result = await docClient.send(new QueryCommand({
  TableName: 'wvwgg-dev',
  IndexName: 'itemCategory-gameVersion-index',
  KeyConditionExpression: 'itemCategory = :category',
  ExpressionAttributeValues: {
    ':category': 'rune'
  }
}));
```

#### 4. Get Current Formulas
```typescript
const today = new Date().toISOString().split('T')[0];

const result = await docClient.send(new QueryCommand({
  TableName: 'wvwgg-dev',
  KeyConditionExpression: '#type = :type',
  FilterExpression: 'validFrom <= :date AND (attribute_not_exists(validUntil) OR validUntil > :date)',
  ExpressionAttributeNames: {
    '#type': 'type'
  },
  ExpressionAttributeValues: {
    ':type': 'stat-formula',
    ':date': today
  }
}));
```

#### 5. Get Version History
```typescript
const result = await docClient.send(new QueryCommand({
  TableName: 'wvwgg-dev',
  KeyConditionExpression: '#type = :type',
  ExpressionAttributeNames: {
    '#type': 'type'
  },
  ExpressionAttributeValues: {
    ':type': 'game-version'
  },
  ScanIndexForward: false  // Latest first
}));
```

---

## Storage Estimates

### Data Size Calculations

| Entity Type | Count | Size per Item | Total Size |
|-------------|-------|---------------|------------|
| itemstat | ~150 | 500 bytes | 75 KB |
| enhanced-item (runes) | ~80 | 2 KB | 160 KB |
| enhanced-item (sigils) | ~120 | 1.5 KB | 180 KB |
| enhanced-item (infusions) | ~50 | 800 bytes | 40 KB |
| enhanced-item (food) | ~200 | 1 KB | 200 KB |
| stat-modifier | ~1000 | 800 bytes | 800 KB |
| stat-formula | ~20 | 1.5 KB | 30 KB |
| game-version | ~50 | 2 KB | 100 KB |
| **TOTAL** | | | **~1.6 MB** |

### Cost Estimate

**DynamoDB Storage**: $0.25/GB-month
- 1.6 MB = 0.0016 GB
- **Cost**: $0.0004/month (~$0.005/year)

**Reads** (assuming 100K build calculations/month):
- ItemStats: ~100K reads
- Formulas: ~100K reads
- Modifiers: ~500K reads (5 per build average)
- **Total**: 700K read request units
- **Cost**: $0.175/month

**Writes** (sync once per day):
- ~1500 items updated daily
- **Cost**: ~$0.05/month

**Total Monthly Cost**: ~$0.23/month

---

## Migration Plan

### Phase 1: Schema Setup (Week 1)

1. Add new GSIs to CDK stack
2. Deploy updated infrastructure
3. Create TypeScript interfaces

### Phase 2: Data Population (Week 2)

1. Create sync Lambda function
2. Fetch data from GW2 API
3. Extract modifiers
4. Populate DynamoDB

### Phase 3: Query Layer (Week 3)

1. Create server-side query functions
2. Add caching with `unstable_cache`
3. Create React hooks for client

### Phase 4: Testing (Week 4)

1. Unit tests for sync logic
2. Integration tests for queries
3. Performance testing
4. Cost validation

---

## Related Files

- **CDK Stack**: `cdk/lib/wvwgg-stack-simplified.ts` (GSI definitions)
- **Sync Lambda**: `cdk/lambda/sync-game-data.ts` (to be created)
- **Query Functions**: `server/build-queries.ts` (to be created)
- **TypeScript Types**: `lib/gw2/build-types.ts` (to be created)

---

For questions about this schema, please open a GitHub issue or contact the development team.
