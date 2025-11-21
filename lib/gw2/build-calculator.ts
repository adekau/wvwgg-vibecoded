/**
 * Build Calculator - Calculates all stats from a GW2 build
 * Includes Effective Power, Effective Health, and other derived metrics
 */

import type {
  Build,
  GearSelection,
  BaseStats,
  DerivedStats,
  CalculatedStats,
  ProfessionId,
  PROFESSION_BASE_STATS,
  ItemStat,
  Item,
  Trait,
  Skill,
  SpecializationSelection,
} from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Formula constants from GW2 Wiki
 * @see https://wiki.guildwars2.com/wiki/Attribute
 */
const CRIT_CHANCE_BASE = 895
const CRIT_CHANCE_COEFFICIENT = 21
const CRIT_DAMAGE_BASE = 1.5
const FEROCITY_COEFFICIENT = 1500
const VITALITY_TO_HEALTH = 10
const BOON_DURATION_COEFFICIENT = 1500
const CONDITION_DURATION_COEFFICIENT = 1500

/**
 * Profession base stats at level 80
 * These are the starting stats before any gear
 */
const PROFESSION_STATS: Record<ProfessionId, { health: number; armor: number }> = {
  Guardian: { health: 1645, armor: 967 },
  Warrior: { health: 9212, armor: 1000 },
  Engineer: { health: 1645, armor: 967 },
  Ranger: { health: 1645, armor: 967 },
  Thief: { health: 1645, armor: 967 },
  Elementalist: { health: 1645, armor: 967 },
  Mesmer: { health: 1645, armor: 967 },
  Necromancer: { health: 5945, armor: 1000 },
  Revenant: { health: 1645, armor: 967 },
}

/**
 * Base stats that all level 80 characters have
 */
const BASE_STATS: BaseStats = {
  power: 1000,
  precision: 1000,
  toughness: 1000,
  vitality: 1000,
  ferocity: 0,
  conditionDamage: 0,
  expertise: 0,
  concentration: 0,
  healingPower: 0,
  agonyResistance: 0,
}

// ============================================================================
// STAT AGGREGATION
// ============================================================================

/**
 * Calculate total stats from gear
 */
export function calculateGearStats(
  gear: GearSelection,
  itemStats: Map<number, ItemStat>,
  items: Map<number, Item>
): BaseStats {
  const stats: BaseStats = { ...BASE_STATS }

  // Helper to add stats from a gear piece
  const addGearPieceStats = (
    statId: number,
    slot: 'armor' | 'trinket' | 'weapon' | 'back'
  ) => {
    const itemStat = itemStats.get(statId)
    if (!itemStat) return

    // Get multiplier based on slot type
    const multiplier = getSlotMultiplier(slot)

    for (const attr of itemStat.attributes) {
      const value = attr.value * multiplier
      addAttributeToStats(stats, attr.attribute, value)
    }
  }

  // Armor pieces
  addGearPieceStats(gear.helm.statId, 'armor')
  addGearPieceStats(gear.shoulders.statId, 'armor')
  addGearPieceStats(gear.coat.statId, 'armor')
  addGearPieceStats(gear.gloves.statId, 'armor')
  addGearPieceStats(gear.leggings.statId, 'armor')
  addGearPieceStats(gear.boots.statId, 'armor')

  // Trinkets
  addGearPieceStats(gear.amulet.statId, 'trinket')
  addGearPieceStats(gear.ring1.statId, 'trinket')
  addGearPieceStats(gear.ring2.statId, 'trinket')
  addGearPieceStats(gear.accessory1.statId, 'trinket')
  addGearPieceStats(gear.accessory2.statId, 'trinket')
  addGearPieceStats(gear.backItem.statId, 'back')
  addGearPieceStats(gear.relic.statId, 'trinket')

  // Weapons
  addGearPieceStats(gear.weaponSet1Main.statId, 'weapon')
  if (gear.weaponSet1Off) {
    addGearPieceStats(gear.weaponSet1Off.statId, 'weapon')
  }
  if (gear.weaponSet2Main) {
    addGearPieceStats(gear.weaponSet2Main.statId, 'weapon')
  }
  if (gear.weaponSet2Off) {
    addGearPieceStats(gear.weaponSet2Off.statId, 'weapon')
  }

  // Add rune bonuses
  addRuneStats(stats, gear, items)

  // Add infusion stats
  addInfusionStats(stats, gear, items)

  return stats
}

