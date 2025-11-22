/**
 * TypeScript interfaces for Build System Database Entities
 * These extend the existing GW2 types for the propagator network build system
 */

import type { AttributeType, ItemRarity, ItemType } from './types'

// ============================================================================
// ITEMSTAT
// ============================================================================

export interface ItemStatEntity {
  type: 'itemstat'
  id: string // ItemStat ID as string (e.g., "1163")

  // GW2 API Data
  name: string // "Berserker", "Marauder", etc.
  attributes: Array<{
    attribute: AttributeType
    multiplier: number // Stat distribution (e.g., 0.35, 0.25, 0.25)
    value: number // Base value for ascended (e.g., 63, 45, 45)
  }>

  // Metadata
  lastGW2Sync: number // Unix timestamp (ms)
  gameVersion: string // "2025-01-22"

  // For searching/filtering
  isPvE: boolean
  isPvP: boolean
  isWvW: boolean

  // Enhancement data
  aliases?: string[] // ["Zerk", "Zerker"] for Berserker
  description?: string
  buildTypes?: string[] // ["power-dps", "hybrid"]
  metaRating?: number // 1-5, current meta relevance
}

// ============================================================================
// ENHANCED ITEM
// ============================================================================

export interface EnhancedItemEntity {
  type: 'enhanced-item'
  id: string // Item ID as string (e.g., "80131")

  // GW2 API Data (raw)
  gw2Data: {
    id: number
    name: string
    icon: string
    description?: string
    type: ItemType
    rarity: ItemRarity
    level: number
    details?: any // Type-specific details
    flags: string[]
    game_types: string[]
  }

  // Categorization
  itemCategory: 'armor' | 'weapon' | 'rune' | 'sigil' | 'infusion' | 'food' | 'utility' | 'relic'
  itemSlot?: string // "helm", "coat", "greatsword", etc.
  weightClass?: 'Heavy' | 'Medium' | 'Light' // for armor

  // Stat Modifiers (extracted from bonuses)
  modifiers: string[] // Array of modifier IDs (references stat-modifier entities)

  // Enhancement Data
  tooltipEnhancement?: {
    customDescription?: string
    statBreakdown?: Array<{
      stat: string
      value: number
      source: string
    }>
    buildTips?: string[]
    synergies?: string[] // Other item IDs that synergize
  }

  // Relationships
  relationships?: Array<{
    type: 'requires' | 'conflicts' | 'synergizes' | 'component_of'
    targetItemId: number
    reason: string
  }>

  // Metadata
  lastGW2Sync: number // Unix timestamp (ms)
  gameVersion: string // "2025-01-22"

  // For filtering in propagator network
  statTypes: string[] // ["Power", "Precision", "Ferocity"]
  maxStatValue?: number // Highest single stat value (for sorting)
}

// ============================================================================
// STAT MODIFIER
// ============================================================================

export interface StatModifierEntity {
  type: 'stat-modifier'
  id: string // Unique modifier ID (e.g., "mod-rune-24836-power-1")

  // Source Information
  sourceType: 'rune' | 'sigil' | 'trait' | 'food' | 'utility' | 'infusion' | 'relic'
  sourceId: string // Item ID or Trait ID (as string)
  sourceName: string // Human-readable (e.g., "Superior Rune of the Scholar")

  // Modifier Details
  targetStat: string // "power", "precision", "critChance", "effectivePower", etc.
  modifierType: 'flat' | 'percentage' | 'formula' | 'conditional'

  // Values
  flatValue?: number // For flat modifiers: +175 Power
  percentValue?: number // For percentage: +10% (stored as 10, not 0.10)
  formula?: string // For complex: "ferocity * 0.13"

  // Conditions (for conditional modifiers)
  conditions?: ModifierCondition[]

  // Stacking Behavior
  stackable: boolean // Can it stack with itself?
  maxStacks?: number // Max stacks if stackable
  stackType?: 'intensity' | 'duration'
  uniqueGroup?: string // Conflicts with other modifiers in same group

  // For Runes: Piece Count Requirement
  runeCount?: number // 1-6 for rune bonuses

  // Display
  displayText: string // "+25 Power" or "10% Might Duration"
  icon?: string
  sortOrder?: number // For display ordering

  // Version Tracking
  gameVersion: string // "2025-01-22"
  validFrom: string // "2025-01-22"
  validUntil?: string // "2025-03-15" (when it was changed/removed)

  // Metadata
  tags?: string[] // ["power", "dps", "scholar"]
  isMeta?: boolean // Commonly used in meta builds
}

export interface ModifierCondition {
  type: 'health' | 'distance' | 'boon' | 'time' | 'weapon' | 'enemy_condition'
  operator: '>' | '<' | '==' | '>=' | '<='
  value: any
  description: string // "Health above 90%"
}

// ============================================================================
// STAT FORMULA
// ============================================================================

export interface StatFormulaEntity {
  type: 'stat-formula'
  id: string // "formula-critChance", "formula-effectivePower"

