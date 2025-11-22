/**
 * Propagator Network - Bidirectional constraint propagation system
 *
 * This module implements a propagator network for bidirectional editing
 * of GW2 character builds. It supports:
 *
 * - Reactive cells that hold values
 * - Bidirectional propagators that enforce constraints
 * - Intelligent value merging and conflict detection
 * - Network-wide propagation scheduling
 *
 * @example
 * ```typescript
 * import { createNetwork, bidirectionalPropagator } from '@/lib/propagators'
 *
 * const network = createNetwork()
 *
 * // Create cells
 * const precision = network.createCell('precision', 1500)
 * const critChance = network.createCell('critChance')
 *
 * // Create bidirectional propagator
 * bidirectionalPropagator(
 *   'precision-critChance',
 *   precision,
 *   critChance,
 *   (p) => (p as number - 895) / 21,  // forward
 *   (c) => (c as number) * 21 + 895   // inverse
 * )
 *
 * console.log(critChance.getValue()) // ~28.81
 *
 * // Change critChance, precision updates automatically
 * critChance.setValue(50)
 * console.log(precision.getValue()) // ~1945
 * ```
 */

export { Cell, numericMerge, overwriteMerge, intervalMerge } from './cell'
export type { CellValue, CellMergeResult } from './cell'

export { Propagator, unidirectionalPropagator, bidirectionalPropagator } from './propagator'
export type { PropagatorFunction, PropagatorConfig } from './propagator'

export { Network, createNetwork } from './network'
export type { NetworkState } from './network'