/**
 * Get stat multiplier for gear slot
 * Based on ascended gear values from GW2 Wiki
 */
function getSlotMultiplier(slot: 'armor' | 'trinket' | 'weapon' | 'back'): number {
  switch (slot) {
    case 'armor':
      return 1.0 // Armor pieces give full stat values
    case 'trinket':
      return 1.26 // Trinkets give 26% more stats
    case 'weapon':
      return 1.0
    case 'back':
      return 0.56 // Back items give reduced stats
    default:
      return 1.0
  }
}

/**
 * Add attribute value to stats object
 */
function addAttributeToStats(stats: BaseStats, attribute: string, value: number): void {
  switch (attribute) {
    case 'Power':
      stats.power += value
      break
    case 'Precision':
      stats.precision += value
      break
    case 'Toughness':
      stats.toughness += value
      break
    case 'Vitality':
      stats.vitality += value
      break
    case 'CritDamage':
    case 'Ferocity':
      stats.ferocity += value
      break
    case 'ConditionDamage':
      stats.conditionDamage += value
      break
    case 'Expertise':
    case 'ConditionDuration':
      stats.expertise += value
      break
    case 'Concentration':
    case 'BoonDuration':
      stats.concentration += value
      break
    case 'Healing':
    case 'HealingPower':
      stats.healingPower += value
      break
    case 'AgonyResistance':
      stats.agonyResistance += value
      break
  }
}

/**
 * Add stats from runes (6-piece bonus)
 */
function addRuneStats(stats: BaseStats, gear: GearSelection, items: Map<number, Item>): void {
  // Count rune occurrences
  const runeCounts = new Map<number, number>()

  const armorPieces = [
    gear.helm,
    gear.shoulders,
    gear.coat,
    gear.gloves,
    gear.leggings,
    gear.boots,
  ]

  for (const piece of armorPieces) {
    if (piece.upgradeId) {
      runeCounts.set(piece.upgradeId, (runeCounts.get(piece.upgradeId) || 0) + 1)
    }
  }

  // Apply rune bonuses for 6-piece sets
  for (const [runeId, count] of runeCounts) {
    if (count >= 6) {
      const rune = items.get(runeId)
      if (rune?.details?.infix_upgrade) {
        for (const attr of rune.details.infix_upgrade.attributes) {
          addAttributeToStats(stats, attr.attribute, attr.modifier)
        }
      }
    }
  }
}

/**
 * Add stats from infusions
 */
function addInfusionStats(stats: BaseStats, gear: GearSelection, items: Map<number, Item>): void {
  const allPieces = [
    gear.helm,
    gear.shoulders,
    gear.coat,
    gear.gloves,
    gear.leggings,
    gear.boots,
    gear.amulet,
    gear.ring1,
    gear.ring2,
    gear.accessory1,
    gear.accessory2,
    gear.backItem,
    gear.relic,
    gear.weaponSet1Main,
    gear.weaponSet1Off,
    gear.weaponSet2Main,
    gear.weaponSet2Off,
  ].filter(Boolean)

  for (const piece of allPieces) {
    for (const infusionId of piece.infusions) {
      const infusion = items.get(infusionId)
      if (infusion?.details?.infix_upgrade) {
        for (const attr of infusion.details.infix_upgrade.attributes) {
          addAttributeToStats(stats, attr.attribute, attr.modifier)
        }
      }
    }
  }
}

// ============================================================================
// DERIVED STAT CALCULATIONS
// ============================================================================

