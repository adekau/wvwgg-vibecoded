/**
 * Gear Optimizer - MILP-based gear optimization for GW2 builds
 * Uses glpk.js for optimal gear selection
 */

import glpk from 'glpk.js'
import type {
  GearSelection,
  ItemStat,
  OptimizationGoal,
  OptimizationOptions,
  OptimizedGear,
  BaseStats,
  Build,
  ProfessionId,
} from './types'
import { calculateBuildStats, calculateEffectivePower, calculateEffectiveHealth } from './build-calculator'

// ============================================================================
// STAT WEIGHTS FOR OPTIMIZATION
// ============================================================================

/**
 * Get stat multipliers for different gear slots
 * Based on ascended gear values from GW2 Wiki
 */
const SLOT_MULTIPLIERS = {
  // Armor (6 pieces)
  helm: 1.0,
  shoulders: 1.0,
  coat: 1.0,
  gloves: 1.0,
  leggings: 1.0,
  boots: 1.0,

  // Trinkets (6 pieces)
  amulet: 1.57,      // Trinkets give more stats
  ring1: 1.26,
  ring2: 1.26,
  accessory1: 1.26,
  accessory2: 1.26,
  backItem: 0.56,    // Back item gives fewer stats

  // Weapons (typically 2 pieces)
  weaponSet1Main: 1.0,
  weaponSet1Off: 1.0,
} as const

type GearSlotKey = keyof typeof SLOT_MULTIPLIERS

/**
 * Ascended gear base stat values per piece
 * These are multiplied by the stat distribution from ItemStat
 */
const ASCENDED_BASE_VALUE = {
  armor: 125,       // Armor pieces (helm, shoulders, etc.)
  trinket: 125,     // Trinkets use same base, but different multiplier
  weapon: 125,      // Weapons
} as const

// ============================================================================
// OPTIMIZATION ALGORITHM
// ============================================================================

export interface OptimizationResult {
  success: boolean
  gear: GearSelection | null
  stats: BaseStats | null
  improvements: {
    effectivePower: number
    effectiveHealth: number
    effectiveHealthPower: number
  } | null
  message: string
  solveTime?: number
}

/**
 * Optimize gear selection using MILP
 */
export async function optimizeGear(
  currentBuild: Build,
  availableStats: ItemStat[],
  goal: OptimizationGoal,
  options: OptimizationOptions
): Promise<OptimizationResult> {
  const startTime = Date.now()

  try {
    // Filter available stat combinations based on options
    const allowedStats = options.allowedStatCombos
      ? availableStats.filter(s => options.allowedStatCombos!.includes(s.id))
      : availableStats

    if (allowedStats.length === 0) {
      return {
        success: false,
        gear: null,
        stats: null,
        improvements: null,
        message: 'No stat combinations available with current filters',
      }
    }

    // Build MILP problem
    const problem = buildOptimizationProblem(
      currentBuild,
      allowedStats,
      goal,
      options
    )

    // Solve using GLPK
    const GLPK = await glpk()
    const result = await GLPK.solve(problem, {
      msglev: GLPK.GLP_MSG_OFF,
      presol: true,
      cb: {
        call: () => false, // Don't interrupt
        each: 1,
      },
    })

    const solveTime = Date.now() - startTime

    // Check if solution is feasible
    if (result.result.status !== GLPK.GLP_OPT) {
      return {
        success: false,
        gear: null,
        stats: null,
        improvements: null,
        message: 'No feasible solution found. Try relaxing constraints.',
        solveTime,
      }
    }

    // Extract gear selection from solution
    const optimizedGear = extractGearFromSolution(result, allowedStats, currentBuild.gear)

    // Calculate stats for optimized gear
    const optimizedBuild = { ...currentBuild, gear: optimizedGear }
    const itemStatsMap = new Map(allowedStats.map(s => [s.id, s]))
    const optimizedStats = calculateBuildStats(optimizedBuild, itemStatsMap, new Map())

    // Calculate current stats for comparison
    const currentStats = calculateBuildStats(currentBuild, itemStatsMap, new Map())

    // Calculate improvements
    const improvements = {
      effectivePower: optimizedStats.effectivePower - currentStats.effectivePower,
      effectiveHealth: optimizedStats.effectiveHealth - currentStats.effectiveHealth,
      effectiveHealthPower: optimizedStats.effectiveHealthPower - currentStats.effectiveHealthPower,
    }

    return {
      success: true,
      gear: optimizedGear,
      stats: optimizedStats,
      improvements,
      message: `Optimization complete! EP +${improvements.effectivePower.toFixed(0)}, EH +${improvements.effectiveHealth.toFixed(0)}`,
      solveTime,
    }
  } catch (error) {
    return {
      success: false,
      gear: null,
      stats: null,
      improvements: null,
      message: error instanceof Error ? error.message : 'Optimization failed',
      solveTime: Date.now() - startTime,
    }
  }
}

