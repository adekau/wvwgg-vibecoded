/**
 * Build Calculator - Uses propagator network with GW2 game data
 *
 * This module creates a propagator network initialized with stat formulas
 * from the database, allowing bidirectional editing of character builds.
 */

import { createNetwork, type Network } from './network'
import { bidirectionalPropagator } from './propagator'
import type { StatFormulaEntity } from '@/lib/gw2/build-data-types'

/**
 * Character base stats (from GW2 wiki)
 * These are the minimum stats all level 80 characters have
 */
export const BASE_STATS = {
  power: 1000,
  precision: 1000,
  toughness: 1000,
  vitality: 1000,
  ferocity: 0,
  conditionDamage: 0,
  expertise: 0,
  concentration: 0,
  agony: 0,
  healingPower: 0
} as const

/**
 * Derived stat thresholds (from GW2 formulas)
 */
export const STAT_THRESHOLDS = {
  precision: 895, // Base for crit chance calculation
  ferocity: 0, // Base for crit damage (starts at 150%)
  expertise: 0, // Base for condition duration
  concentration: 0 // Base for boon duration
} as const

/**
 * Build state represents the current character build
 */
export interface BuildState {
  // Base stats (from gear)
  power: number
  precision: number
  toughness: number
  vitality: number
  ferocity: number
  conditionDamage: number
  expertise: number
  concentration: number
  healingPower: number

  // Derived stats (calculated)
  critChance?: number
  critDamage?: number
  conditionDuration?: number
  boonDuration?: number
  effectivePower?: number
  health?: number
}

/**
 * Create a build calculator network from stat formulas
 */
export function createBuildCalculator(formulas: StatFormulaEntity[]): Network {
  const network = createNetwork()

  // Create cells for all base stats
  for (const [stat, baseValue] of Object.entries(BASE_STATS)) {
    network.createCell(stat, baseValue)
  }

  // Create cells for derived stats
  network.createCell<number>('critChance')
  network.createCell<number>('critDamage')
  network.createCell<number>('conditionDuration')
  network.createCell<number>('boonDuration')
  network.createCell<number>('effectivePower')
  network.createCell<number>('health')

  // Add propagators from formulas
  for (const formula of formulas) {
    addFormulaPropagator(network, formula)
  }

  return network
}

/**
 * Add a propagator to the network from a stat formula entity
 */
function addFormulaPropagator(network: Network, formula: StatFormulaEntity): void {
  const { stat, inputStats, forwardFunction, inverseFunctions } = formula

  // Parse the forward function
  const forward = parseFunctionString(forwardFunction)
  if (!forward) {
    console.warn(`Failed to parse forward function for ${stat}:`, forwardFunction)
    return
  }

  // Parse inverse functions if available
  const inverseMap: Record<string, (inputs: Record<string, any>) => number | undefined> = {}
  if (inverseFunctions && formula.bidirectionalFormulas?.inverse) {
    for (let i = 0; i < inverseFunctions.length; i++) {
      const inverseFn = parseFunctionString(inverseFunctions[i])
      const inputStat = inputStats[i]
      if (inverseFn && inputStat) {
        inverseMap[inputStat] = inverseFn
      }
    }
  }

  // Get input cells
  const inputCells: Record<string, any> = {}
  for (const inputStat of inputStats) {
    const cell = network.getCell(inputStat)
    if (cell) {
      inputCells[inputStat] = cell
    }
  }

  // Get output cell
  const outputCell = network.getCell(stat)
  if (!outputCell) {
    console.warn(`Output cell not found for stat: ${stat}`)
    return
  }

  // Create the propagator
  network.createPropagator(
    `formula-${stat}`,
    inputCells,
    { [stat]: outputCell },
    forward,
    inverseMap
  )
}

/**
 * Parse a serialized function string into an actual function
 * Handles both arrow functions and regular functions
 */
