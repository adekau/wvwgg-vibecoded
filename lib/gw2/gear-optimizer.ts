/**
 * Gear Optimizer - Finds the best gear to match target stats
 */

import type { ItemStatEntity } from './build-data-types'

export interface TargetStats {
  power?: number
  precision?: number
  ferocity?: number
  vitality?: number
  toughness?: number
  conditionDamage?: number
  expertise?: number
  concentration?: number
  healingPower?: number
}

export interface GearSlot {
  slot: string
  statId: string
  statName: string
  stats: Record<string, number>
}

export interface OptimizedBuild {
  slots: GearSlot[]
  totalStats: Record<string, number>
  distance: number
  targetStats: TargetStats
}

// Ascended gear slots and their stat values
const ASCENDED_GEAR_SLOTS = [
  { slot: 'Helm', statMultiplier: 1 }, // 63/45/45 for major/minor/minor
  { slot: 'Shoulders', statMultiplier: 1 },
  { slot: 'Coat', statMultiplier: 1 },
  { slot: 'Gloves', statMultiplier: 1 },
  { slot: 'Leggings', statMultiplier: 1 },
  { slot: 'Boots', statMultiplier: 1 },
  { slot: 'Amulet', statMultiplier: 1.5 }, // Trinkets have higher stats
  { slot: 'Ring 1', statMultiplier: 1.5 },
  { slot: 'Ring 2', statMultiplier: 1.5 },
  { slot: 'Accessory 1', statMultiplier: 1.3 },
  { slot: 'Accessory 2', statMultiplier: 1.3 },
  { slot: 'Back', statMultiplier: 1.2 },
  { slot: 'Weapon 1', statMultiplier: 1 },
  { slot: 'Weapon 2', statMultiplier: 1 }
] as const

/**
 * Calculate Euclidean distance between current stats and target stats
 */
function calculateDistance(current: Record<string, number>, target: TargetStats): number {
  let sumSquares = 0

  for (const [stat, targetValue] of Object.entries(target)) {
    if (targetValue !== undefined) {
      const currentValue = current[stat] || 0
      const diff = currentValue - targetValue
      sumSquares += diff * diff
    }
  }

  return Math.sqrt(sumSquares)
}

/**
 * Convert ItemStat attributes to a stats object
 */
function itemStatToStats(itemStat: ItemStatEntity): Record<string, number> {
  const stats: Record<string, number> = {}

  for (const attr of itemStat.attributes) {
    const statName = attr.attribute.toLowerCase()
    stats[statName] = attr.value
  }

  return stats
}

/**
 * Optimize gear selection to match target stats
 *
 * This is a greedy algorithm that selects the best itemstat for each slot
 * to minimize the distance from target stats.
 */
export function optimizeGear(
  itemStats: ItemStatEntity[],
  targetStats: TargetStats
): OptimizedBuild {
  // Initialize total stats (start with base stats)
  const BASE_STATS = {
    power: 1000,
    precision: 1000,
    toughness: 1000,
    vitality: 1000,
    ferocity: 0,
    conditionDamage: 0,
    expertise: 0,
    concentration: 0,
    healingPower: 0
  }

  const totalStats = { ...BASE_STATS }
  const slots: GearSlot[] = []

  // For each gear slot, find the itemstat that gets us closest to target
  for (const gearSlot of ASCENDED_GEAR_SLOTS) {
    let bestItemStat: ItemStatEntity | null = null
    let bestDistance = Infinity

    // Try each itemstat and see which minimizes distance
    for (const itemStat of itemStats) {
      // Calculate what our stats would be if we equipped this
      const testStats = { ...totalStats }
      const slotStats = itemStatToStats(itemStat)

      for (const [stat, value] of Object.entries(slotStats)) {
        testStats[stat] = (testStats[stat] || 0) + value * gearSlot.statMultiplier
      }

      // Calculate distance with this choice
      const distance = calculateDistance(testStats, targetStats)

      if (distance < bestDistance) {
        bestDistance = distance
        bestItemStat = itemStat
      }
    }

    // Apply the best choice to our running total
    if (bestItemStat) {
      const slotStats = itemStatToStats(bestItemStat)
      const scaledStats: Record<string, number> = {}

      for (const [stat, value] of Object.entries(slotStats)) {
        const scaledValue = value * gearSlot.statMultiplier
        totalStats[stat] = (totalStats[stat] || 0) + scaledValue
        scaledStats[stat] = scaledValue
      }

      slots.push({
        slot: gearSlot.slot,
        statId: bestItemStat.id,
        statName: bestItemStat.name,
        stats: scaledStats
      })
    }
  }

  return {
    slots,
    totalStats,
    distance: calculateDistance(totalStats, targetStats),
    targetStats
  }
}

/**
 * Get stat recommendations based on target stats
 * Returns the top N itemstats that best match the target distribution
 */
export function getStatRecommendations(
  itemStats: ItemStatEntity[],
  targetStats: TargetStats,
  limit: number = 5
): Array<{ itemStat: ItemStatEntity; score: number }> {
  // Normalize target stats to get target distribution
  const targetValues = Object.values(targetStats).filter(v => v !== undefined) as number[]
  const targetTotal = targetValues.reduce((a, b) => a + b, 0)

  const scores = itemStats.map(itemStat => {
    // Calculate how well this itemstat matches the target distribution
    let score = 0

    for (const attr of itemStat.attributes) {
      const statName = attr.attribute.toLowerCase()
      const targetValue = (targetStats as any)[statName]

      if (targetValue !== undefined && targetValue > 0) {
        // Higher multiplier = more of this stat
        // We want itemstats where high multipliers match high target values
        const targetRatio = targetValue / targetTotal
        const multiplierRatio = attr.multiplier

        // Score increases when ratios are similar
        score += 1 - Math.abs(targetRatio - multiplierRatio)
      }
    }

    return { itemStat, score }
  })

  // Sort by score descending and return top N
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Get optimization presets for gear optimization
 */
export function getOptimizationPresets(): Array<{
  name: string
  description: string
  goal: { type: string; constraints: any[] }
}> {
  return [
    {
      name: 'Max Damage (EP)',
      description: 'Maximize Effective Power for pure DPS',
      goal: {
        type: 'maximize-ep',
        constraints: [],
      },
    },
    {
      name: 'Max Tankiness (EH)',
      description: 'Maximize Effective Health for survivability',
      goal: {
        type: 'maximize-eh',
        constraints: [],
      },
    },
    {
      name: 'Balanced Bruiser (EHP)',
      description: 'Balance damage and tankiness (EP × EH)',
      goal: {
        type: 'maximize-ehp',
        constraints: [],
      },
    },
    {
      name: 'Glass Cannon',
      description: 'Max damage with minimum health threshold',
      goal: {
        type: 'maximize-ep',
        constraints: [
          { stat: 'vitality', min: 1000 }, // Min 11k health
        ],
      },
    },
  ]
}
