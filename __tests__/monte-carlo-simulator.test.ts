/**
 * Unit tests for Monte Carlo Simulator
 *
 * Tests the simulation engine that predicts match outcomes
 * using historical probability distributions.
 */

import {
  runMonteCarloSimulation,
  analyzeSimulations,
  calculateRiskAssessment,
  type SimulationResult,
  type SkirmishInfo,
} from '@/lib/monte-carlo-simulator'
import type { TeamHistoricalStats } from '@/lib/historical-performance'

// Helper to create mock historical stats
function createMockHistoricalStats(
  teamColor: 'red' | 'blue' | 'green',
  firstRate: number,
  secondRate: number,
  thirdRate: number
): TeamHistoricalStats {
  return {
    teamColor,
    teamName: `${teamColor} Team`,
    overall: {
      totalSkirmishes: 100,
      placements: { first: firstRate * 100, second: secondRate * 100, third: thirdRate * 100 },
      averageScore: 100,
      averageVP: 4,
    },
    byWindow: {
      naPrime: {
        totalSkirmishes: 25,
        placements: { first: firstRate * 25, second: secondRate * 25, third: thirdRate * 25 },
        averageScore: 100,
        averageVP: 4,
      },
      euPrime: {
        totalSkirmishes: 25,
        placements: { first: firstRate * 25, second: secondRate * 25, third: thirdRate * 25 },
        averageScore: 100,
        averageVP: 4,
      },
      ocx: {
        totalSkirmishes: 25,
        placements: { first: firstRate * 25, second: secondRate * 25, third: thirdRate * 25 },
        averageScore: 100,
        averageVP: 4,
      },
      offHours: {
        totalSkirmishes: 25,
        placements: { first: firstRate * 25, second: secondRate * 25, third: thirdRate * 25 },
        averageScore: 100,
        averageVP: 4,
      },
    },
    placementProbability: {
      first: firstRate,
      second: secondRate,
      third: thirdRate,
    },
    placementProbabilityByWindow: {
      naPrime: { first: firstRate, second: secondRate, third: thirdRate },
      euPrime: { first: firstRate, second: secondRate, third: thirdRate },
      ocx: { first: firstRate, second: secondRate, third: thirdRate },
      offHours: { first: firstRate, second: secondRate, third: thirdRate },
    },
  }
}

