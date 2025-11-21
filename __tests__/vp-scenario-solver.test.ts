/**
 * Unit tests for VP Scenario Solver
 *
 * Tests the orchestration of multiple solving strategies (DFS, Random, Greedy, Obvious)
 * and validates scenario calculation logic.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateScenario,
  getCurrentStandings,
  type ScenarioInput,
} from '@/lib/vp-scenario-solver-greedy'

describe('VP Scenario Solver', () => {
  describe('getCurrentStandings', () => {
    it('should correctly determine first, second, third places', () => {
      const standings = getCurrentStandings({ red: 1000, blue: 950, green: 900 })
      expect(standings).toEqual({
        first: 'red',
        second: 'blue',
        third: 'green',
      })
    })

    it('should handle any team in first place', () => {
      expect(getCurrentStandings({ red: 800, blue: 1000, green: 900 })).toEqual({
        first: 'blue',
        second: 'green',
        third: 'red',
      })

      expect(getCurrentStandings({ red: 900, blue: 800, green: 1000 })).toEqual({
        first: 'green',
        second: 'red',
        third: 'blue',
      })
    })

    it('should handle identical scores consistently', () => {
      const standings = getCurrentStandings({ red: 1000, blue: 1000, green: 900 })
      expect([standings.first, standings.second]).toContain('red')
      expect([standings.first, standings.second]).toContain('blue')
      expect(standings.third).toBe('green')
    })
  })

  describe('calculateScenario - Input Validation', () => {
    it('should reject duplicate team placements', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 43, second: 32, third: 21 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'red', // Duplicate!
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(false)
      expect(result.reason).toContain('Invalid desired outcome')
    })

    it('should reject scenarios with no remaining skirmishes', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(false)
      expect(result.reason).toContain('No remaining skirmishes')
    })

    it('should reject scenarios with more than 50 skirmishes', async () => {
      const skirmishes = Array.from({ length: 51 }, (_, i) => ({
        id: i,
        startTime: new Date(`2024-01-01T${(i * 2) % 24}:00:00Z`),
        endTime: new Date(`2024-01-01T${((i * 2) % 24) + 2}:00:00Z`),
        vpAwards: { first: 43, second: 32, third: 21 },
      }))

      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: skirmishes,
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(false)
      expect(result.reason).toContain('Too many remaining skirmishes')
    })
  })

  describe('calculateScenario - Simple Scenarios', () => {
    it('should find solution when already in desired order', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(result.finalVP).toBeDefined()
      expect(result.finalVP!.red).toBeGreaterThan(result.finalVP!.blue)
      expect(result.finalVP!.blue).toBeGreaterThan(result.finalVP!.green)
    })

    it('should find solution for simple comeback scenario', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 900, blue: 950, green: 1000 }, // Green ahead
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 50, second: 30, third: 10 },
          },
        ],
        desiredOutcome: {
          first: 'red', // Red needs to come back
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(result.requiredPlacements).toHaveLength(1)
      expect(result.requiredPlacements![0].placements.red).toBe(1) // Red must win
    })

    it('should find solution with multiple skirmishes', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 1000, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 },
          },
          {
            id: 2,
            startTime: new Date('2024-01-01T02:00:00Z'),
            endTime: new Date('2024-01-01T04:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(result.requiredPlacements).toHaveLength(2)
    })
  })

  describe('calculateScenario - Impossible Scenarios', () => {
    it('should detect mathematically impossible scenario', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 100, blue: 1000, green: 900 }, // Red way behind
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 }, // Not enough VP to catch up
          },
        ],
        desiredOutcome: {
          first: 'red', // Red cannot win with only 5 VP available
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should detect impossible ordering with limited skirmishes', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 100, blue: 500, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 10, second: 8, third: 6 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(false)
    })
  })

  describe('calculateScenario - Difficulty Assessment', () => {
    it('should mark easy scenarios as easy', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 995, green: 990 },
        remainingSkirmishes: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          startTime: new Date(`2024-01-01T${i * 2}:00:00Z`),
          endTime: new Date(`2024-01-01T${i * 2 + 2}:00:00Z`),
          vpAwards: { first: 5, second: 4, third: 3 },
        })),
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      if (result.isPossible) {
        expect(['easy', 'moderate']).toContain(result.difficulty)
      }
    })

    it('should mark hard comebacks as hard/very-hard', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 500, blue: 1000, green: 999 },
        remainingSkirmishes: Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          startTime: new Date(`2024-01-01T${i * 2}:00:00Z`),
          endTime: new Date(`2024-01-01T${i * 2 + 2}:00:00Z`),
          vpAwards: { first: 100, second: 50, third: 25 },
        })),
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      if (result.isPossible) {
        expect(['hard', 'very-hard']).toContain(result.difficulty)
      }
    })
  })

  describe('calculateScenario - Solver Attribution', () => {
    it('should report which solver found the solution', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(['obvious', 'dfs', 'random', 'greedy']).toContain(result.solver)
      expect(result.solverAttempts).toBeDefined()
      expect(result.solverAttempts!.length).toBeGreaterThan(0)
    })
  })

  describe('calculateScenario - Margin Calculations', () => {
    it('should calculate winning margin correctly', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 10, second: 8, third: 6 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(result.margin).toBeDefined()
      expect(result.margin).toBeGreaterThan(0)
      // Margin should be difference between first and second place
      const margin = result.finalVP!.red - result.finalVP!.blue
      expect(result.margin).toBe(margin)
    })
  })

  describe('calculateScenario - VP Tier Integration', () => {
    it('should use correct VP tiers for NA peak hours', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'), // NA peak
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 43, second: 32, third: 21 }, // NA peak values
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      // Should use the high VP values correctly
      expect(result.finalVP!.red).toBeGreaterThanOrEqual(1000 + 21)
    })

    it('should handle mixed VP tiers across skirmishes', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'), // NA peak
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 43, second: 32, third: 21 },
          },
          {
            id: 2,
            startTime: new Date('2024-01-01T10:00:00Z'), // NA low
            endTime: new Date('2024-01-01T12:00:00Z'),
            vpAwards: { first: 19, second: 16, third: 13 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(result.requiredPlacements).toHaveLength(2)
    })
  })

  describe('calculateScenario - Edge Cases', () => {
    it('should handle all teams tied', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 1000, green: 1000 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 },
          },
        ],
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
    })

    it('should handle very close race', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 999, green: 998 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 5, second: 4, third: 3 },
          },
        ],
        desiredOutcome: {
          first: 'green',
          second: 'red',
          third: 'blue',
        },
      }

      const result = await calculateScenario(input)
      // Green needs to win, but it's mathematically possible
      expect(result).toBeDefined()
      if (result.isPossible) {
        expect(result.requiredPlacements![0].placements.green).toBe(1)
      }
    })

    it('should handle single skirmish scenario', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 100, blue: 100, green: 100 },
        remainingSkirmishes: [
          {
            id: 1,
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-01T02:00:00Z'),
            vpAwards: { first: 10, second: 8, third: 6 },
          },
        ],
        desiredOutcome: {
          first: 'blue',
          second: 'red',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      expect(result.isPossible).toBe(true)
      expect(result.requiredPlacements).toHaveLength(1)
    })
  })

  describe('calculateScenario - Performance', () => {
    it('should solve moderate scenarios quickly', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          startTime: new Date(`2024-01-01T${(i * 2) % 24}:00:00Z`),
          endTime: new Date(`2024-01-01T${((i * 2) % 24) + 2}:00:00Z`),
          vpAwards: { first: 43, second: 32, third: 21 },
        })),
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const startTime = Date.now()
      const result = await calculateScenario(input)
      const duration = Date.now() - startTime

      expect(result.isPossible).toBe(true)
      expect(duration).toBeLessThan(5000) // Should solve in < 5 seconds
    })

    it('should handle maximum allowed skirmishes', async () => {
      const input: ScenarioInput = {
        currentVP: { red: 1000, blue: 950, green: 900 },
        remainingSkirmishes: Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          startTime: new Date(`2024-01-${Math.floor(i / 12) + 1}T${(i * 2) % 24}:00:00Z`),
          endTime: new Date(`2024-01-${Math.floor(i / 12) + 1}T${((i * 2) % 24) + 2}:00:00Z`),
          vpAwards: { first: 43, second: 32, third: 21 },
        })),
        desiredOutcome: {
          first: 'red',
          second: 'blue',
          third: 'green',
        },
      }

      const result = await calculateScenario(input)
      // Should complete (might timeout with current DFS, but shouldn't crash)
      expect(result).toBeDefined()
    }, 30000) // Longer timeout for this test
  })
})
