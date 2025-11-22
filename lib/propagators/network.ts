/**
 * Network - Manages the propagator network and provides high-level API
 *
 * The Network class manages cells and propagators, provides a clean API for
 * building constraint networks, and handles conflict detection.
 */

import { Cell, numericMerge, overwriteMerge, type CellValue } from './cell'
import { Propagator, type PropagatorFunction } from './propagator'

export interface NetworkState {
  cells: Record<string, CellValue>
  conflicts: string[]
}

/**
 * Network class - manages cells and propagators
 */
export class Network {
  private cells: Map<string, Cell> = new Map()
  private propagators: Set<Propagator> = new Set()
  private conflicts: string[] = []

  /**
   * Create a new cell in the network
   */
  createCell<T extends CellValue = CellValue>(
    name: string,
    initialValue?: T,
    mergeFn?: (a: T, b: T) => { value: CellValue; conflict: boolean; reason?: string }
  ): Cell<T> {
    if (this.cells.has(name)) {
      throw new Error(`Cell ${name} already exists in network`)
    }

    const cell = new Cell<T>(name, initialValue, mergeFn)
    this.cells.set(name, cell as Cell)
    return cell
  }

  /**
   * Get an existing cell by name
   */
  getCell(name: string): Cell | undefined {
    return this.cells.get(name)
  }

  /**
   * Get or create a cell
   */
  getOrCreateCell<T extends CellValue = CellValue>(
    name: string,
    initialValue?: T,
    mergeFn?: (a: T, b: T) => { value: CellValue; conflict: boolean; reason?: string }
  ): Cell<T> {
    const existing = this.cells.get(name)
    if (existing) {
      return existing as Cell<T>
    }
    return this.createCell(name, initialValue, mergeFn)
  }

  /**
   * Create a propagator in the network
   */
  createPropagator(
    name: string,
    inputs: Record<string, Cell>,
    outputs: Record<string, Cell>,
    forward?: PropagatorFunction,
    inverse?: Record<string, PropagatorFunction>
  ): Propagator {
    const propagator = new Propagator({
      name,
      inputs,
      outputs,
      forward,
      inverse
    })

    this.propagators.add(propagator)
    return propagator
  }

  /**
   * Set a value in a cell (creates cell if it doesn't exist)
   */
  setValue(cellName: string, value: CellValue): void {
    try {
      const cell = this.getOrCreateCell(cellName, undefined, numericMerge)
      cell.setValue(value)
    } catch (error) {
      this.conflicts.push(`${cellName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get a value from a cell
   */
  getValue(cellName: string): CellValue | undefined {
    return this.cells.get(cellName)?.getValue()
  }

  /**
   * Get all cell values as a plain object
   */
  getState(): NetworkState {
    const cells: Record<string, CellValue> = {}
    for (const [name, cell] of this.cells) {
      cells[name] = cell.getValue()
    }

    return {
      cells,
      conflicts: [...this.conflicts]
    }
  }

  /**
   * Reset all cells in the network
   */
  reset(): void {
    for (const cell of this.cells.values()) {
      cell.reset()
    }
    this.conflicts = []
  }

  /**
   * Clear all conflicts
   */
  clearConflicts(): void {
    this.conflicts = []
  }

  /**
   * Get all conflicts
   */
  getConflicts(): string[] {
    return [...this.conflicts]
  }

  /**
   * Check if network has any conflicts
   */
  hasConflicts(): boolean {
    return this.conflicts.length > 0
  }

  /**
   * Remove all cells and propagators
   */
  clear(): void {
    // Disconnect all propagators
    for (const propagator of this.propagators) {
      propagator.disconnect()
    }

    this.cells.clear()
    this.propagators.clear()
    this.conflicts = []
  }

  /**
   * Get debug information about the network
   */
  debug(): string {
    const lines: string[] = []
    lines.push('=== Network Debug ===')
    lines.push(`Cells: ${this.cells.size}`)
    for (const [name, cell] of this.cells) {
      lines.push(`  ${cell.toString()} (${cell.getNeighbors().size} neighbors)`)
    }
    lines.push(`Propagators: ${this.propagators.size}`)
    for (const propagator of this.propagators) {
      lines.push(`  ${propagator.toString()}`)
    }
    if (this.conflicts.length > 0) {
      lines.push(`Conflicts: ${this.conflicts.length}`)
      for (const conflict of this.conflicts) {
        lines.push(`  ⚠️  ${conflict}`)
      }
    }
    return lines.join('\n')
  }

  /**
   * Get statistics about the network
   */
  getStats(): {
    cellCount: number
    propagatorCount: number
    cellsWithValues: number
    conflictCount: number
  } {
    let cellsWithValues = 0
    for (const cell of this.cells.values()) {
      if (cell.hasValue()) cellsWithValues++
    }

    return {
      cellCount: this.cells.size,
      propagatorCount: this.propagators.size,
      cellsWithValues,
      conflictCount: this.conflicts.length
    }
  }
}

/**
 * Create a new propagator network
 */
export function createNetwork(): Network {
  return new Network()
}