  // Formula Identification
  stat: string // "critChance", "critDamage", "effectivePower"
  category: 'derived' | 'effective' | 'base'

  // Formula Definition
  baseFormula: string // "(precision - 895) / 21"
  bidirectionalFormulas?: {
    // For propagator support
    forward: string // "precision -> critChance"
    inverse: string[] // ["critChance -> precision"]
  }

  // JavaScript Implementation
  forwardFunction: string // Serialized function for evaluation
  inverseFunctions?: string[] // Serialized inverse functions

  // Dependencies
  inputStats: string[] // ["precision"]
  affectedBy: string[] // Modifier IDs that can affect this stat

  // Display
  displayFormula: string // "Critical Chance = (Precision - 895) / 21"
  displayName: string // "Critical Chance"
  explanation: string // "Each point of Precision above 895..."
  unit?: string // "%" for percentages

  // Constraints
  minValue?: number // 0 for crit chance
  maxValue?: number // 100 for crit chance

  // Version Tracking
  gameVersion: string // "2025-01-22"
  validFrom: string // "2020-01-01"
  validUntil?: string // "2025-03-15" (when formula changed)
  changelog?: string // "Changed coefficient from 21 to 22"

  // Metadata
  tags?: string[] // ["combat", "offensive"]
  importance?: number // 1-5, how important for builds
}

// ============================================================================
// GAME VERSION
// ============================================================================

export interface GameVersionEntity {
  type: 'game-version'
  id: string // "version-2025-01-22"

  // Version Info
  versionNumber: string // "January 22, 2025"
  patchDate: string // ISO date: "2025-01-22"
  patchNotes?: string // URL to official patch notes

  // Change Summary
  changes: VersionChange[]

  // Affected Entities
  modifiedFormulas: string[] // Formula IDs
  modifiedModifiers: string[] // Modifier IDs
  newItems: number[] // Item IDs added
  removedItems: number[] // Item IDs removed

  // Sync Status
  dataStatus: 'pending' | 'syncing' | 'complete' | 'error'
  syncStarted?: number // Unix timestamp (ms)
  syncCompleted?: number // Unix timestamp (ms)
  syncErrors?: string[]

  // Metadata
  createdAt: number // Unix timestamp (ms)
  updatedAt: number
  createdBy?: string // User/system that created
}

export interface VersionChange {
  type: 'formula' | 'modifier' | 'item' | 'trait'
  action: 'added' | 'modified' | 'removed'
  entityId: string // ID of changed entity
  description: string // Human-readable change
  technicalDetails?: string // "Changed coefficient from 1500 to 1600"
}

// ============================================================================
// BALANCE PATCH (for applying updates)
// ============================================================================

export interface BalancePatch {
  version: string
  patchDate: string
  notes: string
  changes: BalanceChange[]
}

export type BalanceChange =
  | { type: 'modify-formula'; formulaId: string; newFormula: string; changelog: string }
  | { type: 'modify-modifier'; modifierId: string; newValue: number; changelog: string }
  | { type: 'add-modifier'; modifier: Omit<StatModifierEntity, 'type'> }
  | { type: 'remove-modifier'; modifierId: string; reason: string }
  | { type: 'add-item'; item: Omit<EnhancedItemEntity, 'type'> }
  | { type: 'remove-item'; itemId: string; reason: string }

// ============================================================================
// QUERY RESULTS
// ============================================================================

/**
 * Result from querying all itemstats
 */
export interface ItemStatsQueryResult {
  items: ItemStatEntity[]
  count: number
  lastEvaluatedKey?: {
    type: string
    id: string
  }
}

/**
 * Result from querying items by category
 */
export interface ItemsByCategoryQueryResult {
  items: EnhancedItemEntity[]
  count: number
  category: string
  lastEvaluatedKey?: {
    itemCategory: string
    gameVersion: string
    id: string
  }
}

/**
 * Result from querying modifiers by source
 */
export interface ModifiersBySourceQueryResult {
  modifiers: StatModifierEntity[]
  count: number
  sourceType: string
  sourceId: string
}

/**
 * Complete build data package (for propagator network initialization)
 */
export interface BuildDataPackage {
  itemStats: Map<number, ItemStatEntity>
  items: Map<number, EnhancedItemEntity>
  modifiers: Map<string, StatModifierEntity>
  formulas: Map<string, StatFormulaEntity>
  gameVersion: string
  loadedAt: number
}

// ============================================================================
// SYNC RESULTS
// ============================================================================

export interface SyncResult {
  success: boolean
  duration: number
  itemsProcessed: number
  modifiersExtracted: number
  formulasCreated: number
  errors: string[]
  gameVersion: string
}

export interface ModifierExtractionResult {
  modifiers: StatModifierEntity[]
  errors: string[]
  skipped: number
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Active formula resolution result
 */
export interface ActiveFormulaResult {
  formula: StatFormulaEntity | null
  gameDate: string
  isHistorical: boolean
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  oldVersion: GameVersionEntity
  newVersion: GameVersionEntity
  breaking: boolean
  affectedFormulas: string[]
  affectedModifiers: string[]
}
