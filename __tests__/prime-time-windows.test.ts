/**
 * Unit tests for Prime Time Windows utility
 *
 * Tests window detection, grouping, and coverage calculations
 * for different time zones and prime time periods.
 */

import { describe, it, expect } from 'vitest'
import {
  getPrimeTimeWindow,
  getActiveWindows,
  getCurrentActiveWindow,
  getOffHoursPeriods,
  getOffHoursDescription,
  getTimeWindowInfo,
  getAllTimeWindows,
  groupByPrimeTimeWindow,
  calculateWindowCoverage,
  PRIME_TIME_WINDOWS,
  type PrimeTimeWindow,
} from '@/lib/prime-time-windows'

describe('Prime Time Windows', () => {
  describe('getPrimeTimeWindow', () => {
    it('should identify NA Prime Time (0-5 UTC)', () => {
      const times = [0, 1, 2, 3, 4]
      times.forEach((hour) => {
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
        expect(getPrimeTimeWindow(date)).toBe('na-prime')
      })
    })

    it('should identify EU Prime Time (18-23 UTC)', () => {
      const times = [18, 19, 20, 21, 22]
      times.forEach((hour) => {
        const date = new Date(`2024-01-01T${hour}:00:00Z`)
        expect(getPrimeTimeWindow(date)).toBe('eu-prime')
      })
    })

    it('should identify OCX Prime Time (8-13 UTC)', () => {
      const times = [8, 9, 10, 11, 12]
      times.forEach((hour) => {
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
        expect(getPrimeTimeWindow(date)).toBe('ocx')
      })
    })

    it('should identify SEA Prime Time (11-16 UTC)', () => {
      const times = [11, 12, 13, 14, 15]
      times.forEach((hour) => {
        const date = new Date(`2024-01-01T${hour}:00:00Z`)
        expect(getPrimeTimeWindow(date)).toBe('sea')
      })
    })

    it('should identify off-hours', () => {
      const offHours = [5, 6, 7, 16, 17, 23]
      offHours.forEach((hour) => {
        const date = new Date(`2024-01-01T${hour}:00:00Z`)
        expect(getPrimeTimeWindow(date)).toBe('off-hours')
      })
    })

    it('should handle string timestamps', () => {
      expect(getPrimeTimeWindow('2024-01-01T00:00:00Z')).toBe('na-prime')
      expect(getPrimeTimeWindow('2024-01-01T18:00:00Z')).toBe('eu-prime')
    })

    it('should handle numeric timestamps', () => {
      const naDate = new Date('2024-01-01T00:00:00Z').getTime()
      const euDate = new Date('2024-01-01T18:00:00Z').getTime()

      expect(getPrimeTimeWindow(naDate)).toBe('na-prime')
      expect(getPrimeTimeWindow(euDate)).toBe('eu-prime')
    })

    it('should handle Date objects', () => {
      const naDate = new Date('2024-01-01T00:00:00Z')
      const euDate = new Date('2024-01-01T18:00:00Z')

      expect(getPrimeTimeWindow(naDate)).toBe('na-prime')
      expect(getPrimeTimeWindow(euDate)).toBe('eu-prime')
    })
  })

  describe('getActiveWindows', () => {
    it('should return OCX and SEA for overlapping time (11-13 UTC)', () => {
      const times = [11, 12]
      times.forEach((hour) => {
        const date = new Date(`2024-01-01T${hour}:00:00Z`)
        const active = getActiveWindows(date)

        expect(active).toContain('ocx')
        expect(active).toContain('sea')
        expect(active).toHaveLength(2)
      })
    })

    it('should return single window for non-overlapping times', () => {
      const date = new Date('2024-01-01T00:00:00Z')
      const active = getActiveWindows(date)

      expect(active).toEqual(['na-prime'])
    })

    it('should return off-hours for uncovered times', () => {
      const date = new Date('2024-01-01T06:00:00Z')
      const active = getActiveWindows(date)

      expect(active).toEqual(['off-hours'])
    })

    it('should handle no timestamp (current time)', () => {
      const active = getActiveWindows()
      expect(active).toBeDefined()
      expect(active.length).toBeGreaterThan(0)
    })
  })

  describe('getCurrentActiveWindow', () => {
    it('should return a valid window', () => {
      const window = getCurrentActiveWindow()
      const validWindows: PrimeTimeWindow[] = [
        'na-prime',
        'eu-prime',
        'ocx',
        'sea',
        'off-hours',
      ]
      expect(validWindows).toContain(window)
    })
  })

  describe('getOffHoursPeriods', () => {
    it('should return periods not covered by any prime time', () => {
      const periods = getOffHoursPeriods()

      expect(periods.length).toBeGreaterThan(0)

      // Verify each period is actually off-hours
      periods.forEach((period) => {
        for (let hour = period.start; hour < period.end; hour++) {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const window = getPrimeTimeWindow(date)
          expect(window).toBe('off-hours')
        }
      })
    })

    it('should return continuous ranges', () => {
      const periods = getOffHoursPeriods()

      periods.forEach((period) => {
        expect(period.start).toBeLessThan(period.end)
        expect(period.start).toBeGreaterThanOrEqual(0)
        expect(period.end).toBeLessThanOrEqual(24)
      })
    })

    it('should not overlap with prime time windows', () => {
      const periods = getOffHoursPeriods()
      const primeTimeHours = new Set<number>()

      PRIME_TIME_WINDOWS.forEach((window) => {
        for (let hour = window.utcHourStart; hour < window.utcHourEnd; hour++) {
          primeTimeHours.add(hour)
        }
      })

      periods.forEach((period) => {
        for (let hour = period.start; hour < period.end; hour++) {
          expect(primeTimeHours.has(hour)).toBe(false)
        }
      })
    })
  })

  describe('getOffHoursDescription', () => {
    it('should return a formatted string', () => {
      const description = getOffHoursDescription()
      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
    })

    it('should contain time ranges', () => {
      const description = getOffHoursDescription()
      // Should contain AM or PM
      expect(description.match(/AM|PM/i)).toBeTruthy()
    })
  })

  describe('getTimeWindowInfo', () => {
    it('should return info for NA Prime Time', () => {
      const info = getTimeWindowInfo('na-prime')

      expect(info.id).toBe('na-prime')
      expect(info.name).toBe('NA Prime Time')
      expect(info.utcHourStart).toBe(0)
      expect(info.utcHourEnd).toBe(5)
    })

    it('should return info for EU Prime Time', () => {
      const info = getTimeWindowInfo('eu-prime')

      expect(info.id).toBe('eu-prime')
      expect(info.name).toBe('EU Prime Time')
      expect(info.utcHourStart).toBe(18)
      expect(info.utcHourEnd).toBe(23)
    })

    it('should return info for OCX', () => {
      const info = getTimeWindowInfo('ocx')

      expect(info.id).toBe('ocx')
      expect(info.name).toBe('OCX Prime Time')
      expect(info.utcHourStart).toBe(8)
      expect(info.utcHourEnd).toBe(13)
    })

    it('should return info for SEA', () => {
      const info = getTimeWindowInfo('sea')

      expect(info.id).toBe('sea')
      expect(info.name).toBe('SEA Prime Time')
      expect(info.utcHourStart).toBe(11)
      expect(info.utcHourEnd).toBe(16)
    })

    it('should return info for off-hours', () => {
      const info = getTimeWindowInfo('off-hours')

      expect(info.id).toBe('off-hours')
      expect(info.name).toBe('Off Hours')
    })

    it('should throw error for invalid window ID', () => {
      expect(() => getTimeWindowInfo('invalid' as PrimeTimeWindow)).toThrow()
    })
  })

  describe('getAllTimeWindows', () => {
    it('should return all 5 windows', () => {
      const allWindows = getAllTimeWindows()
      expect(allWindows).toHaveLength(5)
    })

    it('should include all prime time windows and off-hours', () => {
      const allWindows = getAllTimeWindows()
      const ids = allWindows.map((w) => w.id)

      expect(ids).toContain('na-prime')
      expect(ids).toContain('eu-prime')
      expect(ids).toContain('ocx')
      expect(ids).toContain('sea')
      expect(ids).toContain('off-hours')
    })
  })

  describe('groupByPrimeTimeWindow', () => {
    it('should group data points by window', () => {
      const data = [
        { timestamp: new Date('2024-01-01T00:00:00Z').getTime(), value: 1 }, // NA Prime
        { timestamp: new Date('2024-01-01T01:00:00Z').getTime(), value: 2 }, // NA Prime
        { timestamp: new Date('2024-01-01T18:00:00Z').getTime(), value: 3 }, // EU Prime
        { timestamp: new Date('2024-01-01T06:00:00Z').getTime(), value: 4 }, // Off-hours
      ]

      const grouped = groupByPrimeTimeWindow(data)

      expect(grouped['na-prime']).toHaveLength(2)
      expect(grouped['eu-prime']).toHaveLength(1)
      expect(grouped['off-hours']).toHaveLength(1)
      expect(grouped['ocx']).toHaveLength(0)
      expect(grouped['sea']).toHaveLength(0)
    })

    it('should handle string timestamps', () => {
      const data = [
        { timestamp: '2024-01-01T00:00:00Z', value: 1 },
        { timestamp: '2024-01-01T18:00:00Z', value: 2 },
      ]

      const grouped = groupByPrimeTimeWindow(data)

      expect(grouped['na-prime']).toHaveLength(1)
      expect(grouped['eu-prime']).toHaveLength(1)
    })

    it('should only keep most recent day per window', () => {
      const data = [
        // Day 1 - NA Prime
        { timestamp: new Date('2024-01-01T00:00:00Z').getTime(), value: 1 },
        { timestamp: new Date('2024-01-01T01:00:00Z').getTime(), value: 2 },
        // Day 2 - NA Prime (more recent)
        { timestamp: new Date('2024-01-02T00:00:00Z').getTime(), value: 3 },
      ]

      const grouped = groupByPrimeTimeWindow(data)

      // Should only have day 2 data
      expect(grouped['na-prime']).toHaveLength(1)
      expect(grouped['na-prime'][0].value).toBe(3)
    })

    it('should handle empty data', () => {
      const grouped = groupByPrimeTimeWindow([])

      expect(grouped['na-prime']).toHaveLength(0)
      expect(grouped['eu-prime']).toHaveLength(0)
      expect(grouped['ocx']).toHaveLength(0)
      expect(grouped['sea']).toHaveLength(0)
      expect(grouped['off-hours']).toHaveLength(0)
    })
  })

  describe('calculateWindowCoverage', () => {
    it('should calculate percentage for each window', () => {
      const data = [
        { timestamp: new Date('2024-01-01T00:00:00Z').getTime() }, // NA Prime
        { timestamp: new Date('2024-01-01T01:00:00Z').getTime() }, // NA Prime
        { timestamp: new Date('2024-01-01T18:00:00Z').getTime() }, // EU Prime
        { timestamp: new Date('2024-01-01T06:00:00Z').getTime() }, // Off-hours
      ]

      const coverage = calculateWindowCoverage(data)

      // Note: groupByPrimeTimeWindow only keeps most recent day, so coverage is based on that
      expect(coverage['na-prime']).toBeGreaterThan(0)
      expect(coverage['eu-prime']).toBeGreaterThan(0)
      expect(coverage['off-hours']).toBeGreaterThan(0)

      // All percentages should sum to 100 (or close due to rounding)
      const total =
        coverage['na-prime'] +
        coverage['eu-prime'] +
        coverage['ocx'] +
        coverage['sea'] +
        coverage['off-hours']

      expect(total).toBeCloseTo(100, 1)
    })

    it('should handle empty data', () => {
      const coverage = calculateWindowCoverage([])

      expect(coverage['na-prime']).toBe(0)
      expect(coverage['eu-prime']).toBe(0)
      expect(coverage['ocx']).toBe(0)
      expect(coverage['sea']).toBe(0)
      expect(coverage['off-hours']).toBe(0)
    })

    it('should handle data from single window', () => {
      const data = [
        { timestamp: new Date('2024-01-01T00:00:00Z').getTime() },
        { timestamp: new Date('2024-01-01T01:00:00Z').getTime() },
      ]

      const coverage = calculateWindowCoverage(data)

      expect(coverage['na-prime']).toBeGreaterThan(0)
      expect(coverage['eu-prime']).toBe(0)
      expect(coverage['ocx']).toBe(0)
      expect(coverage['sea']).toBe(0)
    })
  })

  describe('Window Boundaries', () => {
    it('should handle exact boundary times correctly', () => {
      // Start of NA Prime (0:00 UTC)
      const naStart = new Date('2024-01-01T00:00:00Z')
      expect(getPrimeTimeWindow(naStart)).toBe('na-prime')

      // End of NA Prime (4:59:59 UTC) - should still be NA Prime
      const naEnd = new Date('2024-01-01T04:59:59Z')
      expect(getPrimeTimeWindow(naEnd)).toBe('na-prime')

      // Just after NA Prime (5:00 UTC) - should be off-hours
      const afterNA = new Date('2024-01-01T05:00:00Z')
      expect(getPrimeTimeWindow(afterNA)).toBe('off-hours')
    })

    it('should handle overlapping windows correctly', () => {
      // 11:00 UTC - overlaps OCX and SEA
      const overlap = new Date('2024-01-01T11:00:00Z')
      const active = getActiveWindows(overlap)

      expect(active).toContain('ocx')
      expect(active).toContain('sea')
    })
  })

  describe('Edge Cases', () => {
    it('should handle leap year dates', () => {
      const leapDate = new Date('2024-02-29T12:00:00Z')
      expect(() => getPrimeTimeWindow(leapDate)).not.toThrow()
    })

    it('should handle year boundaries', () => {
      const newYear = new Date('2024-01-01T00:00:00Z')
      expect(getPrimeTimeWindow(newYear)).toBe('na-prime')
    })

    it('should handle different years consistently', () => {
      const date1 = new Date('2024-01-01T18:00:00Z')
      const date2 = new Date('2025-01-01T18:00:00Z')

      expect(getPrimeTimeWindow(date1)).toBe(getPrimeTimeWindow(date2))
    })
  })

  describe('Integration Tests', () => {
    it('should cover all 24 hours of the day', () => {
      const windowCounts: Record<PrimeTimeWindow, number> = {
        'na-prime': 0,
        'eu-prime': 0,
        'ocx': 0,
        'sea': 0,
        'off-hours': 0,
      }

      for (let hour = 0; hour < 24; hour++) {
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
        const window = getPrimeTimeWindow(date)
        windowCounts[window]++
      }

      // Sum should be 24 hours
      const total = Object.values(windowCounts).reduce((sum, count) => sum + count, 0)
      expect(total).toBe(24)

      // Each window should have some coverage
      expect(windowCounts['na-prime']).toBeGreaterThan(0)
      expect(windowCounts['eu-prime']).toBeGreaterThan(0)
      expect(windowCounts['ocx']).toBeGreaterThan(0)
      expect(windowCounts['sea']).toBeGreaterThan(0)
    })

    it('should correctly identify a full match worth of data', () => {
      // Create 7 days worth of data (1 match)
      const data = []
      const startDate = new Date('2024-01-01T00:00:00Z')

      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour += 2) {
          // Skirmishes every 2 hours
          const timestamp = new Date(startDate)
          timestamp.setUTCDate(startDate.getUTCDate() + day)
          timestamp.setUTCHours(hour)

          data.push({ timestamp: timestamp.getTime() })
        }
      }

      const grouped = groupByPrimeTimeWindow(data)

      // Should have data in multiple windows
      const windowsWithData = Object.entries(grouped).filter(
        ([_, values]) => values.length > 0
      )

      expect(windowsWithData.length).toBeGreaterThan(0)
    })
  })

  describe('PRIME_TIME_WINDOWS Constant', () => {
    it('should have 4 defined windows', () => {
      expect(PRIME_TIME_WINDOWS).toHaveLength(4)
    })

    it('should have all required properties', () => {
      PRIME_TIME_WINDOWS.forEach((window) => {
        expect(window.id).toBeDefined()
        expect(window.name).toBeDefined()
        expect(window.description).toBeDefined()
        expect(window.utcHourStart).toBeDefined()
        expect(window.utcHourEnd).toBeDefined()
        expect(window.color).toBeDefined()
      })
    })

    it('should have valid UTC hour ranges', () => {
      PRIME_TIME_WINDOWS.forEach((window) => {
        expect(window.utcHourStart).toBeGreaterThanOrEqual(0)
        expect(window.utcHourStart).toBeLessThan(24)
        expect(window.utcHourEnd).toBeGreaterThan(0)
        expect(window.utcHourEnd).toBeLessThanOrEqual(24)
        expect(window.utcHourEnd).toBeGreaterThan(window.utcHourStart)
      })
    })
  })
})
