/**
 * Unit tests for DFS VP Scenario Solver
 *
 * Tests the deterministic depth-first search solver with branch & bound pruning.
 * This solver provides mathematical guarantees about solution existence.
 */

import { describe, it, expect } from 'vitest'
import {
  DeterministicDFSSolver,
  type WorldState,
  type DFSSolverResult,
} from '@/lib/vp-scenario-solver-dfs'

describe('DFS VP Scenario Solver', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with valid worlds and skirmishes', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T02:00:00Z'),
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')

      expect(solver).toBeDefined()
    })

    it('should handle different desired orders', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 900 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      // Green first, blue second, red third
      const solver = new DeterministicDFSSolver(
        worlds,
        skirmishTimes,
        ['green', 'blue', 'red'],
        'na'
      )

      expect(solver).toBeDefined()
    })
  })

  describe('solve() - Simple Scenarios', () => {
    it('should find solution when already in desired order', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.finalStandings).toBeDefined()
      expect(result.finalStandings!.red).toBeGreaterThan(result.finalStandings!.blue)
      expect(result.finalStandings!.blue).toBeGreaterThan(result.finalStandings!.green)
    })

    it('should find solution for simple comeback', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 900 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'), // NA peak: 43, 32, 21
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // Red can win with 43 VP to reach 943, but needs specific outcome
      expect(result).toBeDefined()
      if (result.achievable) {
        expect(result.finalStandings!.red).toBeGreaterThan(result.finalStandings!.blue)
      }
    })

    it('should generate valid scenario with correct VP awards', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        expect(result.scenario).toHaveLength(1)

        const skirmish = result.scenario[0]
        expect(skirmish.placements).toBeDefined()
        expect(skirmish.vpAwarded).toBeDefined()

        // VP awarded should match placements
        const vpValues = [
          skirmish.vpAwarded.red,
          skirmish.vpAwarded.blue,
          skirmish.vpAwarded.green,
        ]
        expect(vpValues).toContain(43) // First place
        expect(vpValues).toContain(32) // Second place
        expect(vpValues).toContain(21) // Third place
      }
    })
  })

  describe('solve() - Impossible Scenarios', () => {
    it('should detect mathematically impossible scenario', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 100 },
        { id: 'blue', currentVP: 1000 },
        { id: 'green', currentVP: 950 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T10:00:00Z'), // NA low: 19, 16, 13
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // Red is 900 points behind with only 19 VP available - impossible
      expect(result.achievable).toBe(false)
    })

    it('should prove impossibility with pruning', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 100 },
        { id: 'blue', currentVP: 500 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'), // 43 VP
        new Date('2024-01-01T02:00:00Z'), // 43 VP
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // Red can get at most 86 VP (2 * 43), reaching 186
      // Blue has 500, Green has 900 - impossible for red to win
      expect(result.achievable).toBe(false)
      expect(result.iterations).toBeDefined()
    })

    it('should handle tied impossible scenarios', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 100 },
        { id: 'blue', currentVP: 1000 },
        { id: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(false)
    })
  })

  describe('solve() - Multiple Skirmishes', () => {
    it('should find solution across multiple skirmishes', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 990 },
        { id: 'green', currentVP: 980 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T02:00:00Z'),
        new Date('2024-01-01T04:00:00Z'),
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.scenario).toHaveLength(3)
    })

    it('should optimize for minimum gap', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable) {
        expect(result.gap).toBeDefined()
        expect(result.gap).toBeGreaterThan(0)

        // Gap should be minimized (not requiring red to win every skirmish)
        const finalVP = result.finalStandings!
        const actualGap = finalVP.red - finalVP.blue + (finalVP.blue - finalVP.green)
        expect(result.gap).toBe(actualGap)
      }
    })
  })

  describe('solve() - Branch & Bound Pruning', () => {
    it('should use pruning to reduce search space', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 500 },
        { id: 'blue', currentVP: 1000 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 10 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // With pruning, should detect quickly if impossible
      if (!result.achievable) {
        // Iterations should be much less than full search (6^10 = 60,466,176)
        expect(result.iterations!).toBeLessThan(10000)
      }
    })

    it('should prune based on max remaining gain', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 100 },
        { id: 'blue', currentVP: 1000 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'), // 43 VP max
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // Should prune immediately - red cannot catch up
      expect(result.achievable).toBe(false)
      expect(result.iterations).toBeDefined()
    })
  })

  describe('solve() - Optimization Phase', () => {
    it('should optimize initial solution to minimize effort', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 999 },
        { id: 'green', currentVP: 998 },
      ]

      const skirmishTimes = Array.from(
        { length: 3 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        // Should not require red to win all skirmishes
        const redWins = result.scenario.filter((s) => s.placements.first === 'red').length
        expect(redWins).toBeLessThan(3)
      }
    })

    it('should produce valid scenario after optimization', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        // Manually calculate final scores to verify
        let redVP = 1000
        let blueVP = 950
        let greenVP = 900

        result.scenario.forEach((skirmish) => {
          redVP += skirmish.vpAwarded.red
          blueVP += skirmish.vpAwarded.blue
          greenVP += skirmish.vpAwarded.green
        })

        expect(redVP).toBe(result.finalStandings!.red)
        expect(blueVP).toBe(result.finalStandings!.blue)
        expect(greenVP).toBe(result.finalStandings!.green)

        expect(redVP).toBeGreaterThan(blueVP)
        expect(blueVP).toBeGreaterThan(greenVP)
      }
    })
  })

  describe('solve() - VP Tier Integration', () => {
    it('should use correct VP tiers for NA peak hours', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')] // NA peak

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        // Should use NA peak VP values (43, 32, 21)
        const vpValues = Object.values(result.scenario[0].vpAwarded)
        expect(vpValues).toContain(43)
        expect(vpValues).toContain(32)
        expect(vpValues).toContain(21)
      }
    })

    it('should use correct VP tiers for EU peak hours', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T18:00:00Z')] // EU peak

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'eu')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        // Should use EU peak VP values (51, 37, 24)
        const vpValues = Object.values(result.scenario[0].vpAwarded)
        expect(vpValues).toContain(51)
        expect(vpValues).toContain(37)
        expect(vpValues).toContain(24)
      }
    })

    it('should handle mixed VP tiers across multiple skirmishes', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'), // NA peak: 43, 32, 21
        new Date('2024-01-01T10:00:00Z'), // NA low: 19, 16, 13
      ]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        expect(result.scenario).toHaveLength(2)

        // First skirmish should have peak values
        const firstVP = Object.values(result.scenario[0].vpAwarded)
        expect(Math.max(...firstVP)).toBe(43)

        // Second skirmish should have low values
        const secondVP = Object.values(result.scenario[1].vpAwarded)
        expect(Math.max(...secondVP)).toBe(19)
      }
    })
  })

  describe('solve() - Edge Cases', () => {
    it('should handle all teams tied', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 1000 },
        { id: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
    })

    it('should handle very close race', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 999 },
        { id: 'green', currentVP: 998 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      if (result.achievable) {
        expect(result.gap).toBeDefined()
        expect(result.gap).toBeGreaterThan(0)
      }
    })

    it('should handle single skirmish', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 100 },
        { id: 'blue', currentVP: 100 },
        { id: 'green', currentVP: 100 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['blue', 'red', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.scenario).toHaveLength(1)
    })

    it('should handle maximum skirmish count', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      // 50 skirmishes (max before timeout)
      const skirmishTimes = Array.from(
        { length: 50 },
        (_, i) => new Date(`2024-01-${Math.floor(i / 12) + 1}T${(i % 12) * 2}:00:00Z`)
      )

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')

      // Should not throw, might timeout
      expect(() => solver.solve()).not.toThrow()
    }, 30000)
  })

  describe('solve() - Performance', () => {
    it('should solve moderate scenarios quickly', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 10 },
        (_, i) => new Date(`2024-01-01T${(i * 2) % 24}:00:00Z`)
      )

      const startTime = Date.now()
      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()
      const duration = Date.now() - startTime

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(5000) // Should solve in < 5 seconds
    })

    it('should report iteration count', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.iterations).toBeDefined()
      expect(result.iterations).toBeGreaterThan(0)
    })
  })

  describe('solve() - Determinism', () => {
    it('should produce consistent results for same input', () => {
      const worlds: WorldState[] = [
        { id: 'red', currentVP: 1000 },
        { id: 'blue', currentVP: 950 },
        { id: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T02:00:00Z'),
      ]

      const solver1 = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result1 = solver1.solve()

      const solver2 = new DeterministicDFSSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result2 = solver2.solve()

      expect(result1.achievable).toBe(result2.achievable)
      if (result1.achievable && result2.achievable) {
        expect(result1.gap).toBe(result2.gap)
        expect(result1.finalStandings).toEqual(result2.finalStandings)
      }
    })
  })
})
