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
import { isTwoHandedWeapon } from './types'

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
    slot: 'armor' | 'trinket' | 'weapon' | 'weapon-2h' | 'back' | 'amulet' | 'ring' | 'accessory'
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

  // Trinkets (using specific multipliers)
  addGearPieceStats(gear.amulet.statId, 'amulet')
  addGearPieceStats(gear.ring1.statId, 'ring')
  addGearPieceStats(gear.ring2.statId, 'ring')
  addGearPieceStats(gear.accessory1.statId, 'accessory')
  addGearPieceStats(gear.accessory2.statId, 'accessory')
  addGearPieceStats(gear.backItem.statId, 'back')
  addGearPieceStats(gear.relic.statId, 'trinket')

  // Weapons (check if two-handed)
  const weaponSet1MainSlot = isTwoHandedWeapon(gear.weaponSet1Main.weaponType) ? 'weapon-2h' : 'weapon'
  addGearPieceStats(gear.weaponSet1Main.statId, weaponSet1MainSlot)
  if (gear.weaponSet1Off) {
    addGearPieceStats(gear.weaponSet1Off.statId, 'weapon')
  }
  if (gear.weaponSet2Main) {
    const weaponSet2MainSlot = isTwoHandedWeapon(gear.weaponSet2Main.weaponType) ? 'weapon-2h' : 'weapon'
    addGearPieceStats(gear.weaponSet2Main.statId, weaponSet2MainSlot)
  }
  if (gear.weaponSet2Off) {
    addGearPieceStats(gear.weaponSet2Off.statId, 'weapon')
  }

  // Add rune bonuses
  addRuneStats(stats, gear, items)

  // Add sigil bonuses
  addSigilStats(stats, gear, items)

  // Add infusion stats
  addInfusionStats(stats, gear, items)

  return stats
}

/**
 * Get stat multiplier for gear slot
 * Based on ascended gear values from GW2 Wiki
 * https://wiki.guildwars2.com/wiki/Attribute_combinations
 *
 * These multipliers are applied to ItemStat multipliers to get final stat values.
 * Base reference is armor pieces (63 for major stat).
 */