/**
 * Calculate crit chance from precision
 * Formula: (Precision - 895) / 21
 * Cap at 100%
 */
export function calculateCritChance(precision: number): number {
  const critChance = ((precision - CRIT_CHANCE_BASE) / CRIT_CHANCE_COEFFICIENT) * 100
  return Math.min(100, Math.max(0, critChance))
}

/**
 * Calculate crit damage multiplier from ferocity
 * Formula: 1.5 + (Ferocity / 1500)
 */
export function calculateCritDamage(ferocity: number): number {
  return CRIT_DAMAGE_BASE + ferocity / FEROCITY_COEFFICIENT
}

/**
 * Calculate total health
 * Formula: Base Health + (Vitality * 10)
 */
export function calculateHealth(profession: ProfessionId, vitality: number): number {
  const baseHealth = PROFESSION_STATS[profession].health
  return baseHealth + vitality * VITALITY_TO_HEALTH
}

/**
 * Calculate total armor
 * Formula: Base Armor + Toughness
 */
export function calculateArmor(profession: ProfessionId, toughness: number): number {
  const baseArmor = PROFESSION_STATS[profession].armor
  return baseArmor + toughness
}

/**
 * Calculate boon duration percentage
 * Formula: (Concentration / 1500) * 100
 */
export function calculateBoonDuration(concentration: number): number {
  return (concentration / BOON_DURATION_COEFFICIENT) * 100
}

/**
 * Calculate condition duration percentage
 * Formula: (Expertise / 1500) * 100
 */
export function calculateConditionDuration(expertise: number): number {
  return (expertise / CONDITION_DURATION_COEFFICIENT) * 100
}

// ============================================================================
// EFFECTIVE POWER & HEALTH CALCULATIONS
// ============================================================================

/**
 * Calculate Effective Power (EP)
 * Formula: Power × (1 + CritChance × (CritDamage - 1))
 *
 * This represents the average damage output accounting for critical hits.
 * A higher EP means more damage per hit on average.
 *
 * @example
 * Power: 3000, Crit Chance: 80%, Crit Damage: 2.5x
 * EP = 3000 × (1 + 0.8 × (2.5 - 1)) = 3000 × 2.2 = 6600
 */
export function calculateEffectivePower(
  power: number,
  critChance: number,
  critDamage: number
): number {
  const critChanceDecimal = critChance / 100
  return power * (1 + critChanceDecimal * (critDamage - 1))
}

/**
 * Calculate Effective Health (EH)
 * Formula: Health × (Armor / 1000)
 *
 * This represents how much raw damage you can take before dying.
 * A higher EH means you're tankier.
 * WvW-specific formula where armor directly affects survivability.
 *
 * @example
 * Health: 20000, Armor: 2500
 * EH = 20000 × (2500 / 1000) = 20000 × 2.5 = 50000
 */
export function calculateEffectiveHealth(health: number, armor: number): number {
  return health * (armor / 1000)
}

/**
 * Calculate Effective Health Power (EHP)
 * Formula: EP × EH
 *
 * This is a combined metric for "bruiser" builds that balance damage and tankiness.
 * Useful for WvW roaming builds where you need both damage and survivability.
 *
 * @example
 * EP: 6600, EH: 50000
 * EHP = 6600 × 50000 = 330,000,000
 */
export function calculateEffectiveHealthPower(
  effectivePower: number,
  effectiveHealth: number
): number {
  return effectivePower * effectiveHealth
}

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

/**
 * Calculate all stats for a build
 */