/**
 * Build GLPK optimization problem
 */
function buildOptimizationProblem(
  currentBuild: Build,
  availableStats: ItemStat[],
  goal: OptimizationGoal,
  options: OptimizationOptions
) {
  // Decision variables: one binary variable per (slot, stat_combo) pair
  const slots = Object.keys(SLOT_MULTIPLIERS) as GearSlotKey[]
  const variables: Record<string, any> = {}

  // Create binary decision variables for each slot-stat combination
  for (const slot of slots) {
    for (const stat of availableStats) {
      const varName = `${slot}_${stat.id}`
      variables[varName] = {
        type: 'binary',
      }
    }
  }

  // Build objective function based on goal
  const objective = buildObjectiveFunction(goal, availableStats, slots, currentBuild.profession)

  // Build constraints
  const subjectTo = buildConstraints(goal, availableStats, slots, options)

  return {
    name: 'GW2 Gear Optimization',
    objective: {
      direction: goal.type === 'custom' ? 1 : 1, // Maximize (GLPK uses 1 for max)
      name: 'objective',
      vars: objective,
    },
    subjectTo,
    binaries: Object.keys(variables),
  }
}

/**
 * Build objective function for optimization goal
 */
function buildObjectiveFunction(
  goal: OptimizationGoal,
  stats: ItemStat[],
  slots: readonly GearSlotKey[],
  profession: ProfessionId
): Record<string, number> {
  const objective: Record<string, number> = {}

  // Coefficient for each stat type based on goal
  const statWeights = getStatWeights(goal)

  // Calculate total stat contribution for each slot-stat combination
  for (const slot of slots) {
    const multiplier = SLOT_MULTIPLIERS[slot]

    for (const stat of stats) {
      const varName = `${slot}_${stat.id}`
      let totalValue = 0

      // Sum weighted stat values
      for (const attr of stat.attributes) {
        const weight = getAttributeWeight(attr.attribute, statWeights)
        // attr.value is the stat contribution for ascended gear
        totalValue += attr.value * multiplier * weight
      }

      objective[varName] = totalValue
    }
  }

  return objective
}

/**
 * Get stat weights based on optimization goal
 */
function getStatWeights(goal: OptimizationGoal): Record<string, number> {
  switch (goal.type) {
    case 'maximize-ep':
      // Maximize Effective Power: prioritize Power, Precision, Ferocity
      return {
        Power: 1.0,
        Precision: 0.8,   // High value (affects crit chance)
        Ferocity: 0.7,    // High value (affects crit damage)
        Toughness: 0.0,
        Vitality: 0.0,
        ConditionDamage: 0.0,
        Expertise: 0.0,
        Concentration: 0.0,
        Healing: 0.0,
      }

    case 'maximize-eh':
      // Maximize Effective Health: prioritize Vitality, Toughness
      return {
        Power: 0.0,
        Precision: 0.0,
        Ferocity: 0.0,
        Toughness: 1.0,
        Vitality: 1.2,    // Slightly prefer vitality (more direct health)
        ConditionDamage: 0.0,
        Expertise: 0.0,
        Concentration: 0.0,
        Healing: 0.0,
      }

    case 'maximize-ehp':
      // Maximize EP × EH: balance offense and defense
      return {
        Power: 0.7,
        Precision: 0.6,
        Ferocity: 0.5,
        Toughness: 0.7,
        Vitality: 0.8,
        ConditionDamage: 0.0,
        Expertise: 0.0,
        Concentration: 0.0,
        Healing: 0.0,
      }

    case 'maximize-dps':
      // Pure DPS: heavily favor Power and crit stats
      return {
        Power: 1.2,
        Precision: 1.0,
        Ferocity: 0.9,
        Toughness: 0.0,
        Vitality: 0.0,
        ConditionDamage: 0.0,
        Expertise: 0.0,
        Concentration: 0.0,
        Healing: 0.0,
      }

    case 'custom':
      // TODO: Parse custom formula
      return {
        Power: 1.0,
        Precision: 1.0,
        Ferocity: 1.0,
        Toughness: 1.0,
        Vitality: 1.0,
        ConditionDamage: 1.0,
        Expertise: 1.0,
        Concentration: 1.0,
        Healing: 1.0,
      }

    default:
      return {}
  }
}