describe('Monte Carlo Simulator', () => {
  const currentVP = { red: 1000, blue: 950, green: 900 }

  const remainingSkirmishes: SkirmishInfo[] = [
    {
      id: 50,
      startTime: new Date('2024-01-05T00:00:00Z'),
      vpAwards: { first: 5, second: 4, third: 3 },
    },
    {
      id: 51,
      startTime: new Date('2024-01-05T02:00:00Z'),
      vpAwards: { first: 5, second: 4, third: 3 },
    },
    {
      id: 52,
      startTime: new Date('2024-01-05T04:00:00Z'),
      vpAwards: { first: 5, second: 4, third: 3 },
    },
  ]

  const historicalStats = {
    red: createMockHistoricalStats('red', 0.5, 0.3, 0.2), // Red strong
    blue: createMockHistoricalStats('blue', 0.3, 0.4, 0.3), // Blue moderate
    green: createMockHistoricalStats('green', 0.2, 0.3, 0.5), // Green weak
  }

  describe('runMonteCarloSimulation', () => {
    it('should run specified number of simulations', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        100 // Small number for testing
      )

      expect(result.iterations).toBe(100)
      expect(result.simulations).toHaveLength(100)
    })

    it('should produce valid simulation results', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        10
      )

      result.simulations.forEach((sim) => {
        // Check final VP increased
        expect(sim.finalVP.red).toBeGreaterThanOrEqual(currentVP.red)
        expect(sim.finalVP.blue).toBeGreaterThanOrEqual(currentVP.blue)
        expect(sim.finalVP.green).toBeGreaterThanOrEqual(currentVP.green)

        // Check standings are valid
        const standings = [sim.finalStandings.first, sim.finalStandings.second, sim.finalStandings.third]
        expect(new Set(standings).size).toBe(3) // All unique
        expect(standings).toContain('red')
        expect(standings).toContain('blue')
        expect(standings).toContain('green')

        // Check placements for each skirmish
        expect(sim.placements).toHaveLength(remainingSkirmishes.length)
      })
    })

    it('should reflect historical probabilities in outcomes', () => {
      // Run many simulations to get statistical significance
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        1000
      )

      // Red has highest first-place probability (0.5), should win most often
      expect(result.teamPositionProbabilities.red.first).toBeGreaterThan(
        result.teamPositionProbabilities.blue.first
      )
      expect(result.teamPositionProbabilities.red.first).toBeGreaterThan(
        result.teamPositionProbabilities.green.first
      )

      // Green has highest third-place probability (0.5), should finish last most often
      expect(result.teamPositionProbabilities.green.third).toBeGreaterThan(
        result.teamPositionProbabilities.blue.third
      )
      expect(result.teamPositionProbabilities.green.third).toBeGreaterThan(
        result.teamPositionProbabilities.red.third
      )
    })

    it('should have probabilities sum to 1 for each team', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        100
      )

      ;['red', 'blue', 'green'].forEach((team) => {
        const probs = result.teamPositionProbabilities[team as 'red' | 'blue' | 'green']
        const sum = probs.first + probs.second + probs.third
        expect(sum).toBeCloseTo(1, 5)
      })
    })

    it('should calculate confidence intervals correctly', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        100
      )

      ;['red', 'blue', 'green'].forEach((team) => {
        const ci = result.vpConfidenceIntervals[team as 'red' | 'blue' | 'green']

        // p10 < p50 < p90
        expect(ci.p10).toBeLessThan(ci.p50)
        expect(ci.p50).toBeLessThan(ci.p90)

        // All should be at least current VP
        expect(ci.p10).toBeGreaterThanOrEqual(currentVP[team as 'red' | 'blue' | 'green'])
      })
    })

    it('should identify most likely outcome', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        1000
      )

      expect(result.mostLikelyOutcome).toBeDefined()
      expect(result.mostLikelyProbability).toBeGreaterThan(0)
      expect(result.mostLikelyProbability).toBeLessThanOrEqual(1)

      // Most likely outcome should be in the outcomes list
      const found = result.outcomeProbabilities.find(
        (o) =>
          o.outcome.first === result.mostLikelyOutcome.first &&
          o.outcome.second === result.mostLikelyOutcome.second &&
          o.outcome.third === result.mostLikelyOutcome.third
      )
      expect(found).toBeDefined()
      expect(found?.probability).toBe(result.mostLikelyProbability)
    })

    it('should rank outcomes by probability', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        1000
      )

      // Check that outcomes are sorted descending by probability
      for (let i = 1; i < result.outcomeProbabilities.length; i++) {
        expect(result.outcomeProbabilities[i - 1].probability).toBeGreaterThanOrEqual(
          result.outcomeProbabilities[i].probability
        )
      }
    })

    it('should have outcome probabilities sum to 1', () => {
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        1000
      )

      const sum = result.outcomeProbabilities.reduce((acc, o) => acc + o.probability, 0)
      expect(sum).toBeCloseTo(1, 5)
    })
  })

  describe('analyzeSimulations', () => {
    it('should analyze pre-computed simulations correctly', () => {
      // Create mock simulations
      const simulations: SimulationResult[] = [
        {
          finalVP: { red: 1015, blue: 962, green: 909 },
          finalStandings: { first: 'red', second: 'blue', third: 'green' },
          placements: [],
        },
        {
          finalVP: { red: 1010, blue: 966, green: 912 },
          finalStandings: { first: 'red', second: 'blue', third: 'green' },
          placements: [],
        },
        {
          finalVP: { red: 1005, blue: 970, green: 915 },
          finalStandings: { first: 'red', second: 'blue', third: 'green' },
          placements: [],
        },
      ]

      const result = analyzeSimulations(simulations)

      expect(result.iterations).toBe(3)
      expect(result.mostLikelyOutcome).toEqual({ first: 'red', second: 'blue', third: 'green' })
      expect(result.mostLikelyProbability).toBe(1) // All 3 had same outcome
    })

    it('should handle mixed outcomes correctly', () => {
      const simulations: SimulationResult[] = [
        {
          finalVP: { red: 1015, blue: 962, green: 909 },
          finalStandings: { first: 'red', second: 'blue', third: 'green' },
          placements: [],
        },
        {
          finalVP: { red: 1010, blue: 970, green: 912 },
          finalStandings: { first: 'red', second: 'blue', third: 'green' },
          placements: [],
        },
        {
          finalVP: { red: 1005, blue: 980, green: 915 },
          finalStandings: { first: 'red', second: 'blue', third: 'green' },
          placements: [],
        },
        {
          finalVP: { red: 1000, blue: 985, green: 920 },
          finalStandings: { first: 'blue', second: 'red', third: 'green' },
          placements: [],
        },
      ]

      const result = analyzeSimulations(simulations)

      expect(result.iterations).toBe(4)
      expect(result.outcomeProbabilities).toHaveLength(2) // 2 unique outcomes
      expect(result.mostLikelyProbability).toBe(0.75) // 3 out of 4
    })
  })

  describe('calculateRiskAssessment', () => {
    it('should assess very likely outcomes as very low risk', () => {
      const desiredOutcome = { first: 'red' as const, second: 'blue' as const, third: 'green' as const }

      const mockResult = {
        iterations: 1000,
        simulations: [],
        outcomeProbabilities: [
          { outcome: desiredOutcome, probability: 0.8, count: 800 },
        ],
        mostLikelyOutcome: desiredOutcome,
        mostLikelyProbability: 0.8,
        vpConfidenceIntervals: {} as any,
        teamPositionProbabilities: {} as any,
        averageFinalVP: {} as any,
      }

      const risk = calculateRiskAssessment(desiredOutcome, mockResult)

      expect(risk.probability).toBe(0.8)
      expect(risk.risk).toBe('very-low')
      expect(risk.message).toContain('Very likely')
    })

    it('should assess unlikely outcomes as high risk', () => {
      const desiredOutcome = { first: 'green' as const, second: 'blue' as const, third: 'red' as const }

      const mockResult = {
        iterations: 1000,
        simulations: [],
        outcomeProbabilities: [
          { outcome: { first: 'red', second: 'blue', third: 'green' }, probability: 0.7, count: 700 },
          { outcome: desiredOutcome, probability: 0.15, count: 150 },
        ],
        mostLikelyOutcome: { first: 'red', second: 'blue', third: 'green' },
        mostLikelyProbability: 0.7,
        vpConfidenceIntervals: {} as any,
        teamPositionProbabilities: {} as any,
        averageFinalVP: {} as any,
      }

      const risk = calculateRiskAssessment(desiredOutcome, mockResult)

      expect(risk.probability).toBe(0.15)
      expect(risk.risk).toBe('high')
      expect(risk.message).toContain('Unlikely')
    })

    it('should handle outcome not in results (probability 0)', () => {
      const desiredOutcome = { first: 'green' as const, second: 'red' as const, third: 'blue' as const }

      const mockResult = {
        iterations: 1000,
        simulations: [],
        outcomeProbabilities: [
          { outcome: { first: 'red', second: 'blue', third: 'green' }, probability: 1.0, count: 1000 },
        ],
        mostLikelyOutcome: { first: 'red', second: 'blue', third: 'green' },
        mostLikelyProbability: 1.0,
        vpConfidenceIntervals: {} as any,
        teamPositionProbabilities: {} as any,
        averageFinalVP: {} as any,
      }

      const risk = calculateRiskAssessment(desiredOutcome, mockResult)

      expect(risk.probability).toBe(0)
      expect(risk.risk).toBe('very-high')
      expect(risk.message).toContain('Very unlikely')
    })
  })

  describe('Performance', () => {
    it('should handle 10,000 simulations in reasonable time', () => {
      const startTime = Date.now()

      runMonteCarloSimulation(currentVP, remainingSkirmishes, historicalStats, 'na', 10000)

      const duration = Date.now() - startTime

      // Should complete in less than 5 seconds
      expect(duration).toBeLessThan(5000)
    })

    it('should not use excessive memory for large simulation counts', () => {
      // This test would ideally use process.memoryUsage() in Node.js
      // For now, just ensure it completes without crashing
      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        'na',
        50000
      )

      expect(result.iterations).toBe(50000)
    })
  })

  describe('Edge Cases', () => {
    it('should handle no remaining skirmishes', () => {
      const result = runMonteCarloSimulation(currentVP, [], historicalStats, 'na', 100)

      // All simulations should have same outcome (current standings)
      expect(result.simulations[0].finalVP).toEqual(currentVP)
    })

    it('should handle team with 100% win rate', () => {
      const dominantStats = {
        red: createMockHistoricalStats('red', 1.0, 0.0, 0.0), // Always first
        blue: createMockHistoricalStats('blue', 0.0, 1.0, 0.0), // Always second
        green: createMockHistoricalStats('green', 0.0, 0.0, 1.0), // Always third
      }

      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        dominantStats,
        'na',
        100
      )

      // Should predict red always finishes first
      expect(result.teamPositionProbabilities.red.first).toBeCloseTo(1, 1)
      expect(result.teamPositionProbabilities.blue.second).toBeCloseTo(1, 1)
      expect(result.teamPositionProbabilities.green.third).toBeCloseTo(1, 1)
    })

    it('should handle equal probabilities (coin flip)', () => {
      const equalStats = {
        red: createMockHistoricalStats('red', 0.33, 0.33, 0.34),
        blue: createMockHistoricalStats('blue', 0.33, 0.34, 0.33),
        green: createMockHistoricalStats('green', 0.34, 0.33, 0.33),
      }

      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        equalStats,
        'na',
        1000
      )

      // Each team should have roughly equal chance at each position
      ;['red', 'blue', 'green'].forEach((team) => {
        const probs = result.teamPositionProbabilities[team as 'red' | 'blue' | 'green']
        expect(probs.first).toBeCloseTo(0.33, 1)
        expect(probs.second).toBeCloseTo(0.33, 1)
        expect(probs.third).toBeCloseTo(0.33, 1)
      })
    })
  })
})
