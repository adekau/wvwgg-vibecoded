/**
 * Tests for the propagator network engine
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createNetwork, bidirectionalPropagator, Cell, numericMerge } from '@/lib/propagators'

describe('Propagator Engine', () => {
  describe('Cell', () => {
    it('should store and retrieve values', () => {
      const network = createNetwork()
      const cell = network.createCell('test', 42)

      expect(cell.getValue()).toBe(42)
      expect(cell.hasValue()).toBe(true)
    })

    it('should notify neighbors when value changes', async () => {
      const network = createNetwork()
      const inputCell = network.createCell('input', 10)
      const outputCell = network.createCell<number>('output')

      // Create a simple propagator: output = input * 2
      network.createPropagator(
        'double',
        { input: inputCell },
        { output: outputCell },
        (inputs) => (inputs.input as number) * 2
      )

      // Give propagation time to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(outputCell.getValue()).toBe(20)
    })

    it('should detect conflicts with numeric merge', () => {
      const network = createNetwork()
      const cell = network.createCell('test', 100, numericMerge)

      expect(() => cell.setValue(200)).toThrow(/Conflict/)
    })

    it('should allow similar values with numeric merge', () => {
      const network = createNetwork()
      const cell = network.createCell('test', 100.005, numericMerge)

      // Within epsilon (0.01), should merge
      expect(() => cell.setValue(100.006)).not.toThrow()
      expect(cell.getValue()).toBeCloseTo(100.0055, 2)
    })
  })

  describe('Bidirectional Propagator', () => {
    it('should propagate forward: precision -> critChance', async () => {
      const network = createNetwork()
      const precision = network.createCell('precision', 1895)
      const critChance = network.createCell<number>('critChance')

      // GW2 formula: critChance = (precision - 895) / 21
      bidirectionalPropagator(
        'precision-critChance',
        precision,
        critChance,
        (p) => ((p as number) - 895) / 21, // forward
        (c) => (c as number) * 21 + 895 // inverse
      )

      await new Promise(resolve => setTimeout(resolve, 10))

      // precision = 1895 -> critChance = (1895 - 895) / 21 = 47.619
      expect(critChance.getValue()).toBeCloseTo(47.619, 2)
    })

    it('should propagate backward: critChance -> precision', async () => {
      const network = createNetwork()
      const precision = network.createCell<number>('precision')
      const critChance = network.createCell('critChance', 50)

      // GW2 formula: critChance = (precision - 895) / 21
      bidirectionalPropagator(
        'precision-critChance',
        precision,
        critChance,
        (p) => ((p as number) - 895) / 21, // forward
        (c) => (c as number) * 21 + 895 // inverse
      )

      await new Promise(resolve => setTimeout(resolve, 10))

      // critChance = 50 -> precision = 50 * 21 + 895 = 1945
      expect(precision.getValue()).toBeCloseTo(1945, 1)
    })

    it('should handle multi-step propagation chains', async () => {
      const network = createNetwork()

      // Chain: power -> effectivePower -> dps
      const power = network.createCell('power', 3000)
      const effectivePower = network.createCell<number>('effectivePower')
      const dps = network.createCell<number>('dps')

      // effectivePower = power * 1.5 (simplified, ignoring crit)
      network.createPropagator(
        'power-effectivePower',
        { power },
        { effectivePower },
        (inputs) => (inputs.power as number) * 1.5
      )

      // dps = effectivePower * 2.5 (weapon coefficient)
      network.createPropagator(
        'effectivePower-dps',
        { effectivePower },
        { dps },
        (inputs) => (inputs.effectivePower as number) * 2.5
      )

      await new Promise(resolve => setTimeout(resolve, 10))

      // power = 3000 -> effectivePower = 4500 -> dps = 11250
      expect(effectivePower.getValue()).toBe(4500)
      expect(dps.getValue()).toBe(11250)
    })
  })

  describe('Network', () => {
    it('should track all cells and propagators', () => {
      const network = createNetwork()

      network.createCell('cell1', 10)
      network.createCell('cell2', 20)
      network.createCell('cell3')

      const stats = network.getStats()
      expect(stats.cellCount).toBe(3)
      expect(stats.cellsWithValues).toBe(2)
    })

    it('should get state as plain object', () => {
      const network = createNetwork()

      network.setValue('power', 3000)
      network.setValue('precision', 2100)

      const state = network.getState()
      expect(state.cells.power).toBe(3000)
      expect(state.cells.precision).toBe(2100)
    })

    it('should reset all cells', async () => {
      const network = createNetwork()

      const cell1 = network.createCell('cell1', 100)
      const cell2 = network.createCell('cell2', 200)

      network.reset()

      expect(cell1.getValue()).toBeUndefined()
      expect(cell2.getValue()).toBeUndefined()
    })

    it('should clear network completely', () => {
      const network = createNetwork()

      network.createCell('cell1', 10)
      network.createCell('cell2', 20)

      const cell1 = network.getCell('cell1')!
      const cell2 = network.getCell('cell2')!

      network.createPropagator(
        'test',
        { input: cell1 },
        { output: cell2 },
        (inputs) => (inputs.input as number) * 2
      )

      network.clear()

      const stats = network.getStats()
      expect(stats.cellCount).toBe(0)
      expect(stats.propagatorCount).toBe(0)
    })
  })

  describe('GW2 Stat Formulas', () => {
    it('should calculate critical damage from ferocity', async () => {
      const network = createNetwork()
      const ferocity = network.createCell('ferocity', 1500)
      const critDamage = network.createCell<number>('critDamage')

      // GW2 formula: critDamage = 150 + ferocity / 15
      bidirectionalPropagator(
        'ferocity-critDamage',
        ferocity,
        critDamage,
        (f) => 150 + (f as number) / 15, // forward
        (c) => ((c as number) - 150) * 15 // inverse
      )

      await new Promise(resolve => setTimeout(resolve, 10))

      // ferocity = 1500 -> critDamage = 150 + 1500/15 = 250%
      expect(critDamage.getValue()).toBe(250)
    })

    it('should calculate effective power from power, critChance, critDamage', async () => {
      const network = createNetwork()

      const power = network.createCell('power', 3000)
      const critChance = network.createCell('critChance', 50) // 50%
      const critDamage = network.createCell('critDamage', 200) // 200%
      const effectivePower = network.createCell<number>('effectivePower')

      // effectivePower = power * (1 + critChance/100 * (critDamage/100 - 1))
      network.createPropagator(
        'effectivePower',
        { power, critChance, critDamage },
        { effectivePower },
        (inputs) => {
          const p = inputs.power as number
          const cc = inputs.critChance as number
          const cd = inputs.critDamage as number
          return p * (1 + (cc / 100) * (cd / 100 - 1))
        }
      )

      await new Promise(resolve => setTimeout(resolve, 10))

      // effectivePower = 3000 * (1 + 0.5 * (2 - 1)) = 3000 * 1.5 = 4500
      expect(effectivePower.getValue()).toBe(4500)
    })

    it('should handle complete stat chain: precision -> critChance -> effectivePower', async () => {
      const network = createNetwork()

      // Base stats
      const precision = network.createCell('precision', 2100)
      const power = network.createCell('power', 3000)
      const ferocity = network.createCell('ferocity', 1500)

      // Derived stats
      const critChance = network.createCell<number>('critChance')
      const critDamage = network.createCell<number>('critDamage')
      const effectivePower = network.createCell<number>('effectivePower')

      // Set up propagators
      bidirectionalPropagator(
        'precision-critChance',
        precision,
        critChance,
        (p) => Math.min(100, ((p as number) - 895) / 21),
        (c) => (c as number) * 21 + 895
      )

      bidirectionalPropagator(
        'ferocity-critDamage',
        ferocity,
        critDamage,
        (f) => 150 + (f as number) / 15,
        (c) => ((c as number) - 150) * 15
      )

      network.createPropagator(
        'effectivePower',
        { power, critChance, critDamage },
        { effectivePower },
        (inputs) => {
          const p = inputs.power as number
          const cc = inputs.critChance as number
          const cd = inputs.critDamage as number
          return p * (1 + (cc / 100) * (cd / 100 - 1))
        }
      )

      await new Promise(resolve => setTimeout(resolve, 20))

      // Verify intermediate calculations
      // precision = 2100 -> critChance = (2100 - 895) / 21 ≈ 57.38%
      expect(critChance.getValue()).toBeCloseTo(57.38, 1)

      // ferocity = 1500 -> critDamage = 150 + 1500/15 = 250%
      expect(critDamage.getValue()).toBe(250)

      // effectivePower = 3000 * (1 + 0.5738 * 1.5) ≈ 5582
      expect(effectivePower.getValue()).toBeCloseTo(5582, 0)
    })
  })

  describe('Conflict Detection', () => {
    it('should detect conflicting values', () => {
      const network = createNetwork()

      network.setValue('power', 3000)
      network.clearConflicts()

      // Try to set a conflicting value
      network.setValue('power', 4000)

      expect(network.hasConflicts()).toBe(true)
      expect(network.getConflicts().length).toBeGreaterThan(0)
    })
  })
})
