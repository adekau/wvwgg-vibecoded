/**
 * Tests for the build calculator
 */

import { describe, it, expect } from 'vitest'
import {
  createSimpleBuildCalculator,
  getBuildState,
  updateBaseStats,
  formatStatValue,
  BASE_STATS
} from '@/lib/propagators/build-calculator'

describe('Build Calculator', () => {
  describe('Simple Build Calculator', () => {
    it('should initialize with base stats', () => {
      const network = createSimpleBuildCalculator()
      const state = getBuildState(network)

      expect(state.power).toBe(BASE_STATS.power)
      expect(state.precision).toBe(BASE_STATS.precision)
      expect(state.ferocity).toBe(BASE_STATS.ferocity)
      expect(state.vitality).toBe(BASE_STATS.vitality)
    })

    it('should calculate critical chance from precision', async () => {
      const network = createSimpleBuildCalculator()

      // Update precision
      updateBaseStats(network, { precision: 1895 })

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)
      // (1895 - 895) / 21 = 47.62%
      expect(state.critChance).toBeCloseTo(47.62, 1)
    })

    it('should calculate precision from critical chance (inverse)', async () => {
      const network = createSimpleBuildCalculator()

      // Set critChance first
      network.setValue('critChance', 50)

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)
      // 50 * 21 + 895 = 1945
      expect(state.precision).toBeCloseTo(1945, 0)
    })

    it('should calculate critical damage from ferocity', async () => {
      const network = createSimpleBuildCalculator()

      updateBaseStats(network, { ferocity: 1500 })

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)
      // 150 + 1500/15 = 250%
      expect(state.critDamage).toBe(250)
    })

    it('should calculate health from vitality', async () => {
      const network = createSimpleBuildCalculator()

      updateBaseStats(network, { vitality: 1500 })

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)
      // 1500 * 10 + 1645 = 16645
      expect(state.health).toBe(16645)
    })

    it('should calculate effective power from power, critChance, critDamage', async () => {
      const network = createSimpleBuildCalculator()

      updateBaseStats(network, {
        power: 3000,
        precision: 2100, // ~57% crit chance
        ferocity: 1500 // 250% crit damage
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      const state = getBuildState(network)

      // Verify intermediate calculations
      expect(state.critChance).toBeCloseTo(57.38, 1)
      expect(state.critDamage).toBe(250)

      // effectivePower = 3000 * (1 + 0.5738 * 1.5)
      expect(state.effectivePower).toBeCloseTo(5582, 0)
    })

    it('should handle bidirectional editing of a complete build', async () => {
      const network = createSimpleBuildCalculator()

      // Start by setting base stats (normal workflow: gear → stats)
      updateBaseStats(network, {
        power: 2500,
        precision: 1700,
        ferocity: 1200,
        vitality: 1200
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      let state = getBuildState(network)

      // Verify derived stats calculated correctly
      expect(state.critChance).toBeCloseTo(38.33, 1) // (1700 - 895) / 21
      expect(state.critDamage).toBe(230) // 150 + 1200/15
      expect(state.health).toBe(13645) // 1200 * 10 + 1645

      // Now edit a derived stat (inverse workflow: stats → gear)
      network.setValue('critChance', 50) // Want 50% crit chance

      await new Promise(resolve => setTimeout(resolve, 20))

      state = getBuildState(network)

      // Precision should update to match desired crit chance
      expect(state.precision).toBeCloseTo(1945, 0) // 50 * 21 + 895
      expect(state.critChance).toBeCloseTo(50, 1)
    })

    it('should cap critical chance at 100%', async () => {
      const network = createSimpleBuildCalculator()

      // Set very high precision
      updateBaseStats(network, { precision: 5000 })

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)

      // Should be capped at 100%
      expect(state.critChance).toBe(100)
    })

    it('should floor critical chance at 0%', async () => {
      const network = createSimpleBuildCalculator()

      // Set very low precision (below threshold)
      updateBaseStats(network, { precision: 500 })

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)

      // Should be floored at 0%
      expect(state.critChance).toBe(0)
    })
  })

  describe('Format Stat Value', () => {
    it('should format percentage stats with decimals', () => {
      expect(formatStatValue('critChance', 47.619)).toBe('47.62%')
      expect(formatStatValue('critDamage', 250.0)).toBe('250.00%')
      expect(formatStatValue('boonDuration', 33.333)).toBe('33.33%')
    })

    it('should format regular stats as integers', () => {
      expect(formatStatValue('power', 3245.7)).toBe('3246')
      expect(formatStatValue('precision', 2100.2)).toBe('2100')
      expect(formatStatValue('health', 16645.0)).toBe('16645')
    })

    it('should handle undefined values', () => {
      expect(formatStatValue('power', undefined)).toBe('?')
      expect(formatStatValue('critChance', undefined)).toBe('?')
    })
  })

  describe('Update Base Stats', () => {
    it('should update multiple stats at once', async () => {
      const network = createSimpleBuildCalculator()

      updateBaseStats(network, {
        power: 3000,
        precision: 2000,
        ferocity: 1500
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      const state = getBuildState(network)

      expect(state.power).toBe(3000)
      expect(state.precision).toBe(2000)
      expect(state.ferocity).toBe(1500)
    })

    it('should ignore undefined values', async () => {
      const network = createSimpleBuildCalculator()

      const initialState = getBuildState(network)

      updateBaseStats(network, {
        power: 3000,
        precision: undefined, // Should not change
        ferocity: undefined // Should not change
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const state = getBuildState(network)

      expect(state.power).toBe(3000)
      expect(state.precision).toBe(initialState.precision) // Unchanged
      expect(state.ferocity).toBe(initialState.ferocity) // Unchanged
    })
  })

  describe('Realistic Build Scenarios', () => {
    it('should calculate stats for a Berserker DPS build', async () => {
      const network = createSimpleBuildCalculator()

      // Full ascended Berserker gear
      // Berserker = Power/Precision/Ferocity (35/25/25 stat distribution)
      // 6 armor pieces + 2 weapons + 6 trinkets = 14 pieces
      // Rough estimate: ~63 power, ~45 precision, ~45 ferocity per piece
      updateBaseStats(network, {
        power: 1000 + 63 * 14, // 1882 from gear
        precision: 1000 + 45 * 14, // 630 from gear
        ferocity: 0 + 45 * 14 // 630 from gear
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      const state = getBuildState(network)

      expect(state.power).toBe(1882)
      expect(state.precision).toBe(1630)
      expect(state.ferocity).toBe(630)

      // Derived stats
      expect(state.critChance).toBeCloseTo(35, 0) // (1630 - 895) / 21
      expect(state.critDamage).toBeCloseTo(192, 0) // 150 + 630/15
    })

    it('should calculate stats for a Marauder build', async () => {
      const network = createSimpleBuildCalculator()

      // Marauder = Power/Precision/Vitality/Ferocity (37/33/25/25)
      // Less precision than Berserker, but more tankiness
      updateBaseStats(network, {
        power: 1000 + 67 * 14,
        precision: 1000 + 47 * 14,
        ferocity: 0 + 36 * 14,
        vitality: 1000 + 36 * 14
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      const state = getBuildState(network)

      // precision = 1658 -> critChance = (1658 - 895) / 21 = 36.33%
      expect(state.critChance).toBeCloseTo(36.33, 0)
      // ferocity = 504 -> critDamage = 150 + 504/15 = 183.6%
      expect(state.critDamage).toBeCloseTo(184, 0)
      // vitality = 1504 -> health = 1504 * 10 + 1645 = 16685
      expect(state.health).toBeCloseTo(16685, 0)
    })
  })
})
