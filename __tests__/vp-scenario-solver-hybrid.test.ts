/**
 * Unit tests for Hybrid VP Scenario Solver (Random + Greedy)
 *
 * Tests the hybrid solver that uses random search followed by
 * deterministic greedy fallback with hill climbing optimization.
 */

import { describe, it, expect } from 'vitest'
import {
  WvWHybridSolver,
  type WorldState,
  type HybridSolverResult,
} from '@/lib/vp-scenario-solver-random'

describe('Hybrid VP Scenario Solver (Random + Greedy)', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with valid worlds and skirmishes', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T02:00:00Z'),
      ]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')

      expect(solver).toBeDefined()
    })

    it('should handle different desired orders', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 900 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['green', 'blue', 'red'], 'na')

      expect(solver).toBeDefined()
    })
  })

  describe('solve() - Simple Scenarios', () => {
    it('should find solution when already in desired order', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.finalStandings).toBeDefined()
      expect(result.finalStandings!.red).toBeGreaterThan(result.finalStandings!.blue)
      expect(result.finalStandings!.blue).toBeGreaterThan(result.finalStandings!.green)
    })

    it('should find solution for simple comeback', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 900 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result).toBeDefined()
      if (result.achievable) {
        expect(result.finalStandings!.red).toBeGreaterThan(result.finalStandings!.blue)
      }
    })

    it('should generate valid scenario with correct VP awards', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        expect(result.scenario).toHaveLength(1)

        const skirmish = result.scenario[0]
        expect(skirmish.placements).toBeDefined()
        expect(skirmish.vpAwarded).toBeDefined()

        // VP awarded should sum to 96 (43 + 32 + 21)
        const totalVP =
          skirmish.vpAwarded.red + skirmish.vpAwarded.blue + skirmish.vpAwarded.green
        expect(totalVP).toBe(96)
      }
    })
  })

  describe('solve() - Solver Method Attribution', () => {
    it('should report method as "random" or "deterministic"', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable) {
        expect(['random', 'deterministic']).toContain(result.method)
      } else {
        expect(result.method).toBe('impossible')
      }
    })

    it('should report iteration count', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 3 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.iterations).toBeDefined()
      expect(result.iterations).toBeGreaterThan(0)
    })
  })

  describe('solve() - Random Search Phase', () => {
    it('should try random search for easy scenarios', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 990 },
        { id: 'green', color: 'green', currentVP: 980 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T02:00:00Z'),
      ]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // Easy scenarios should often be found by random search
      expect(result.achievable).toBe(true)
    })

    it('should optimize random search results with hill climbing', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.method === 'random') {
        // Should have optimized the gap
        expect(result.gap).toBeDefined()
        expect(result.gap).toBeGreaterThan(0)
      }
    })
  })

  describe('solve() - Deterministic Greedy Fallback', () => {
    it('should fall back to greedy when random search fails', () => {
      // Create a scenario where random search is unlikely to succeed
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 500 },
        { id: 'blue', color: 'blue', currentVP: 1000 },
        { id: 'green', color: 'green', currentVP: 950 },
      ]

      const skirmishTimes = Array.from(
        { length: 8 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // May find solution via greedy or determine it's impossible
      expect(result).toBeDefined()
      if (result.achievable) {
        expect(['random', 'deterministic']).toContain(result.method)
      }
    })

    it('should use max catchup strategy in greedy fallback', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 900 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = Array.from(
        { length: 3 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.method === 'deterministic') {
        // Greedy should prioritize red getting first place
        expect(result.finalStandings!.red).toBeGreaterThan(result.finalStandings!.blue)
      }
    })
  })

  describe('solve() - Impossible Scenarios', () => {
    it('should detect mathematically impossible scenario', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 100 },
        { id: 'blue', color: 'blue', currentVP: 1000 },
        { id: 'green', color: 'green', currentVP: 950 },
      ]

      const skirmishTimes = [new Date('2024-01-01T10:00:00Z')] // NA low: 19 VP

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(false)
      expect(result.method).toBe('impossible')
    })

    it('should try random before declaring impossible', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 100 },
        { id: 'blue', color: 'blue', currentVP: 500 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T02:00:00Z'),
      ]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      // Should try random search (2000 iterations) then greedy
      expect(result.iterations).toBeGreaterThanOrEqual(2000)
    })
  })

  describe('solve() - Gap Optimization', () => {
    it('should minimize gap for minimum effort', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 999 },
        { id: 'green', color: 'green', currentVP: 998 },
      ]

      const skirmishTimes = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        // Should not require red to win all skirmishes
        const redWins = result.scenario.filter((s) => s.placements.first === 'red').length
        expect(redWins).toBeLessThan(5)

        // Gap should be minimized
        expect(result.gap).toBeDefined()
        const finalVP = result.finalStandings!
        const expectedGap = finalVP.red - finalVP.blue + (finalVP.blue - finalVP.green)
        expect(result.gap).toBe(expectedGap)
      }
    })

    it('should produce valid scenario after optimization', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        // Manually calculate final scores
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
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')] // NA peak

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        const vpValues = Object.values(result.scenario[0].vpAwarded)
        expect(vpValues).toContain(43)
        expect(vpValues).toContain(32)
        expect(vpValues).toContain(21)
      }
    })

    it('should use correct VP tiers for EU peak hours', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = [new Date('2024-01-01T18:00:00Z')] // EU peak

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'eu')
      const result = solver.solve()

      if (result.achievable && result.scenario) {
        const vpValues = Object.values(result.scenario[0].vpAwarded)
        expect(vpValues).toContain(51)
        expect(vpValues).toContain(37)
        expect(vpValues).toContain(24)
      }
    })
  })

  describe('solve() - Multiple Skirmishes', () => {
    it('should handle multiple skirmishes across different time windows', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 990 },
        { id: 'green', color: 'green', currentVP: 980 },
      ]

      const skirmishTimes = [
        new Date('2024-01-01T00:00:00Z'), // NA peak
        new Date('2024-01-01T10:00:00Z'), // NA low
        new Date('2024-01-01T18:00:00Z'), // Not NA prime
      ]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.scenario).toHaveLength(3)
    })

    it('should find solution across many skirmishes', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 10 },
        (_, i) => new Date(`2024-01-01T${(i * 2) % 24}:00:00Z`)
      )

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.scenario).toHaveLength(10)
    })
  })

  describe('solve() - Edge Cases', () => {
    it('should handle all teams tied', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 1000 },
        { id: 'green', color: 'green', currentVP: 1000 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
    })

    it('should handle very close race', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 999 },
        { id: 'green', color: 'green', currentVP: 998 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      if (result.achievable) {
        expect(result.gap).toBeGreaterThan(0)
      }
    })

    it('should handle single skirmish', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 100 },
        { id: 'blue', color: 'blue', currentVP: 100 },
        { id: 'green', color: 'green', currentVP: 100 },
      ]

      const skirmishTimes = [new Date('2024-01-01T00:00:00Z')]

      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['blue', 'red', 'green'], 'na')
      const result = solver.solve()

      expect(result.achievable).toBe(true)
      expect(result.scenario).toHaveLength(1)
    })
  })

  describe('solve() - Performance', () => {
    it('should solve moderate scenarios quickly', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 10 },
        (_, i) => new Date(`2024-01-01T${(i * 2) % 24}:00:00Z`)
      )

      const startTime = Date.now()
      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      const result = solver.solve()
      const duration = Date.now() - startTime

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(10000) // Should solve in < 10 seconds
    })

    it('should complete random search phase quickly', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 950 },
        { id: 'green', color: 'green', currentVP: 900 },
      ]

      const skirmishTimes = Array.from(
        { length: 3 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const startTime = Date.now()
      const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
      solver.solve()
      const duration = Date.now() - startTime

      // Random phase is 2000 iterations, should be fast
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('solve() - Randomness and Coverage', () => {
    it('should explore different solutions across multiple runs', () => {
      const worlds: WorldState[] = [
        { id: 'red', color: 'red', currentVP: 1000 },
        { id: 'blue', color: 'blue', currentVP: 995 },
        { id: 'green', color: 'green', currentVP: 990 },
      ]

      const skirmishTimes = Array.from(
        { length: 3 },
        (_, i) => new Date(`2024-01-01T${i * 2}:00:00Z`)
      )

      const gaps: number[] = []

      // Run multiple times to see variation in random search
      for (let i = 0; i < 5; i++) {
        const solver = new WvWHybridSolver(worlds, skirmishTimes, ['red', 'blue', 'green'], 'na')
        const result = solver.solve()

        if (result.achievable && result.gap) {
          gaps.push(result.gap)
        }
      }

      // Should find solutions (might have same gap due to optimization)
      expect(gaps.length).toBeGreaterThan(0)
    })
  })
})
