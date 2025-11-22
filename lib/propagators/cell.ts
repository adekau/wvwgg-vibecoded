/**
 * Cell - Reactive value container for propagator networks
 *
 * A Cell holds a value and notifies connected propagators when the value changes.
 * Cells support partial information and can merge values intelligently.
 */

import type { Propagator } from './propagator'

export type CellValue = number | string | boolean | undefined | null

export interface CellMergeResult {
  value: CellValue
  conflict: boolean
  reason?: string
}

/**
 * Cell class - holds a value and manages propagation to neighbors
 */
export class Cell<T extends CellValue = CellValue> {
  private value: T | undefined
  private neighbors: Set<Propagator> = new Set()
  private readonly name: string
  private readonly mergeFn?: (a: T, b: T) => CellMergeResult

  constructor(name: string, initialValue?: T, mergeFn?: (a: T, b: T) => CellMergeResult) {
    this.name = name
    this.value = initialValue
    this.mergeFn = mergeFn
  }

  /**
   * Get the current value of the cell
   */
  getValue(): T | undefined {
    return this.value
  }

  /**
   * Set a new value in the cell and propagate changes
   * @returns true if value changed, false otherwise
   */
  setValue(newValue: T | undefined): boolean {
    // If value unchanged, no propagation needed
    if (this.value === newValue) {
      return false
    }

    // If cell has no value yet, just set it
    if (this.value === undefined) {
      this.value = newValue
      this.propagate()
      return true
    }

    // If new value is undefined, keep existing value (no-op)
    if (newValue === undefined) {
      return false
    }

    // Merge the values if merge function provided
    if (this.mergeFn) {
      const result = this.mergeFn(this.value, newValue as T)

      if (result.conflict) {
        throw new Error(
          `Conflict in cell ${this.name}: Cannot merge ${this.value} and ${newValue}. ${result.reason || ''}`
        )
      }

      if (this.value === result.value) {
        return false // Merge didn't change value
      }

      this.value = result.value as T
      this.propagate()
      return true
    }

    // Default: replace value
    this.value = newValue
    this.propagate()
    return true
  }

  /**
   * Add a propagator neighbor to this cell
   */
  addNeighbor(propagator: Propagator): void {
    this.neighbors.add(propagator)
  }

  /**
   * Remove a propagator neighbor from this cell
   */
  removeNeighbor(propagator: Propagator): void {
    this.neighbors.delete(propagator)
  }

  /**
   * Get all neighbor propagators
   */
  getNeighbors(): Set<Propagator> {
    return new Set(this.neighbors)
  }

  /**
   * Notify all neighbors that this cell has changed
   */
  private propagate(): void {
    for (const neighbor of this.neighbors) {
      neighbor.activate()
    }
  }

  /**
   * Get the name of this cell (for debugging)
   */
  getName(): string {
    return this.name
  }

  /**
   * Check if cell has a value
   */
  hasValue(): boolean {
    return this.value !== undefined && this.value !== null
  }

  /**
   * Reset the cell to undefined
   */
  reset(): void {
    this.value = undefined
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `Cell(${this.name}: ${this.value ?? 'undefined'})`
  }
}

/**
 * Default merge function for numeric cells
 * Uses interval intersection logic
 */
export function numericMerge(a: number, b: number): CellMergeResult {
  // If values are close enough (within 0.01), consider them equal
  const epsilon = 0.01
  if (Math.abs(a - b) < epsilon) {
    return { value: (a + b) / 2, conflict: false }
  }

  // Otherwise it's a conflict
  return {
    value: a,
    conflict: true,
    reason: `Numeric values differ: ${a} != ${b}`
  }
}

/**
 * Merge function that always takes the newer value
 */
export function overwriteMerge<T extends CellValue>(a: T, b: T): CellMergeResult {
  return { value: b, conflict: false }
}

/**
 * Merge function for intervals (min/max ranges)
 */
export function intervalMerge(
  a: { min: number; max: number },
  b: { min: number; max: number }
): CellMergeResult {
  const newMin = Math.max(a.min, b.min)
  const newMax = Math.min(a.max, b.max)

  if (newMin > newMax) {
    return {
      value: a as any,
      conflict: true,
      reason: `Interval intersection empty: [${a.min}, ${a.max}] ∩ [${b.min}, ${b.max}] = ∅`
    }
  }

  return {
    value: { min: newMin, max: newMax } as any,
    conflict: false
  }
}
