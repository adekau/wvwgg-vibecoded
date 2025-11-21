/**
 * Unit tests for Historical Performance Analyzer
 *
 * Tests the analysis of completed skirmishes and calculation of
 * placement probabilities for VP prediction.
 */

import {
  analyzeHistoricalPerformance,
  convertMatchSkirmishesToResults,
  calculateRequiredPerformance,
  getTimeWindow,
  type SkirmishResult,
  type TeamHistoricalStats,
} from '@/lib/historical-performance'

describe('Historical Performance Analyzer', () => {
  describe('getTimeWindow', () => {
    it('should identify NA Prime time correctly', () => {
      // 2 AM UTC (9 PM ET previous day)
      const date = new Date('2024-01-01T02:00:00Z')
      expect(getTimeWindow(date, 'na')).toBe('naPrime')
    })

    it('should identify EU Prime time correctly', () => {
      // 8 PM UTC (8 PM CET)
      const date = new Date('2024-01-01T20:00:00Z')
      expect(getTimeWindow(date, 'na')).toBe('euPrime')
    })

    it('should identify OCX time correctly', () => {
      // 10 AM UTC
      const date = new Date('2024-01-01T10:00:00Z')
      expect(getTimeWindow(date, 'na')).toBe('ocx')
    })

    it('should identify Off Hours correctly', () => {
      // 6 AM UTC (not in any prime window)
      const date = new Date('2024-01-01T06:00:00Z')
      expect(getTimeWindow(date, 'na')).toBe('offHours')
    })
  })

  describe('convertMatchSkirmishesToResults', () => {
    it('should convert skirmish data to results format', () => {
      const skirmishes = [
        {
          id: 0,
          scores: { red: 150, blue: 100, green: 75 },
          vpTier: { first: 5, second: 4, third: 3 },
        },
        {
          id: 1,
          scores: { red: 120, blue: 140, green: 90 },
          vpTier: { first: 5, second: 4, third: 3 },
        },
      ]

      const matchStartDate = new Date('2024-01-01T00:00:00Z')
      const results = convertMatchSkirmishesToResults(skirmishes, matchStartDate, 'na')

      expect(results).toHaveLength(2)

      // First skirmish: Red 1st, Blue 2nd, Green 3rd
      expect(results[0].placements).toEqual({
        red: 1,
        blue: 2,
        green: 3,
      })
      expect(results[0].vpAwarded).toEqual({
        red: 5,
        blue: 4,
        green: 3,
      })

      // Second skirmish: Blue 1st, Red 2nd, Green 3rd
      expect(results[1].placements).toEqual({
        blue: 1,
        red: 2,
        green: 3,
      })
      expect(results[1].vpAwarded).toEqual({
        blue: 5,
        red: 4,
        green: 3,
      })
    })

    it('should calculate correct timestamps for skirmishes', () => {
      const skirmishes = [
        { id: 0, scores: { red: 100, blue: 90, green: 80 } },
        { id: 1, scores: { red: 100, blue: 90, green: 80 } },
      ]

      const matchStartDate = new Date('2024-01-01T00:00:00Z')
      const results = convertMatchSkirmishesToResults(skirmishes, matchStartDate, 'na')

      // First skirmish at match start
      expect(results[0].timestamp).toEqual(new Date('2024-01-01T00:00:00Z'))

      // Second skirmish 2 hours later
      expect(results[1].timestamp).toEqual(new Date('2024-01-01T02:00:00Z'))
    })
  })

  describe('analyzeHistoricalPerformance', () => {
    it('should calculate overall statistics correctly', () => {
      const skirmishes: SkirmishResult[] = [
        {
          skirmishId: 0,
          timestamp: new Date('2024-01-01T00:00:00Z'),
          placements: { red: 1, blue: 2, green: 3 },
          scores: { red: 150, blue: 100, green: 75 },
          vpAwarded: { red: 5, blue: 4, green: 3 },
        },
        {
          skirmishId: 1,
          timestamp: new Date('2024-01-01T02:00:00Z'),
          placements: { red: 1, blue: 3, green: 2 },
          scores: { red: 140, blue: 90, green: 95 },
          vpAwarded: { red: 5, blue: 3, green: 4 },
        },
        {
          skirmishId: 2,
          timestamp: new Date('2024-01-01T04:00:00Z'),
          placements: { red: 2, blue: 1, green: 3 },
          scores: { red: 120, blue: 130, green: 80 },
          vpAwarded: { red: 4, blue: 5, green: 3 },
        },
      ]

      const stats = analyzeHistoricalPerformance(skirmishes, 'red', 'Red Team', 'na')

      expect(stats.teamColor).toBe('red')
      expect(stats.teamName).toBe('Red Team')
      expect(stats.overall.totalSkirmishes).toBe(3)
      expect(stats.overall.placements.first).toBe(2)
      expect(stats.overall.placements.second).toBe(1)
      expect(stats.overall.placements.third).toBe(0)
    })

    it('should calculate placement probabilities correctly', () => {
      const skirmishes: SkirmishResult[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          skirmishId: i,
          timestamp: new Date(`2024-01-01T${i * 2}:00:00Z`),
          placements: {
            red: i < 5 ? 1 : i < 8 ? 2 : 3, // 5 firsts, 3 seconds, 2 thirds
            blue: 2 as 1 | 2 | 3,
            green: 3 as 1 | 2 | 3,
          },
          scores: { red: 100, blue: 90, green: 80 },
          vpAwarded: { red: 5, blue: 4, green: 3 },
        }))

      const stats = analyzeHistoricalPerformance(skirmishes, 'red', 'Red Team', 'na')

      expect(stats.placementProbability.first).toBe(0.5) // 5/10
      expect(stats.placementProbability.second).toBe(0.3) // 3/10
      expect(stats.placementProbability.third).toBe(0.2) // 2/10
    })

    it('should categorize skirmishes by time window', () => {
      const skirmishes: SkirmishResult[] = [
        // NA Prime (2 AM UTC)
        {
          skirmishId: 0,
          timestamp: new Date('2024-01-01T02:00:00Z'),
          placements: { red: 1, blue: 2, green: 3 },
          scores: { red: 100, blue: 90, green: 80 },
          vpAwarded: { red: 5, blue: 4, green: 3 },
        },
        // EU Prime (8 PM UTC)
        {
          skirmishId: 1,
          timestamp: new Date('2024-01-01T20:00:00Z'),
          placements: { red: 2, blue: 1, green: 3 },
          scores: { red: 90, blue: 100, green: 80 },
          vpAwarded: { red: 4, blue: 5, green: 3 },
        },
        // OCX (10 AM UTC)
        {
          skirmishId: 2,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          placements: { red: 3, blue: 2, green: 1 },
          scores: { red: 80, blue: 90, green: 100 },
          vpAwarded: { red: 3, blue: 4, green: 5 },
        },
      ]

      const stats = analyzeHistoricalPerformance(skirmishes, 'red', 'Red Team', 'na')

      expect(stats.byWindow.naPrime.totalSkirmishes).toBe(1)
      expect(stats.byWindow.naPrime.placements.first).toBe(1)

      expect(stats.byWindow.euPrime.totalSkirmishes).toBe(1)
      expect(stats.byWindow.euPrime.placements.second).toBe(1)

      expect(stats.byWindow.ocx.totalSkirmishes).toBe(1)
      expect(stats.byWindow.ocx.placements.third).toBe(1)
    })

    it('should handle no historical data gracefully', () => {
      const stats = analyzeHistoricalPerformance([], 'red', 'Red Team', 'na')

      expect(stats.overall.totalSkirmishes).toBe(0)
      // Should have default probabilities (roughly equal)
      expect(stats.placementProbability.first).toBeCloseTo(0.33, 1)
      expect(stats.placementProbability.second).toBeCloseTo(0.34, 1)
      expect(stats.placementProbability.third).toBeCloseTo(0.33, 1)
    })

    it('should use overall probabilities when window has no data', () => {
      const skirmishes: SkirmishResult[] = [
        // Only NA Prime data
        {
          skirmishId: 0,
          timestamp: new Date('2024-01-01T02:00:00Z'),
          placements: { red: 1, blue: 2, green: 3 },
          scores: { red: 100, blue: 90, green: 80 },
          vpAwarded: { red: 5, blue: 4, green: 3 },
        },
        {
          skirmishId: 1,
          timestamp: new Date('2024-01-01T04:00:00Z'),
          placements: { red: 1, blue: 2, green: 3 },
          scores: { red: 100, blue: 90, green: 80 },
          vpAwarded: { red: 5, blue: 4, green: 3 },
        },
      ]

      const stats = analyzeHistoricalPerformance(skirmishes, 'red', 'Red Team', 'na')

      // NA Prime has data
      expect(stats.byWindow.naPrime.totalSkirmishes).toBe(2)

      // EU Prime has no data, should use overall
      expect(stats.byWindow.euPrime.totalSkirmishes).toBe(0)
      expect(stats.placementProbabilityByWindow.euPrime).toEqual(stats.placementProbability)
    })
  })

  describe('calculateRequiredPerformance', () => {
    it('should calculate required performance for desired outcome', () => {
      const currentVP = { red: 1000, blue: 950, green: 900 }
      const remainingSkirmishes = 15
      const avgVP = { first: 5, second: 4, third: 3 }
      const desiredOutcome = { first: 'red' as const, second: 'blue' as const, third: 'green' as const }

      const historicalStats = {
        red: {
          placementProbability: { first: 0.4, second: 0.3, third: 0.3 },
        },
        blue: {
          placementProbability: { first: 0.35, second: 0.35, third: 0.3 },
        },
        green: {
          placementProbability: { first: 0.25, second: 0.35, third: 0.4 },
        },
      } as any

      const results = calculateRequiredPerformance(
        currentVP,
        remainingSkirmishes,
        avgVP,
        desiredOutcome,
        historicalStats
      )

      expect(results).toHaveLength(3)
      expect(results[0].team).toBe('red')
      expect(results[0].historicalWinRate).toBe(0.4)
      expect(results[0].difficulty).toBeDefined()
    })

    it('should assess difficulty based on required vs historical win rate', () => {
      const currentVP = { red: 1000, blue: 1100, green: 900 } // Red is behind
      const remainingSkirmishes = 10
      const avgVP = { first: 5, second: 4, third: 3 }
      const desiredOutcome = { first: 'red' as const, second: 'blue' as const, third: 'green' as const }

      const historicalStats = {
        red: {
          placementProbability: { first: 0.3, second: 0.3, third: 0.4 }, // Red historically weak
        },
        blue: {
          placementProbability: { first: 0.5, second: 0.3, third: 0.2 }, // Blue historically strong
        },
        green: {
          placementProbability: { first: 0.2, second: 0.4, third: 0.4 },
        },
      } as any

      const results = calculateRequiredPerformance(
        currentVP,
        remainingSkirmishes,
        avgVP,
        desiredOutcome,
        historicalStats
      )

      // Red needs to overcome deficit despite weak history = hard
      const redResult = results.find(r => r.team === 'red')
      expect(redResult?.difficulty).toMatch(/hard|very-hard/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle all teams with identical scores', () => {
      const skirmishes: SkirmishResult[] = [
        {
          skirmishId: 0,
          timestamp: new Date('2024-01-01T00:00:00Z'),
          placements: { red: 1, blue: 2, green: 3 },
          scores: { red: 100, blue: 100, green: 100 }, // Identical scores
          vpAwarded: { red: 5, blue: 4, green: 3 },
        },
      ]

      const stats = analyzeHistoricalPerformance(skirmishes, 'red', 'Red Team', 'na')

      expect(stats.overall.totalSkirmishes).toBe(1)
      expect(stats.placementProbability.first).toBe(1) // Red was 1st despite tie
    })

    it('should handle very long match history', () => {
      // Create 1000 skirmishes
      const skirmishes: SkirmishResult[] = Array(1000)
        .fill(null)
        .map((_, i) => ({
          skirmishId: i,
          timestamp: new Date(`2024-01-01T${i % 24}:00:00Z`),
          placements: {
            red: (i % 3) + 1 as 1 | 2 | 3,
            blue: 2 as 1 | 2 | 3,
            green: 3 as 1 | 2 | 3,
          },
          scores: { red: 100, blue: 90, green: 80 },
          vpAwarded: { red: 5, blue: 4, green: 3 },
        }))

      const startTime = Date.now()
      const stats = analyzeHistoricalPerformance(skirmishes, 'red', 'Red Team', 'na')
      const duration = Date.now() - startTime

      expect(stats.overall.totalSkirmishes).toBe(1000)
      expect(duration).toBeLessThan(100) // Should be fast
    })
  })
})