function parseFunctionString(
  fnString: string
): ((inputs: Record<string, any>) => number | undefined) | null {
  try {
    // Remove whitespace
    const cleaned = fnString.trim()

    // Try to extract the function body and parameters
    // Format: (param1, param2, ...) => expression
    const arrowMatch = cleaned.match(/^\((.*?)\)\s*=>\s*(.+)$/)
    if (arrowMatch) {
      const params = arrowMatch[1].split(',').map(p => p.trim())
      const body = arrowMatch[2]

      // Create function that takes inputs object and extracts parameters
      return (inputs: Record<string, any>) => {
        try {
          // Create local variables from inputs
          const localVars: Record<string, any> = {}
          for (const param of params) {
            localVars[param] = inputs[param]
          }

          // Evaluate the expression with local context
          // eslint-disable-next-line no-new-func
          const fn = new Function(...params, `return ${body}`)
          const result = fn(...params.map(p => localVars[p]))

          return typeof result === 'number' ? result : undefined
        } catch (error) {
          console.error('Error evaluating function:', error)
          return undefined
        }
      }
    }

    // Fallback: try to eval as-is (less safe but might work)
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return ${cleaned}`)()
    if (typeof fn === 'function') {
      return (inputs: Record<string, any>) => {
        try {
          // Try calling with inputs object
          const result = fn(inputs)
          return typeof result === 'number' ? result : undefined
        } catch {
          // Try calling with individual parameters
          const values = Object.values(inputs)
          const result = fn(...values)
          return typeof result === 'number' ? result : undefined
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing function string:', error)
    return null
  }
}

/**
 * Get the current build state from the network
 */
export function getBuildState(network: Network): BuildState {
  const state = network.getState()

  return {
    // Base stats
    power: (state.cells.power as number) ?? BASE_STATS.power,
    precision: (state.cells.precision as number) ?? BASE_STATS.precision,
    toughness: (state.cells.toughness as number) ?? BASE_STATS.toughness,
    vitality: (state.cells.vitality as number) ?? BASE_STATS.vitality,
    ferocity: (state.cells.ferocity as number) ?? BASE_STATS.ferocity,
    conditionDamage: (state.cells.conditionDamage as number) ?? BASE_STATS.conditionDamage,
    expertise: (state.cells.expertise as number) ?? BASE_STATS.expertise,
    concentration: (state.cells.concentration as number) ?? BASE_STATS.concentration,
    healingPower: (state.cells.healingPower as number) ?? BASE_STATS.healingPower,

    // Derived stats
    critChance: state.cells.critChance as number | undefined,
    critDamage: state.cells.critDamage as number | undefined,
    conditionDuration: state.cells.conditionDuration as number | undefined,
    boonDuration: state.cells.boonDuration as number | undefined,
    effectivePower: state.cells.effectivePower as number | undefined,
    health: state.cells.health as number | undefined
  }
}

/**
 * Update base stats in the network (e.g., when gear changes)
 */
export function updateBaseStats(network: Network, stats: Partial<BuildState>): void {
  for (const [stat, value] of Object.entries(stats)) {
    if (value !== undefined) {
      network.setValue(stat, value)
    }
  }
}

/**
 * Calculate total stats from gear pieces
 * This would be used to compute base stats from selected gear
 */
export interface GearPiece {
  slot: string
  statId: number
  upgradeIds: number[] // rune/sigil IDs
}

/**
 * Create a simple build calculator with hardcoded GW2 formulas
 * Use this when database formulas are not available
 */
export function createSimpleBuildCalculator(): Network {
  const network = createNetwork()

  // Create base stat cells
  const power = network.createCell('power', BASE_STATS.power)
  const precision = network.createCell('precision', BASE_STATS.precision)
  const ferocity = network.createCell('ferocity', BASE_STATS.ferocity)
  const vitality = network.createCell('vitality', BASE_STATS.vitality)

  // Create derived stat cells
  const critChance = network.createCell<number>('critChance')
  const critDamage = network.createCell<number>('critDamage')
  const effectivePower = network.createCell<number>('effectivePower')
  const health = network.createCell<number>('health')

  // Add GW2 stat formulas

  // Critical Chance = (Precision - 895) / 21 (capped at 100%)
  bidirectionalPropagator(
    'precision-critChance',
    precision,
    critChance,
    (p) => Math.min(100, Math.max(0, ((p as number) - STAT_THRESHOLDS.precision) / 21)),
    (c) => (c as number) * 21 + STAT_THRESHOLDS.precision
  )

  // Critical Damage = 150 + Ferocity / 15
  bidirectionalPropagator(
    'ferocity-critDamage',
    ferocity,
    critDamage,
    (f) => 150 + (f as number) / 15,
    (c) => ((c as number) - 150) * 15
  )

  // Effective Power = Power * (1 + CritChance/100 * (CritDamage/100 - 1))
  network.createPropagator(
    'effectivePower',
    { power, critChance, critDamage },
    { effectivePower },
    (inputs) => {
      const p = inputs.power as number
      const cc = (inputs.critChance as number) ?? 0
      const cd = (inputs.critDamage as number) ?? 150
      return p * (1 + (cc / 100) * (cd / 100 - 1))
    }
  )

  // Health = Vitality * 10 + 1645 (base health for level 80)
  bidirectionalPropagator(
    'vitality-health',
    vitality,
    health,
    (v) => (v as number) * 10 + 1645,
    (h) => ((h as number) - 1645) / 10
  )

  return network
}

/**
 * Format a stat value for display
 */
export function formatStatValue(stat: string, value: number | undefined): string {
  if (value === undefined) return '?'

  // Percentage stats
  if (['critChance', 'critDamage', 'conditionDuration', 'boonDuration'].includes(stat)) {
    return `${value.toFixed(2)}%`
  }

  // Regular stats (round to nearest integer)
  return Math.round(value).toString()
}
