/**
 * Unit tests for GW2 Build Calculator
 *
 * Tests stat calculations, effective power/health calculations,
 * and damage formulas based on GW2 game mechanics.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCritChance,
  calculateCritDamage,
  calculateHealth,
  calculateArmor,
  calculateBoonDuration,
  calculateConditionDuration,
  calculateEffectivePower,
  calculateEffectiveHealth,
  calculateEffectiveHealthPower,
  calculateSkillDamage,
  calculateAverageSkillDamage,
  getNextCritBreakpoint,
  getConcentrationForBoonDuration,
  getExpertiseForConditionDuration,
  compareBuildStats,
  formatStatValue,
} from '@/lib/gw2/build-calculator'

describe('GW2 Build Calculator', () => {
  describe('calculateCritChance', () => {
    it('should calculate crit chance from precision', () => {
      // Formula: (Precision - 895) / 21
      expect(calculateCritChance(895)).toBe(0) // Base precision = 0%
      expect(calculateCritChance(916)).toBe(1) // +21 precision = +1%
      expect(calculateCritChance(1000)).toBe(5) // 105/21 = 5%
      expect(calculateCritChance(2000)).toBeCloseTo(52.6, 1) // (2000-895)/21
    })

    it('should cap at 100%', () => {
      expect(calculateCritChance(3000)).toBe(100)
      expect(calculateCritChance(10000)).toBe(100)
    })

    it('should not go below 0%', () => {
      expect(calculateCritChance(0)).toBe(0)
      expect(calculateCritChance(500)).toBe(0)
    })

    it('should handle exact breakpoints', () => {
      expect(calculateCritChance(895 + 21 * 25)).toBe(25) // 25% crit
      expect(calculateCritChance(895 + 21 * 50)).toBe(50) // 50% crit
      expect(calculateCritChance(895 + 21 * 75)).toBe(75) // 75% crit
    })
  })

  describe('calculateCritDamage', () => {
    it('should calculate crit damage from ferocity', () => {
      // Formula: 1.5 + (Ferocity / 1500)
      expect(calculateCritDamage(0)).toBe(1.5) // Base crit damage
      expect(calculateCritDamage(750)).toBe(2.0) // 750/1500 = 0.5, so 1.5 + 0.5 = 2.0
      expect(calculateCritDamage(1500)).toBe(2.5) // 1500/1500 = 1.0, so 1.5 + 1.0 = 2.5
      expect(calculateCritDamage(3000)).toBe(3.5) // 3000/1500 = 2.0, so 1.5 + 2.0 = 3.5
    })

    it('should handle decimal values', () => {
      expect(calculateCritDamage(750)).toBeCloseTo(2.0, 2)
      expect(calculateCritDamage(1000)).toBeCloseTo(2.167, 2)
    })
  })

  describe('calculateHealth', () => {
    it('should calculate health for Guardian', () => {
      // Guardian base: 1645, Vitality formula: +10 HP per point
      expect(calculateHealth('Guardian', 1000)).toBe(1645 + 1000 * 10) // 11645
    })

    it('should calculate health for Warrior', () => {
      // Warrior base: 9212
      expect(calculateHealth('Warrior', 1000)).toBe(9212 + 1000 * 10) // 19212
    })

    it('should calculate health for Necromancer', () => {
      // Necromancer base: 5945
      expect(calculateHealth('Necromancer', 1000)).toBe(5945 + 1000 * 10) // 15945
    })

    it('should scale with vitality', () => {
      expect(calculateHealth('Guardian', 1500)).toBe(1645 + 1500 * 10) // 16645
      expect(calculateHealth('Guardian', 2000)).toBe(1645 + 2000 * 10) // 21645
    })
  })

  describe('calculateArmor', () => {
    it('should calculate armor for Guardian', () => {
      // Guardian base armor: 967
      expect(calculateArmor('Guardian', 1000)).toBe(967 + 1000) // 1967
    })

    it('should calculate armor for Warrior', () => {
      // Warrior base armor: 1000
      expect(calculateArmor('Warrior', 1000)).toBe(1000 + 1000) // 2000
    })

    it('should calculate armor for Necromancer', () => {
      // Necromancer base armor: 1000
      expect(calculateArmor('Necromancer', 1000)).toBe(1000 + 1000) // 2000
    })

    it('should scale with toughness', () => {
      expect(calculateArmor('Guardian', 1500)).toBe(967 + 1500) // 2467
      expect(calculateArmor('Guardian', 2000)).toBe(967 + 2000) // 2967
    })
  })

  describe('calculateBoonDuration', () => {
    it('should calculate boon duration from concentration', () => {
      // Formula: (Concentration / 1500) * 100
      expect(calculateBoonDuration(0)).toBe(0)
      expect(calculateBoonDuration(750)).toBe(50) // 750/1500 * 100 = 50%
      expect(calculateBoonDuration(1500)).toBe(100) // 100% boon duration
      expect(calculateBoonDuration(3000)).toBe(200) // 200% boon duration
    })

    it('should handle decimal percentages', () => {
      expect(calculateBoonDuration(1000)).toBeCloseTo(66.67, 1)
    })
  })

  describe('calculateConditionDuration', () => {
    it('should calculate condition duration from expertise', () => {
      // Formula: (Expertise / 1500) * 100
      expect(calculateConditionDuration(0)).toBe(0)
      expect(calculateConditionDuration(750)).toBe(50)
      expect(calculateConditionDuration(1500)).toBe(100)
      expect(calculateConditionDuration(3000)).toBe(200)
    })

    it('should handle decimal percentages', () => {
      expect(calculateConditionDuration(1000)).toBeCloseTo(66.67, 1)
    })
  })

  describe('calculateEffectivePower', () => {
    it('should calculate effective power with no crit', () => {
      // EP = Power × (1 + CritChance × (CritDamage - 1))
      // With 0% crit: EP = Power × 1 = Power
      expect(calculateEffectivePower(3000, 0, 1.5)).toBe(3000)
    })

    it('should calculate effective power with 100% crit', () => {
      // With 100% crit and 2.0 crit damage: EP = 3000 × (1 + 1.0 × (2.0 - 1)) = 3000 × 2.0 = 6000
      expect(calculateEffectivePower(3000, 100, 2.0)).toBe(6000)
    })

    it('should calculate effective power with 50% crit', () => {
      // With 50% crit and 2.0 crit damage: EP = 3000 × (1 + 0.5 × (2.0 - 1)) = 3000 × 1.5 = 4500
      expect(calculateEffectivePower(3000, 50, 2.0)).toBe(4500)
    })

    it('should calculate effective power with high crit damage', () => {
      // With 80% crit and 2.5 crit damage: EP = 3000 × (1 + 0.8 × (2.5 - 1)) = 3000 × 2.2 = 6600
      expect(calculateEffectivePower(3000, 80, 2.5)).toBe(6600)
    })

    it('should scale with power', () => {
      expect(calculateEffectivePower(2000, 50, 2.0)).toBe(3000)
      expect(calculateEffectivePower(4000, 50, 2.0)).toBe(6000)
    })
  })

  describe('calculateEffectiveHealth', () => {
    it('should calculate effective health', () => {
      // EH = Health × (Armor / 1000)
      expect(calculateEffectiveHealth(20000, 1000)).toBe(20000) // Baseline
      expect(calculateEffectiveHealth(20000, 2000)).toBe(40000) // 2x armor
      expect(calculateEffectiveHealth(20000, 2500)).toBe(50000) // 2.5x armor
    })

    it('should scale with armor', () => {
      expect(calculateEffectiveHealth(15000, 1500)).toBe(22500)
      expect(calculateEffectiveHealth(15000, 3000)).toBe(45000)
    })

    it('should scale with health', () => {
      expect(calculateEffectiveHealth(10000, 2000)).toBe(20000)
      expect(calculateEffectiveHealth(25000, 2000)).toBe(50000)
    })
  })

  describe('calculateEffectiveHealthPower', () => {
    it('should calculate EHP as product of EP and EH', () => {
      // EHP = EP × EH
      expect(calculateEffectiveHealthPower(6600, 50000)).toBe(330_000_000)
      expect(calculateEffectiveHealthPower(5000, 40000)).toBe(200_000_000)
    })

    it('should scale with both metrics', () => {
      expect(calculateEffectiveHealthPower(3000, 30000)).toBe(90_000_000)
      expect(calculateEffectiveHealthPower(7000, 60000)).toBe(420_000_000)
    })
  })

  describe('calculateSkillDamage', () => {
    it('should calculate damage for greatsword skill', () => {
      // Formula: (Weapon Strength × Power × Coefficient) / 2597
      const result = calculateSkillDamage('Greatsword', 3000, 1.0)

      // Base: (1100 × 3000 × 1.0) / 2597 = 1271
      expect(result.normal).toBeCloseTo(1271, 0)

      // Critical: base × 1.5 = 1907
      expect(result.critical).toBeCloseTo(1907, 0)
    })

    it('should scale with power', () => {
      const low = calculateSkillDamage('Greatsword', 2000, 1.0)
      const high = calculateSkillDamage('Greatsword', 4000, 1.0)

      expect(high.normal).toBeGreaterThan(low.normal)
      expect(high.normal).toBeCloseTo(low.normal * 2, 0)
    })

    it('should scale with coefficient', () => {
      const low = calculateSkillDamage('Greatsword', 3000, 0.5)
      const high = calculateSkillDamage('Greatsword', 3000, 2.0)

      expect(high.normal).toBeCloseTo(low.normal * 4, 0)
    })

    it('should use custom crit damage', () => {
      const result = calculateSkillDamage('Greatsword', 3000, 1.0, 2.5)

      // Critical with 2.5x multiplier
      expect(result.critical).toBeCloseTo(result.normal * 2.5, 0)
    })

    it('should handle different weapon types', () => {
      const greatsword = calculateSkillDamage('Greatsword', 3000, 1.0)
      const dagger = calculateSkillDamage('Dagger', 3000, 1.0)

      // Dagger has lower weapon strength (950 vs 1100)
      expect(dagger.normal).toBeLessThan(greatsword.normal)
    })

    it('should use default weapon strength for unknown weapons', () => {
      const result = calculateSkillDamage('UnknownWeapon', 3000, 1.0)

      expect(result.normal).toBeGreaterThan(0)
    })
  })

  describe('calculateAverageSkillDamage', () => {
    it('should calculate average damage with crit chance', () => {
      // 50% crit chance, 2.0x crit damage
      const avg = calculateAverageSkillDamage('Greatsword', 3000, 1.0, 50, 2.0)

      // Base damage: ~1271, Crit damage: ~2542
      // Average: 1271 * 0.5 + 2542 * 0.5 = 1906.5
      expect(avg).toBeCloseTo(1907, 0)
    })

    it('should equal normal damage with 0% crit', () => {
      const avg = calculateAverageSkillDamage('Greatsword', 3000, 1.0, 0, 2.0)
      const { normal } = calculateSkillDamage('Greatsword', 3000, 1.0)

      expect(avg).toBe(normal)
    })

    it('should equal critical damage with 100% crit', () => {
      const avg = calculateAverageSkillDamage('Greatsword', 3000, 1.0, 100, 2.0)
      const { critical } = calculateSkillDamage('Greatsword', 3000, 1.0, 2.0)

      expect(avg).toBe(critical)
    })

    it('should cap crit chance at 100%', () => {
      const capped = calculateAverageSkillDamage('Greatsword', 3000, 1.0, 100, 2.0)
      const overCapped = calculateAverageSkillDamage('Greatsword', 3000, 1.0, 150, 2.0)

      expect(capped).toBe(overCapped)
    })
  })

  describe('getNextCritBreakpoint', () => {
    it('should find next 1% breakpoint', () => {
      // Current: 1000 precision = 5% crit
      const result = getNextCritBreakpoint(1000)

      expect(result.critChance).toBe(6) // Next whole %
      expect(result.precision).toBe(895 + 6 * 21) // 1021
      expect(result.precisionNeeded).toBe(21) // Need 21 more precision
    })

    it('should handle exact breakpoints', () => {
      const result = getNextCritBreakpoint(895 + 21 * 50) // Exactly 50%

      expect(result.critChance).toBe(51)
      expect(result.precisionNeeded).toBe(21)
    })

    it('should return 100% when at cap', () => {
      const result = getNextCritBreakpoint(3000) // Already at 100%

      expect(result.critChance).toBe(100)
      expect(result.precisionNeeded).toBe(0)
    })

    it('should handle just before breakpoint', () => {
      const result = getNextCritBreakpoint(895 + 21 * 25 - 1) // 24.95%

      expect(result.critChance).toBe(25)
      expect(result.precisionNeeded).toBe(1)
    })
  })

  describe('getConcentrationForBoonDuration', () => {
    it('should calculate concentration for target boon duration', () => {
      expect(getConcentrationForBoonDuration(50)).toBe(750) // 50% = 750 concentration
      expect(getConcentrationForBoonDuration(100)).toBe(1500) // 100% = 1500 concentration
      expect(getConcentrationForBoonDuration(200)).toBe(3000) // 200% = 3000 concentration
    })

    it('should handle decimal percentages', () => {
      expect(getConcentrationForBoonDuration(66.67)).toBeCloseTo(1000, 0)
    })
  })

  describe('getExpertiseForConditionDuration', () => {
    it('should calculate expertise for target condition duration', () => {
      expect(getExpertiseForConditionDuration(50)).toBe(750)
      expect(getExpertiseForConditionDuration(100)).toBe(1500)
      expect(getExpertiseForConditionDuration(200)).toBe(3000)
    })

    it('should handle decimal percentages', () => {
      expect(getExpertiseForConditionDuration(66.67)).toBeCloseTo(1000, 0)
    })
  })

  describe('compareBuildStats', () => {
    it('should calculate differences between builds', () => {
      const stats1 = {
        power: 3000,
        precision: 2000,
        ferocity: 1500,
        critChance: 50,
        effectivePower: 4500,
      } as any

      const stats2 = {
        power: 3500,
        precision: 2100,
        ferocity: 1800,
        critChance: 55,
        effectivePower: 5250,
      } as any

      const diff = compareBuildStats(stats1, stats2)

      expect(diff.power).toBe(500)
      expect(diff.precision).toBe(100)
      expect(diff.ferocity).toBe(300)
      expect(diff.critChance).toBe(5)
      expect(diff.effectivePower).toBe(750)
    })

    it('should handle negative differences', () => {
      const stats1 = { power: 3000 } as any
      const stats2 = { power: 2500 } as any

      const diff = compareBuildStats(stats1, stats2)

      expect(diff.power).toBe(-500)
    })

    it('should only compare numeric values', () => {
      const stats1 = { power: 3000, name: 'Build 1' } as any
      const stats2 = { power: 3500, name: 'Build 2' } as any

      const diff = compareBuildStats(stats1, stats2)

      expect(diff.power).toBe(500)
      expect(diff.name).toBeUndefined()
    })
  })

  describe('formatStatValue', () => {
    it('should format percentages', () => {
      expect(formatStatValue('critChance', 52.6)).toBe('52.6%')
      expect(formatStatValue('boonDuration', 66.67)).toBe('66.7%')
      expect(formatStatValue('conditionDuration', 100)).toBe('100.0%')
    })

    it('should format large EHP values', () => {
      expect(formatStatValue('effectiveHealthPower', 330_000_000)).toBe('330.0M')
      expect(formatStatValue('effectiveHealthPower', 450_500_000)).toBe('450.5M')
    })

    it('should format regular stats', () => {
      expect(formatStatValue('power', 3000)).toBe('3,000')
      expect(formatStatValue('effectiveHealth', 50000)).toBe('50,000')
    })

    it('should round decimal values for non-percentages', () => {
      expect(formatStatValue('power', 3000.7)).toBe('3,001')
    })
  })

  describe('Integration - Full Stat Calculation', () => {
    it('should calculate consistent effective power', () => {
      const power = 3000
      const precision = 2000 // ~52.6% crit
      const ferocity = 1500 // 2.5x crit damage

      const critChance = calculateCritChance(precision)
      const critDamage = calculateCritDamage(ferocity)
      const ep = calculateEffectivePower(power, critChance, critDamage)

      // EP = 3000 × (1 + 0.526 × (2.5 - 1)) = 3000 × 1.789 = 5367
      expect(ep).toBeCloseTo(5367, 0)
    })

    it('should calculate consistent effective health', () => {
      const profession = 'Warrior'
      const vitality = 2000
      const toughness = 2000

      const health = calculateHealth(profession, vitality)
      const armor = calculateArmor(profession, toughness)
      const eh = calculateEffectiveHealth(health, armor)

      // Health: 9212 + 20000 = 29212
      // Armor: 1000 + 2000 = 3000
      // EH: 29212 × 3.0 = 87636
      expect(health).toBe(29212)
      expect(armor).toBe(3000)
      expect(eh).toBeCloseTo(87636, 0)
    })

    it('should calculate consistent skill damage', () => {
      const power = 3000
      const precision = 1950 // 50% crit
      const ferocity = 750 // 2.0x crit damage

      const critChance = calculateCritChance(precision)
      const critDamage = calculateCritDamage(ferocity)

      const avgDamage = calculateAverageSkillDamage('Greatsword', power, 1.0, critChance, critDamage)

      // Should be between normal and critical damage
      const { normal, critical } = calculateSkillDamage('Greatsword', power, 1.0, critDamage)
      expect(avgDamage).toBeGreaterThan(normal)
      expect(avgDamage).toBeLessThan(critical)
      expect(avgDamage).toBeCloseTo((normal + critical) / 2, 0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero stats', () => {
      expect(calculateCritChance(0)).toBe(0)
      expect(calculateCritDamage(0)).toBe(1.5)
      expect(calculateBoonDuration(0)).toBe(0)
      expect(calculateConditionDuration(0)).toBe(0)
    })

    it('should handle very high stats', () => {
      expect(calculateCritChance(10000)).toBe(100) // Capped
      expect(calculateCritDamage(10000)).toBeGreaterThan(1.5)
      expect(calculateBoonDuration(10000)).toBeGreaterThan(100)
    })

    it('should handle negative precision gracefully', () => {
      expect(calculateCritChance(-100)).toBe(0) // Should not go negative
    })
  })
})