export function calculateBuildStats(
  build: Build,
  itemStats: Map<number, ItemStat>,
  items: Map<number, Item>,
  traits?: Map<number, Trait>,
  skills?: Map<number, Skill>
): CalculatedStats {
  // Get base stats from gear
  const gearStats = calculateGearStats(build.gear, itemStats, items)

  // Calculate derived stats
  const critChance = calculateCritChance(gearStats.precision)
  const critDamage = calculateCritDamage(gearStats.ferocity)
  const health = calculateHealth(build.profession, gearStats.vitality)
  const armor = calculateArmor(build.profession, gearStats.toughness)
  const boonDuration = calculateBoonDuration(gearStats.concentration)
  const conditionDuration = calculateConditionDuration(gearStats.expertise)

  // Calculate effective metrics
  const effectivePower = calculateEffectivePower(gearStats.power, critChance, critDamage)
  const effectiveHealth = calculateEffectiveHealth(health, armor)
  const effectiveHealthPower = calculateEffectiveHealthPower(effectivePower, effectiveHealth)

  // Combine all stats
  const calculatedStats: CalculatedStats = {
    // Base stats
    ...gearStats,

    // Derived stats
    critChance,
    critDamage,
    health,
    armor,
    boonDuration,
    conditionDuration,

    // Effective metrics
    effectivePower,
    effectiveHealth,
    effectiveHealthPower,
  }

  // Add DPS estimates if skills are provided
  if (skills) {
    calculatedStats.weaponDPS = estimateWeaponDPS(build, calculatedStats, skills)
  }

  return calculatedStats
}

/**
 * Estimate weapon DPS based on skill coefficients
 * This is a simplified calculation - real DPS depends on rotation, buffs, etc.
 */
function estimateWeaponDPS(
  build: Build,
  stats: CalculatedStats,
  skills: Map<number, Skill>
): number {
  // This is a placeholder - real implementation would need:
  // 1. Skill damage coefficients from API
  // 2. Skill cast times and cooldowns
  // 3. Rotation assumptions
  // 4. Weapon type and attack speed

  // For now, return a basic estimate
  return stats.effectivePower * 0.5 // Rough approximation
}

// ============================================================================
// BREAKPOINT ANALYSIS
// ============================================================================

/**
 * Find the next critical chance breakpoint
 * Returns how much precision is needed to reach the next 1% crit chance
 */
export function getNextCritBreakpoint(currentPrecision: number): {
  precision: number
  critChance: number
  precisionNeeded: number
} {
  const currentCrit = calculateCritChance(currentPrecision)
  const nextCrit = Math.ceil(currentCrit)

  if (nextCrit >= 100) {
    return {
      precision: currentPrecision,
      critChance: 100,
      precisionNeeded: 0,
    }
  }

  // Calculate precision needed for next crit %
  const precisionForNext = CRIT_CHANCE_BASE + nextCrit * CRIT_CHANCE_COEFFICIENT
  const precisionNeeded = precisionForNext - currentPrecision

  return {
    precision: precisionForNext,
    critChance: nextCrit,
    precisionNeeded,
  }
}

/**
 * Calculate concentration needed for target boon duration
 */
export function getConcentrationForBoonDuration(targetDuration: number): number {
  return (targetDuration / 100) * BOON_DURATION_COEFFICIENT
}

/**
 * Calculate expertise needed for target condition duration
 */
export function getExpertiseForConditionDuration(targetDuration: number): number {
  return (targetDuration / 100) * CONDITION_DURATION_COEFFICIENT
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Compare two builds and show stat differences
 */
export function compareBuildStats(
  stats1: CalculatedStats,
  stats2: CalculatedStats
): Partial<Record<keyof CalculatedStats, number>> {
  const diff: Partial<Record<keyof CalculatedStats, number>> = {}

  for (const key in stats1) {
    const k = key as keyof CalculatedStats
    if (typeof stats1[k] === 'number' && typeof stats2[k] === 'number') {
      diff[k] = (stats2[k] as number) - (stats1[k] as number)
    }
  }

  return diff
}

/**
 * Format stat value for display
 */
export function formatStatValue(stat: keyof CalculatedStats, value: number): string {
  // Percentages
  if (['critChance', 'boonDuration', 'conditionDuration'].includes(stat)) {
    return `${value.toFixed(1)}%`
  }

  // Large numbers (EHP)
  if (stat === 'effectiveHealthPower' && value > 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  // Regular stats
  return Math.round(value).toLocaleString()
}
