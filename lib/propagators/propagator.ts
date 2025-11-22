/**
 * Propagator - Bidirectional constraint between cells
 *
 * A Propagator connects input and output cells with constraint functions.
 * When activated, it computes new values and propagates them to connected cells.
 */

import type { Cell, CellValue } from './cell'

export type PropagatorFunction = (inputs: Record<string, CellValue>) => CellValue | undefined

export interface PropagatorConfig {
  name: string
  inputs: Record<string, Cell>
  outputs: Record<string, Cell>
  forward?: PropagatorFunction
  inverse?: Record<string, PropagatorFunction>
}

/**
 * Propagator class - implements a constraint between cells
 */
export class Propagator {
  private readonly name: string
  private readonly inputs: Record<string, Cell>
  private readonly outputs: Record<string, Cell>
  private readonly forward?: PropagatorFunction
  private readonly inverse?: Record<string, PropagatorFunction>
  private active: boolean = false

  constructor(config: PropagatorConfig) {
    this.name = config.name
    this.inputs = config.inputs
    this.outputs = config.outputs
    this.forward = config.forward
    this.inverse = config.inverse

    // Register this propagator with all input cells
    Object.values(this.inputs).forEach(cell => cell.addNeighbor(this))

    // Also register with output cells for bidirectional propagation
    Object.values(this.outputs).forEach(cell => cell.addNeighbor(this))

    // Trigger initial propagation if cells already have values
    this.activate()
  }

  /**
   * Activate this propagator (called by cells when they change)
   */
  activate(): void {
    if (this.active) return // Already in queue
    this.active = true

    // Schedule execution on next tick to batch multiple activations
    queueMicrotask(() => {
      this.execute()
      this.active = false
    })
  }

  /**
   * Execute the propagator's constraint function
   */
  private execute(): void {
    // Determine if this is a bidirectional propagator
    const isBidirectional = this.inverse && Object.keys(this.inverse).length > 0

    // Try forward propagation: inputs -> outputs
    if (this.forward && this.allInputsHaveValues()) {
      const inputValues = this.getInputValues()
      const outputValue = this.forward(inputValues)

      if (outputValue !== undefined) {
        // Assume single output for now (can extend for multiple outputs)
        const outputCell = Object.values(this.outputs)[0]
        if (outputCell) {
          // In bidirectional mode, prefer user-set output values over computed values
          // Only update output if it doesn't have a value or if the inverse doesn't exist
          const shouldUpdate = !isBidirectional || !outputCell.hasValue()

          if (shouldUpdate) {
            try {
              outputCell.setValue(outputValue)
            } catch (error) {
              console.error(`Propagator ${this.name} forward propagation failed:`, error)
            }
          }
        }
      }
    }

    // Try inverse propagation: outputs -> inputs
    if (this.inverse) {
      for (const [inputName, inverseFunc] of Object.entries(this.inverse)) {
        const inputCell = this.inputs[inputName]
        if (!inputCell) continue

        // Check if output cell has a value to propagate from
        const outputValues = this.getOutputValues()
        const otherInputValues = this.getOtherInputValues(inputName)

        if (Object.keys(outputValues).length > 0 || Object.keys(otherInputValues).length > 0) {
          const allValues = { ...outputValues, ...otherInputValues }
          const inputValue = inverseFunc(allValues)

          if (inputValue !== undefined) {
            try {
              // setValue will handle detecting if value actually changed
              // If value is unchanged, it returns false and no propagation occurs
              inputCell.setValue(inputValue)
            } catch (error) {
              console.error(`Propagator ${this.name} inverse propagation failed:`, error)
            }
          }
        }
      }
    }
  }

  /**
   * Check if all input cells have values
   */
  private allInputsHaveValues(): boolean {
    return Object.values(this.inputs).every(cell => cell.hasValue())
  }

  /**
   * Get current values from all input cells
   */
  private getInputValues(): Record<string, CellValue> {
    const values: Record<string, CellValue> = {}
    for (const [name, cell] of Object.entries(this.inputs)) {
      values[name] = cell.getValue()
    }
    return values
  }

  /**
   * Get current values from all output cells
   */
  private getOutputValues(): Record<string, CellValue> {
    const values: Record<string, CellValue> = {}
    for (const [name, cell] of Object.entries(this.outputs)) {
      const value = cell.getValue()
      if (value !== undefined) {
        values[name] = value
      }
    }
    return values
  }

  /**
   * Get values from all input cells except the specified one
   */
  private getOtherInputValues(excludeName: string): Record<string, CellValue> {
    const values: Record<string, CellValue> = {}
    for (const [name, cell] of Object.entries(this.inputs)) {
      if (name !== excludeName) {
        const value = cell.getValue()
        if (value !== undefined) {
          values[name] = value
        }
      }
    }
    return values
  }

  /**
   * Get the name of this propagator (for debugging)
   */
  getName(): string {
    return this.name
  }

  /**
   * Disconnect this propagator from all cells
   */
  disconnect(): void {
    Object.values(this.inputs).forEach(cell => cell.removeNeighbor(this))
    Object.values(this.outputs).forEach(cell => cell.removeNeighbor(this))
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const inputNames = Object.keys(this.inputs).join(', ')
    const outputNames = Object.keys(this.outputs).join(', ')
    return `Propagator(${this.name}: [${inputNames}] -> [${outputNames}])`
  }
}

/**
 * Helper function to create a simple unidirectional propagator
 */
export function unidirectionalPropagator(
  name: string,
  inputCell: Cell,
  outputCell: Cell,
  func: (input: CellValue) => CellValue
): Propagator {
  return new Propagator({
    name,
    inputs: { input: inputCell },
    outputs: { output: outputCell },
    forward: (inputs) => func(inputs.input)
  })
}

/**
 * Helper function to create a bidirectional propagator
 */
export function bidirectionalPropagator(
  name: string,
  cellA: Cell,
  cellB: Cell,
  forwardFunc: (a: CellValue) => CellValue,
  inverseFunc: (b: CellValue) => CellValue
): Propagator {
  return new Propagator({
    name,
    inputs: { a: cellA },
    outputs: { b: cellB },
    forward: (inputs) => forwardFunc(inputs.a),
    inverse: {
      a: (outputs) => inverseFunc(outputs.b)
    }
  })
}