/**
 * Map attribute name to weight
 */
function getAttributeWeight(attribute: string, weights: Record<string, number>): number {
  const normalized = attribute.replace('CritDamage', 'Ferocity')
    .replace('BoonDuration', 'Concentration')
    .replace('ConditionDuration', 'Expertise')
    .replace('HealingPower', 'Healing')

  return weights[normalized] || 0
}

/**
 * Build constraints for optimization
 */
function buildConstraints(
  goal: OptimizationGoal,
  stats: ItemStat[],
  slots: readonly GearSlotKey[],
  options: OptimizationOptions
): any[] {
  const constraints: any[] = []

  // Constraint 1: Each slot must have exactly one stat combination
  for (const slot of slots) {
    const vars: Record<string, number> = {}
    for (const stat of stats) {
      vars[`${slot}_${stat.id}`] = 1
    }
    constraints.push({
      name: `slot_${slot}`,
      vars,
      bnds: { type: 'fixed', ub: 1, lb: 1 }, // Exactly 1
    })
  }

  // Constraint 2: Minimum/maximum stat constraints from goal
  for (const constraint of goal.constraints) {
    const vars: Record<string, number> = {}

    for (const slot of slots) {
      const multiplier = SLOT_MULTIPLIERS[slot]

      for (const stat of stats) {
        const varName = `${slot}_${stat.id}`

        // Find the attribute value for this constraint
        const attr = stat.attributes.find(a =>
          normalizeAttributeName(a.attribute) === String(constraint.stat)
        )

        if (attr) {
          vars[varName] = attr.value * multiplier
        }
      }
    }

    if (constraint.min !== undefined) {
      constraints.push({
        name: `min_${String(constraint.stat)}`,
        vars,
        bnds: { type: 'lower', ub: 0, lb: constraint.min },
      })
    }

    if (constraint.max !== undefined) {
      constraints.push({
        name: `max_${String(constraint.stat)}`,
        vars,
        bnds: { type: 'upper', ub: constraint.max, lb: 0 },
      })
    }

    if (constraint.target !== undefined) {
      constraints.push({
        name: `target_${String(constraint.stat)}`,
        vars,
        bnds: { type: 'fixed', ub: constraint.target, lb: constraint.target },
      })
    }
  }

  return constraints
}

/**
 * Normalize attribute names for consistency
 */
function normalizeAttributeName(attr: string): string {
  const map: Record<string, string> = {
    Power: 'power',
    Precision: 'precision',
    Toughness: 'toughness',
    Vitality: 'vitality',
    CritDamage: 'ferocity',
    Ferocity: 'ferocity',
    ConditionDamage: 'conditionDamage',
    Expertise: 'expertise',
    ConditionDuration: 'expertise',
    Concentration: 'concentration',
    BoonDuration: 'concentration',
    Healing: 'healingPower',
    HealingPower: 'healingPower',
  }
  return map[attr] || attr.toLowerCase()
}

/**
 * Extract gear selection from MILP solution
 */
function extractGearFromSolution(
  result: any,
  stats: ItemStat[],
  currentGear: GearSelection
): GearSelection {
  const newGear = { ...currentGear }
  const slots = Object.keys(SLOT_MULTIPLIERS) as GearSlotKey[]

  for (const slot of slots) {
    for (const stat of stats) {
      const varName = `${slot}_${stat.id}`
      const value = result.result.vars[varName]

      // If variable is 1 (selected), assign this stat to the slot
      if (value && value > 0.5) {
        // Update the gear piece with the selected stat
        const currentPiece = newGear[slot as keyof GearSelection]
        if (currentPiece && typeof currentPiece === 'object' && 'statId' in currentPiece) {
          ;(newGear[slot as keyof GearSelection] as any) = {
            ...currentPiece,
            statId: stat.id,
          }
        }
      }
    }
  }

  return newGear
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick optimization presets
 */
export function getOptimizationPresets(): Array<{
  name: string
  description: string
  goal: OptimizationGoal
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
