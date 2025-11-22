/**
 * Unit tests for PPT (Points Per Tick) Calculator
 *
 * Tests all PPT calculation functions including objective scoring,
 * team calculations, differentials, and catch-up scenarios.
 */

import { describe, it, expect } from 'vitest'
import {
  getPPTForObjective,
  calculateTeamPPT,
  calculateMatchPPT,
  calculatePPTDifferential,
  getPPTTrend,
  calculateTicksBehind,
  ticksToTimeString,
  getTeamStatus,
  calculatePPTRange,
  getTimeRemainingInSkirmish,
  getCurrentSkirmishInfo,
  getTicksRemainingInSkirmish,
  calculateRequiredPPTToOvertake,
  getMaximumPossiblePPT,
  calculateMaxAchievablePPT,
  type ObjectivesCount,
} from '@/lib/ppt-calculator'

describe('PPT Calculator', () => {
  describe('getPPTForObjective', () => {
    it('should return correct PPT for camps at all tiers', () => {
      expect(getPPTForObjective('camp', 0)).toBe(2)
      expect(getPPTForObjective('camp', 1)).toBe(3)
      expect(getPPTForObjective('camp', 2)).toBe(4)
      expect(getPPTForObjective('camp', 3)).toBe(5)
    })

    it('should return correct PPT for towers at all tiers', () => {
      expect(getPPTForObjective('tower', 0)).toBe(4)
      expect(getPPTForObjective('tower', 1)).toBe(6)
      expect(getPPTForObjective('tower', 2)).toBe(8)
      expect(getPPTForObjective('tower', 3)).toBe(10)
    })

    it('should return correct PPT for keeps at all tiers', () => {
      expect(getPPTForObjective('keep', 0)).toBe(8)
      expect(getPPTForObjective('keep', 1)).toBe(12)
      expect(getPPTForObjective('keep', 2)).toBe(16)
      expect(getPPTForObjective('keep', 3)).toBe(20)
    })

    it('should return correct PPT for castles at all tiers', () => {
      expect(getPPTForObjective('castle', 0)).toBe(12)
      expect(getPPTForObjective('castle', 1)).toBe(18)
      expect(getPPTForObjective('castle', 2)).toBe(24)
      expect(getPPTForObjective('castle', 3)).toBe(30)
    })

    it('should default to tier 0 when no tier specified', () => {
      expect(getPPTForObjective('camp')).toBe(2)
      expect(getPPTForObjective('tower')).toBe(4)
      expect(getPPTForObjective('keep')).toBe(8)
      expect(getPPTForObjective('castle')).toBe(12)
    })
  })

  describe('calculateTeamPPT', () => {
    it('should calculate PPT with no objectives', () => {
      const objectives: ObjectivesCount = {
        camps: 0,
        towers: 0,
        keeps: 0,
        castles: 0,
      }
      const result = calculateTeamPPT(objectives, 0)
      expect(result.total).toBe(0)
      expect(result.breakdown).toEqual({
        camps: 0,
        towers: 0,
        keeps: 0,
        castles: 0,
      })
    })

    it('should calculate PPT with mixed objectives at T0', () => {
      const objectives: ObjectivesCount = {
        camps: 4,
        towers: 3,
        keeps: 2,
        castles: 1,
      }
      const result = calculateTeamPPT(objectives, 0)
      // 4*2 + 3*4 + 2*8 + 1*12 = 8 + 12 + 16 + 12 = 48
      expect(result.total).toBe(48)
      expect(result.breakdown.camps).toBe(8)
      expect(result.breakdown.towers).toBe(12)
      expect(result.breakdown.keeps).toBe(16)
      expect(result.breakdown.castles).toBe(12)
    })

    it('should calculate PPT with objectives at T3', () => {
      const objectives: ObjectivesCount = {
        camps: 2,
        towers: 2,
        keeps: 1,
        castles: 1,
      }
      const result = calculateTeamPPT(objectives, 3)
      // 2*5 + 2*10 + 1*20 + 1*30 = 10 + 20 + 20 + 30 = 80
      expect(result.total).toBe(80)
    })

    it('should handle maximum possible objectives at T0', () => {
      const objectives: ObjectivesCount = {
        camps: 12,
        towers: 12,
        keeps: 9,
        castles: 1,
      }
      const result = calculateTeamPPT(objectives, 0)
      // 12*2 + 12*4 + 9*8 + 1*12 = 24 + 48 + 72 + 12 = 156
      expect(result.total).toBe(156)
    })
  })

  describe('calculateMatchPPT', () => {
    it('should calculate PPT for all three teams', () => {
      const objectives = {
        red: { camps: 4, towers: 4, keeps: 3, castles: 1 },
        blue: { camps: 4, towers: 4, keeps: 3, castles: 0 },
        green: { camps: 4, towers: 4, keeps: 3, castles: 0 },
      }
      const result = calculateMatchPPT(objectives, 0)

      expect(result.red.total).toBe(4 * 2 + 4 * 4 + 3 * 8 + 1 * 12) // 56
      expect(result.blue.total).toBe(4 * 2 + 4 * 4 + 3 * 8) // 48
      expect(result.green.total).toBe(4 * 2 + 4 * 4 + 3 * 8) // 48
    })

    it('should sum to total available PPT or less', () => {
      const objectives = {
        red: { camps: 4, towers: 4, keeps: 3, castles: 1 },
        blue: { camps: 4, towers: 4, keeps: 3, castles: 0 },
        green: { camps: 4, towers: 4, keeps: 3, castles: 0 },
      }
      const result = calculateMatchPPT(objectives, 0)
      const total = result.red.total + result.blue.total + result.green.total

      expect(total).toBeLessThanOrEqual(156) // Max PPT
    })
  })

  describe('calculatePPTDifferential', () => {
    it('should return 0 when team has highest PPT', () => {
      expect(calculatePPTDifferential(50, 50)).toBe(0)
    })

    it('should return positive when team exceeds highest', () => {
      expect(calculatePPTDifferential(60, 50)).toBe(10)
    })

    it('should return negative when team is below highest', () => {
      expect(calculatePPTDifferential(40, 50)).toBe(-10)
    })
  })

  describe('getPPTTrend', () => {
    it('should return "up" when team has highest PPT', () => {
      expect(getPPTTrend(50, 50)).toBe('up')
    })

    it('should return "down" when team is below highest', () => {
      expect(getPPTTrend(40, 50)).toBe('down')
    })

    it('should return "neutral" when PPT is 0', () => {
      expect(getPPTTrend(0, 0)).toBe('neutral')
    })
  })

  describe('calculateTicksBehind', () => {
    it('should return null when team has equal or lower PPT', () => {
      expect(calculateTicksBehind(100, 0)).toBeNull()
      expect(calculateTicksBehind(100, -5)).toBeNull()
    })

    it('should calculate ticks correctly when catching up', () => {
      // Behind by 100 points, gaining 10 PPT per tick
      expect(calculateTicksBehind(100, 10)).toBe(10)
    })

    it('should round up ticks', () => {
      // Behind by 100 points, gaining 15 PPT per tick
      // 100 / 15 = 6.67, should round to 7
      expect(calculateTicksBehind(100, 15)).toBe(7)
    })

    it('should handle large deficits', () => {
      expect(calculateTicksBehind(1000, 5)).toBe(200)
    })

    it('should handle small deficits', () => {
      expect(calculateTicksBehind(5, 10)).toBe(1)
    })
  })

  describe('ticksToTimeString', () => {
    it('should format single tick (5 minutes)', () => {
      expect(ticksToTimeString(1)).toBe('5m')
    })

    it('should format multiple ticks within an hour', () => {
      expect(ticksToTimeString(6)).toBe('30m')
    })

    it('should format ticks as hours and minutes', () => {
      expect(ticksToTimeString(12)).toBe('1h 0m') // 60 minutes
      expect(ticksToTimeString(15)).toBe('1h 15m') // 75 minutes
    })

    it('should format large tick counts', () => {
      expect(ticksToTimeString(24)).toBe('2h 0m') // 120 minutes
      expect(ticksToTimeString(100)).toBe('8h 20m') // 500 minutes
    })
  })

  describe('getTeamStatus', () => {
    it('should return "leading" when team is first with positive differential', () => {
      const status = getTeamStatus(0, 5)
      expect(status.status).toBe('leading')
      expect(status.description).toContain('pulling ahead')
    })

    it('should return "leading" when team is first with zero differential', () => {
      const status = getTeamStatus(0, 0)
      expect(status.status).toBe('leading')
      expect(status.description).toBe('In the lead')
    })

    it('should return "leading" when team is first but losing ground', () => {
      const status = getTeamStatus(0, -5)
      expect(status.status).toBe('leading')
      expect(status.description).toContain('losing ground')
    })

    it('should return "catching-up" when behind with higher PPT', () => {
      const status = getTeamStatus(100, 10)
      expect(status.status).toBe('catching-up')
      expect(status.description).toContain('catching up')
    })

    it('should return "maintaining-gap" when behind with equal PPT', () => {
      const status = getTeamStatus(100, 0)
      expect(status.status).toBe('maintaining-gap')
      expect(status.description).toContain('constant')
    })

    it('should return "falling-behind" when behind with lower PPT', () => {
      const status = getTeamStatus(100, -5)
      expect(status.status).toBe('falling-behind')
      expect(status.description).toContain('increasing')
    })
  })

  describe('calculatePPTRange', () => {
    it('should calculate min, max, and estimated PPT', () => {
      const objectives: ObjectivesCount = {
        camps: 4,
        towers: 3,
        keeps: 2,
        castles: 1,
      }
      const range = calculatePPTRange(objectives)

      // Min (T0): 4*2 + 3*4 + 2*8 + 1*12 = 48
      expect(range.min).toBe(48)

      // Max (T3): 4*5 + 3*10 + 2*20 + 1*30 = 100
      expect(range.max).toBe(100)

      // Estimated should be between min and max
      expect(range.estimated).toBeGreaterThanOrEqual(range.min)
      expect(range.estimated).toBeLessThanOrEqual(range.max)
    })

    it('should have min = max = estimated when no objectives', () => {
      const objectives: ObjectivesCount = {
        camps: 0,
        towers: 0,
        keeps: 0,
        castles: 0,
      }
      const range = calculatePPTRange(objectives)

      expect(range.min).toBe(0)
      expect(range.max).toBe(0)
      expect(range.estimated).toBe(0)
    })
  })

  describe('getTimeRemainingInSkirmish', () => {
    it('should calculate remaining time correctly', () => {
      const skirmishStart = new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      const remaining = getTimeRemainingInSkirmish(skirmishStart)
      expect(remaining).toBe(90) // 120 - 30 = 90 minutes
    })

    it('should return 0 for completed skirmishes', () => {
      const skirmishStart = new Date(Date.now() - 150 * 60 * 1000) // 150 minutes ago
      const remaining = getTimeRemainingInSkirmish(skirmishStart)
      expect(remaining).toBe(0)
    })

    it('should return full duration for just-started skirmish', () => {
      const skirmishStart = new Date(Date.now())
      const remaining = getTimeRemainingInSkirmish(skirmishStart)
      expect(remaining).toBeGreaterThanOrEqual(119) // Allow for small timing differences
      expect(remaining).toBeLessThanOrEqual(120)
    })

    it('should preserve second-level precision', () => {
      // 119 minutes and 22 seconds ago (38 seconds remaining in a 120-minute skirmish)
      const skirmishStart = new Date(Date.now() - (119 * 60 + 22) * 1000)
      const remaining = getTimeRemainingInSkirmish(skirmishStart)
      // Should be approximately 0.633 minutes (38 seconds)
      expect(remaining).toBeGreaterThan(0.6)
      expect(remaining).toBeLessThan(0.7)
    })
  })

  describe('getCurrentSkirmishInfo', () => {
    it('should calculate current skirmish number correctly', () => {
      // Match started 3 hours ago (1.5 skirmishes)
      const matchStart = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const info = getCurrentSkirmishInfo(matchStart)
      expect(info.skirmishNumber).toBe(1) // 0-indexed: skirmish 0 ended, now in skirmish 1
    })

    it('should calculate ticks remaining with second precision', () => {
      // Match started 119 minutes and 22 seconds ago (38 seconds remaining in first skirmish)
      const matchStart = new Date(Date.now() - (119 * 60 + 22) * 1000)
      const info = getCurrentSkirmishInfo(matchStart)
      expect(info.ticksRemaining).toBe(1) // Should have 1 tick remaining (Math.ceil(0.633 / 5))
      expect(info.minutesRemaining).toBeGreaterThan(0.6)
      expect(info.minutesRemaining).toBeLessThan(0.7)
    })

    it('should return 0 ticks when skirmish is complete', () => {
      // Match started 125 minutes ago (skirmish ended 5 minutes ago)
      const matchStart = new Date(Date.now() - 125 * 60 * 1000)
      const info = getCurrentSkirmishInfo(matchStart)
      expect(info.ticksRemaining).toBe(0)
      expect(info.minutesRemaining).toBe(0)
    })

    it('should handle multiple skirmishes correctly', () => {
      // Match started 250 minutes ago (2 hours 10 minutes = into 2nd skirmish)
      const matchStart = new Date(Date.now() - 250 * 60 * 1000)
      const info = getCurrentSkirmishInfo(matchStart)
      expect(info.skirmishNumber).toBe(2) // 0-indexed: skirmish 0, 1 ended, now in skirmish 2
      expect(info.minutesRemaining).toBeGreaterThanOrEqual(109)
      expect(info.minutesRemaining).toBeLessThanOrEqual(110)
      expect(info.ticksRemaining).toBe(22) // Math.ceil(110 / 5) = 22
    })
  })

  describe('getTicksRemainingInSkirmish', () => {
    it('should return ticks remaining for current skirmish', () => {
      const matchStart = new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      const ticks = getTicksRemainingInSkirmish(matchStart)
      expect(ticks).toBe(18) // Math.ceil(90 / 5) = 18
    })

    it('should return 1 tick when less than 5 minutes remain', () => {
      // 119 minutes and 22 seconds ago (38 seconds remaining)
      const matchStart = new Date(Date.now() - (119 * 60 + 22) * 1000)
      const ticks = getTicksRemainingInSkirmish(matchStart)
      expect(ticks).toBe(1) // Even with < 1 minute, should round up to 1 tick
    })

    it('should return 0 ticks when skirmish is complete', () => {
      const matchStart = new Date(Date.now() - 125 * 60 * 1000) // 125 minutes ago
      const ticks = getTicksRemainingInSkirmish(matchStart)
      expect(ticks).toBe(0)
    })
  })

  describe('calculateRequiredPPTToOvertake', () => {
    it('should return null when no time remaining', () => {
      expect(calculateRequiredPPTToOvertake(100, 50, 60, 0)).toBeNull()
    })

    it('should calculate required PPT to overtake', () => {
      // Behind by 100 points, leader has 60 PPT, 60 minutes remaining
      // 60 minutes = 12 ticks
      // Need to gain 101 points in 12 ticks = 8.42 points/tick differential
      // Required PPT = 60 + 9 = 69
      const required = calculateRequiredPPTToOvertake(100, 50, 60, 60)
      expect(required).toBe(69)
    })

    it('should handle small deficits', () => {
      const required = calculateRequiredPPTToOvertake(5, 40, 50, 30)
      expect(required).toBeGreaterThan(50)
    })

    it('should handle large deficits', () => {
      const required = calculateRequiredPPTToOvertake(500, 40, 50, 60)
      expect(required).toBeGreaterThan(50)
    })
  })

  describe('getMaximumPossiblePPT', () => {
    it('should return 156 (all objectives at T0)', () => {
      expect(getMaximumPossiblePPT()).toBe(156)
    })
  })

  describe('calculateMaxAchievablePPT', () => {
    it('should calculate max PPT with current and capturable objectives', () => {
      const detailedObjectives = [
        // Red owns 2 camps at T0 (2 PPT each)
        { type: 'Camp', owner: 'Red', points_tick: 2 },
        { type: 'Camp', owner: 'Red', points_tick: 2 },

        // Blue owns 2 camps at T1 (3 PPT each)
        { type: 'Camp', owner: 'Blue', points_tick: 3 },
        { type: 'Camp', owner: 'Blue', points_tick: 3 },

        // Green owns 1 tower at T0 (4 PPT)
        { type: 'Tower', owner: 'Green', points_tick: 4 },
      ]

      const result = calculateMaxAchievablePPT('red', detailedObjectives)

      // Current: 2 + 2 = 4
      expect(result.currentPPT).toBe(4)

      // Capturable: 3 + 3 + 4 = 10 (at T0 values: 2 + 2 + 4 = 8)
      expect(result.potentialGain).toBe(8)

      // Max: 4 + 8 = 12
      expect(result.maxPPT).toBe(12)
    })

    it('should handle team with no objectives', () => {
      const detailedObjectives = [
        { type: 'Camp', owner: 'Blue', points_tick: 2 },
        { type: 'Camp', owner: 'Green', points_tick: 2 },
      ]

      const result = calculateMaxAchievablePPT('red', detailedObjectives)

      expect(result.currentPPT).toBe(0)
      expect(result.potentialGain).toBeGreaterThan(0)
    })

    it('should handle team with all objectives', () => {
      const detailedObjectives = [
        { type: 'Camp', owner: 'Red', points_tick: 2 },
        { type: 'Camp', owner: 'Red', points_tick: 2 },
        { type: 'Tower', owner: 'Red', points_tick: 4 },
      ]

      const result = calculateMaxAchievablePPT('red', detailedObjectives)

      expect(result.currentPPT).toBe(8)
      expect(result.potentialGain).toBe(0)
      expect(result.maxPPT).toBe(8)
    })

    it('should ignore objectives without valid owners', () => {
      const detailedObjectives = [
        { type: 'Camp', owner: 'Red', points_tick: 2 },
        { type: 'Camp', owner: null, points_tick: 2 }, // Neutral
        { type: 'Camp', owner: undefined, points_tick: 2 },
      ]

      const result = calculateMaxAchievablePPT('red', detailedObjectives)

      expect(result.currentPPT).toBe(2) // Only counted the owned camp
    })

    it('should ignore spawn objectives', () => {
      const detailedObjectives = [
        { type: 'Camp', owner: 'Red', points_tick: 2 },
        { type: 'Spawn', owner: 'Red', points_tick: 0 },
      ]

      const result = calculateMaxAchievablePPT('red', detailedObjectives)

      expect(result.currentPPT).toBe(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle negative PPT differentials correctly', () => {
      expect(calculateTicksBehind(100, -10)).toBeNull()
    })

    it('should handle zero PPT values', () => {
      const objectives: ObjectivesCount = {
        camps: 0,
        towers: 0,
        keeps: 0,
        castles: 0,
      }
      expect(calculateTeamPPT(objectives).total).toBe(0)
    })

    it('should handle very large tick counts', () => {
      const timeString = ticksToTimeString(1000)
      expect(timeString).toContain('h')
    })
  })

  describe('Integration Tests', () => {
    it('should calculate full match scenario correctly', () => {
      // Team Red controls 4 camps, 3 towers, 2 keeps, 1 castle
      // Team Blue controls 4 camps, 4 towers, 3 keeps
      // Team Green controls 4 camps, 5 towers, 4 keeps

      const red: ObjectivesCount = { camps: 4, towers: 3, keeps: 2, castles: 1 }
      const blue: ObjectivesCount = { camps: 4, towers: 4, keeps: 3, castles: 0 }
      const green: ObjectivesCount = { camps: 4, towers: 5, keeps: 4, castles: 0 }

      const matchPPT = calculateMatchPPT({ red, blue, green }, 0)

      // Red: 4*2 + 3*4 + 2*8 + 1*12 = 8 + 12 + 16 + 12 = 48
      expect(matchPPT.red.total).toBe(48)

      // Blue: 4*2 + 4*4 + 3*8 = 8 + 16 + 24 = 48
      expect(matchPPT.blue.total).toBe(48)

      // Green: 4*2 + 5*4 + 4*8 = 8 + 20 + 32 = 60
      expect(matchPPT.green.total).toBe(60)

      // Green has highest PPT
      const highestPPT = 60

      // Calculate differentials
      const redDiff = calculatePPTDifferential(matchPPT.red.total, highestPPT)
      const blueDiff = calculatePPTDifferential(matchPPT.blue.total, highestPPT)
      const greenDiff = calculatePPTDifferential(matchPPT.green.total, highestPPT)

      expect(redDiff).toBe(-12)
      expect(blueDiff).toBe(-12)
      expect(greenDiff).toBe(0)

      // Calculate catch-up times
      const redCatchup = calculateTicksBehind(100, -redDiff) // Red gaining 12/tick on Green
      expect(redCatchup).toBe(9) // 100/12 rounded up
    })
  })
})