function getSlotMultiplier(slot: 'armor' | 'trinket' | 'weapon' | 'weapon-2h' | 'back' | 'amulet' | 'ring' | 'accessory'): number {
  switch (slot) {
    case 'armor':
      return 1.0 // Base: 63 major / 45 minor
    case 'amulet':
      return 2.492 // 157 major / 63 base
    case 'ring':
      return 2.0 // 126 major / 63 base
    case 'accessory':
      return 1.746 // 110 major / 63 base
    case 'back':
      return 0.857 // 54 major / 63 base
    case 'trinket':
      return 2.0 // Default trinket (ring value)
    case 'weapon':
      return 1.984 // 125 major / 63 base (1-handed)
    case 'weapon-2h':
      return 3.984 // 251 major / 63 base (2-handed)
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
 * Add stats from runes (all bonuses based on piece count)
 * Runes give bonuses at 1, 2, 3, 4, 5, and 6 pieces equipped
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

  // Apply rune bonuses based on piece count
  for (const [runeId, count] of runeCounts) {
    const rune = items.get(runeId)
    if (!rune?.details) continue

    // The bonuses array contains text descriptions like "+25 Power"
    // We apply bonuses for each tier up to the equipped count
    const bonuses = rune.details.bonuses || []

    for (let i = 0; i < Math.min(count, bonuses.length); i++) {
      const bonus = bonuses[i]
      parseRuneBonus(stats, bonus)
    }

    // Also apply infix_upgrade stats if present (usually for lower tier bonuses)
    if (rune.details.infix_upgrade) {
      for (const attr of rune.details.infix_upgrade.attributes) {
        addAttributeToStats(stats, attr.attribute, attr.modifier)
      }
    }
  }
}

/**
 * Parse a rune bonus string and add the stats
 * Examples: "+25 Power", "+10% Boon Duration", "+100 Precision"
 */
function parseRuneBonus(stats: BaseStats, bonus: string): void {
  // Match patterns like "+25 Power" or "+10% Boon Duration"
  const statMatch = bonus.match(/\+(\d+)\s+(\w+(?:\s+\w+)*)/)

  if (statMatch) {
    const value = parseInt(statMatch[1])
    const attributeName = statMatch[2]

    // Map common attribute names to our stat types
    const attributeMap: Record<string, string> = {
      'Power': 'Power',
      'Precision': 'Precision',
      'Toughness': 'Toughness',
      'Vitality': 'Vitality',
      'Ferocity': 'Ferocity',
      'Condition Damage': 'ConditionDamage',
      'Expertise': 'Expertise',
      'Concentration': 'Concentration',
      'Healing Power': 'Healing',
      'Boon Duration': 'Concentration', // Boon Duration maps to Concentration
      'Condition Duration': 'Expertise', // Condition Duration maps to Expertise
    }

    const mappedAttribute = attributeMap[attributeName]
    if (mappedAttribute) {
      addAttributeToStats(stats, mappedAttribute, value)
    }
  }
}

/**
 * Add stats from sigils
 * Sigils can provide flat stat bonuses or percentage modifiers
 */
function addSigilStats(stats: BaseStats, gear: GearSelection, items: Map<number, Item>): void {
  const weaponPieces = [
    gear.weaponSet1Main,
    gear.weaponSet1Off,
    gear.weaponSet2Main,
    gear.weaponSet2Off,
  ].filter((piece): piece is typeof gear.weaponSet1Main => piece !== undefined)

  for (const piece of weaponPieces) {
    // Add first sigil
    if (piece.upgradeId) {
      const sigil = items.get(piece.upgradeId)
      if (sigil?.details) {
        // Apply infix_upgrade stats if present
        if (sigil.details.infix_upgrade) {
          for (const attr of sigil.details.infix_upgrade.attributes) {
            addAttributeToStats(stats, attr.attribute, attr.modifier)
          }
        }

        // Parse bonus descriptions for additional stats
        const bonuses = sigil.details.bonuses || []
        for (const bonus of bonuses) {
          parseSigilBonus(stats, bonus)
        }
      }
    }

    // Add second sigil (for two-handed weapons)
    if ('upgrade2Id' in piece && piece.upgrade2Id) {
      const sigil = items.get(piece.upgrade2Id)
      if (sigil?.details) {
        // Apply infix_upgrade stats if present
        if (sigil.details.infix_upgrade) {
          for (const attr of sigil.details.infix_upgrade.attributes) {
            addAttributeToStats(stats, attr.attribute, attr.modifier)
          }
        }

        // Parse bonus descriptions for additional stats
        const bonuses = sigil.details.bonuses || []
        for (const bonus of bonuses) {
          parseSigilBonus(stats, bonus)
        }
      }
    }
  }
}

/**
 * Parse a sigil bonus string and add the stats
 * Examples: "+5% Crit Chance", "+100 Power", "+7% Critical Chance"
 */
function parseSigilBonus(stats: BaseStats, bonus: string): void {
  // Match flat stat bonuses like "+100 Power"
  const flatStatMatch = bonus.match(/\+(\d+)\s+(\w+(?:\s+\w+)*)/)
  if (flatStatMatch) {
    const value = parseInt(flatStatMatch[1])
    const attributeName = flatStatMatch[2]

    const attributeMap: Record<string, string> = {
      'Power': 'Power',
      'Precision': 'Precision',
      'Toughness': 'Toughness',
      'Vitality': 'Vitality',
      'Ferocity': 'Ferocity',
      'Condition Damage': 'ConditionDamage',
      'Expertise': 'Expertise',
      'Concentration': 'Concentration',
      'Healing Power': 'Healing',
    }

    const mappedAttribute = attributeMap[attributeName]
    if (mappedAttribute) {
      addAttributeToStats(stats, mappedAttribute, value)
      return
    }
  }

  // Match percentage bonuses like "+7% Critical Chance" or "+5% Crit Chance"
  const percentMatch = bonus.match(/\+(\d+)%\s+(?:Critical|Crit)\s+(?:Chance|Damage)/)
  if (percentMatch) {
    const percent = parseInt(percentMatch[1])

    // Convert percentage crit chance to precision
    // 1% crit = 21 precision (from formula: critChance = (precision - 895) / 21)
    if (bonus.toLowerCase().includes('chance')) {
      const precisionBonus = percent * 21
      stats.precision += precisionBonus
    }

    // Convert percentage crit damage to ferocity
    // 1% crit damage = 15 ferocity (from formula: critDamage = 1.5 + ferocity / 1500)
    if (bonus.toLowerCase().includes('damage')) {
      const ferocityBonus = percent * 15
      stats.ferocity += ferocityBonus
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
 * Weapon strength values for ascended weapons at level 80
 * Average of min/max damage range
 */
const WEAPON_STRENGTH: Record<string, number> = {
  // Two-handed weapons
  Greatsword: 1100,
  Hammer: 1100,
  Longbow: 1100,
  Rifle: 1100,
  Shortbow: 1050,
  Staff: 1100,

  // One-handed weapons
  Axe: 950,
  Dagger: 950,
  Mace: 950,
  Pistol: 950,
  Scepter: 950,
  Sword: 950,

  // Off-hand weapons
  Focus: 950,
  Shield: 950,
  Torch: 950,
  Warhorn: 950,

  // Special
  Harpoon: 1100,
  Speargun: 1100,
  Trident: 1100,
}

/**
 * Reference armor for damage calculations at level 80
 * This is the standard armor value used in GW2 damage tooltips
 */
const REFERENCE_ARMOR = 2597

/**
 * Calculate skill damage based on weapon, power, and skill coefficient
 *
 * Formula: Damage = (Weapon Strength × Power × Coefficient) / 2597
 *
 * For critical hits, multiply by critical damage multiplier
 *
 * @param weaponType - Type of weapon (e.g., "Greatsword")
 * @param power - Player's power stat
 * @param coefficient - Skill damage coefficient
 * @param critDamage - Critical damage multiplier (optional, for crit damage calc)
 * @returns Calculated skill damage
 */
export function calculateSkillDamage(
  weaponType: string,
  power: number,
  coefficient: number,
  critDamage?: number
): {
  normal: number
  critical: number
} {
  const weaponStrength = WEAPON_STRENGTH[weaponType] || 1000

  // Base damage formula
  const baseDamage = (weaponStrength * power * coefficient) / REFERENCE_ARMOR

  // Critical damage (if crit damage multiplier provided)
  const criticalDamage = critDamage ? baseDamage * critDamage : baseDamage * 1.5

  return {
    normal: Math.round(baseDamage),
    critical: Math.round(criticalDamage),
  }
}

/**
 * Calculate average skill damage accounting for critical chance
 *
 * @param weaponType - Type of weapon
 * @param power - Player's power stat
 * @param coefficient - Skill damage coefficient
 * @param critChance - Critical hit chance (0-100)
 * @param critDamage - Critical damage multiplier
 * @returns Average damage per hit
 */
export function calculateAverageSkillDamage(
  weaponType: string,
  power: number,
  coefficient: number,
  critChance: number,
  critDamage: number
): number {
  const { normal, critical } = calculateSkillDamage(weaponType, power, coefficient, critDamage)

  // Average damage = normal * (1 - crit%) + critical * crit%
  const critChanceDecimal = Math.min(100, critChance) / 100
  return Math.round(normal * (1 - critChanceDecimal) + critical * critChanceDecimal)
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
  // Get weapon type from build
  const weaponType = build.gear.weaponSet1Main.weaponType || 'Greatsword'

  // For now, use a rough DPS estimate based on effective power
  // In a real implementation, this would:
  // 1. Look up actual skill coefficients from API
  // 2. Calculate damage for each skill in rotation
  // 3. Account for cast times and cooldowns
  // 4. Sum up damage over time

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
