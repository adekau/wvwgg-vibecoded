/**
 * WvW Deterministic Solver (Branch & Bound with DFS)
 *
 * This solver provides a mathematical guarantee:
 * - If a solution exists, it will find it
 * - If no solution exists, it will prove impossibility
 *
 * Strategy:
 * 1. Feasibility Pass (DFS): Find ANY valid solution using depth-first search with pruning
 * 2. Optimization Pass: Minimize the gap to find the minimum effort scenario
 */

import { getVPTierForTime } from './vp-tiers'

// --- Types ---

export interface WorldState {
  id: string
  currentVP: number
}

export interface SkirmishInfo {
  id: number
  startTime: Date
  vpTier: { first: number; second: number; third: number }
}

export interface SkirmishResult {
  skirmishId: number
  startTime: Date
  placements: { first: string; second: string; third: string }
  vpAwarded: { [worldId: string]: number }
}

export interface DFSSolverResult {
  achievable: boolean
  finalStandings?: { [worldId: string]: number }
  scenario?: SkirmishResult[]
  gap?: number
  iterations?: number
}

// Permutations of assignments for [Desired1st, Desired2nd, Desired3rd]
// e.g., PERMS[1] = [0, 2, 1] means:
// Desired1st gets 1st Place VP
// Desired2nd gets 3rd Place VP
// Desired3rd gets 2nd Place VP
const PERMS = [
  [0, 1, 2], // 1st, 2nd, 3rd (Standard Win)
  [0, 2, 1], // 1st, 3rd, 2nd (Max Catchup vs 2nd)
  [1, 0, 2], // 2nd, 1st, 3rd
  [1, 2, 0], // 3rd, 1st, 2nd
  [2, 0, 1], // 2nd, 3rd, 1st
  [2, 1, 0], // 3rd, 2nd, 1st
] as const

export class DeterministicDFSSolver {
  private initialScores: number[] // [Score1, Score2, Score3] ordered by desired rank
  private skirmishes: SkirmishInfo[]
  private targetIds: string[] // IDs ordered by desired rank
  private iterations: number = 0
  private maxIterations: number = 500000 // Safety limit to prevent browser hangs (tuned for 50 skirmishes max)

  // Pre-calculated lookahead tables for pruning
  // maxSpreadRemaining[i] = The maximum points 1st place can gain over 3rd place from skirmish i to end
  private maxSpreadRemaining: number[]

  constructor(
    worlds: WorldState[],
    remainingSkirmishTimes: Date[],
    desiredOrder: string[], // [ID_1st, ID_2nd, ID_3rd]
    region: 'na' | 'eu'
  ) {
    this.targetIds = desiredOrder

    // Pre-calculate VP values for all future skirmishes
    this.skirmishes = remainingSkirmishTimes.map((time, index) => {
      const tier = getVPTierForTime(time, region)
      return {
        id: index,
        startTime: time,
        vpTier: { first: tier.first, second: tier.second, third: tier.third },
      }
    })

    // Map current VP to the desired target order indices
    this.initialScores = desiredOrder.map(
      (id) => worlds.find((w) => w.id === id)?.currentVP || 0
    )

    // Pre-calculate lookaheads for optimization
    this.maxSpreadRemaining = new Array(this.skirmishes.length + 1).fill(0)
    for (let i = this.skirmishes.length - 1; i >= 0; i--) {
      const tier = this.skirmishes[i].vpTier
      // The max gap one team can create against another in a single skirmish is (1st VP - 3rd VP)
      const maxSingleGap = tier.first - tier.third
      this.maxSpreadRemaining[i] = this.maxSpreadRemaining[i + 1] + maxSingleGap
    }
  }

  public solve(): DFSSolverResult {
    console.log('[DFS Solver] Starting depth-first search with pruning...')

    // Phase 1: Find *ANY* valid path using DFS with Pruning
    // We prioritize "Max Catchup" moves to find a solution quickly if one exists
    const solutionIndices = this.findValidPath(0, [...this.initialScores])

    if (!solutionIndices) {
      if (this.iterations > this.maxIterations) {
        console.log('[DFS Solver] Search timed out - scenario too complex')
        // Return a special error that signals timeout, not impossibility
        throw new Error('DFS solver timeout - scenario too complex for exhaustive search')
      }
      console.log('[DFS Solver] No solution found (proved impossible)')
      return { achievable: false, iterations: this.iterations }
    }

    console.log(`[DFS Solver] Found solution in ${this.iterations} iterations`)

    // Phase 2: Optimize (Hill Climbing)
    // The DFS likely found a "sweaty" solution (winning hard).
    // We now try to relax it to "Minimum Effort".
    const optimizedIndices = this.optimizeGap(solutionIndices)
    const finalScores = this.calculateScores(optimizedIndices)
    const gap = finalScores[0] - finalScores[1] + (finalScores[1] - finalScores[2])

    console.log(`[DFS Solver] Optimized to gap: ${gap}`)

    return {
      achievable: true,
      scenario: this.buildOutput(optimizedIndices),
      finalStandings: {
        [this.targetIds[0]]: finalScores[0],
        [this.targetIds[1]]: finalScores[1],
        [this.targetIds[2]]: finalScores[2],
      },
      gap,
      iterations: this.iterations,
    }
  }

  /**
   * Recursive Depth-First Search with Pruning
   * Returns array of permutation indices if solution found, null otherwise.
   */
  private findValidPath(
    skirmishIdx: number,
    currentScores: number[] // [S1, S2, S3]
  ): number[] | null {
    this.iterations++

    // Safety check: prevent infinite loops or excessive computation
    if (this.iterations > this.maxIterations) {
      console.warn('[DFS Solver] Max iterations reached, aborting search')
      return null
    }

    // --- Base Case: End of Match ---
    if (skirmishIdx >= this.skirmishes.length) {
      if (currentScores[0] > currentScores[1] && currentScores[1] > currentScores[2]) {
        return [] // Valid path found! Return empty array to start chain
      }
      return null
    }

    // --- Pruning (The Guarantee) ---
    // Check if it's mathematically impossible to catch up from here
    // even if we played perfectly.

    const maxGain = this.maxSpreadRemaining[skirmishIdx]

    // Can 1st catch 2nd?
    // If (Current1 + MaxPossibleGain) <= Current2, then 1st can never pass 2nd.
    // Note: We use <= because we need strictly >
    if (currentScores[0] + maxGain <= currentScores[1]) return null

    // Can 2nd catch 3rd?
    if (currentScores[1] + maxGain <= currentScores[2]) return null

    // --- Recursive Step ---
    // We try permutations.
    // HEURISTIC: Try the "Strongest" moves first.
    // If we are behind, we need high scores.
    // Permutation 1 [0, 2, 1] gives 1st place to Target1, and 3rd to Target2.
    // This maximizes the gap closure between 1 and 2.

    // Sort permutations based on how much they help the currently worst gap
    const sortedPerms = this.sortPermutationsForCatchup(currentScores, skirmishIdx)

    for (const permIdx of sortedPerms) {
      const p = PERMS[permIdx]
      const tier = this.skirmishes[skirmishIdx].vpTier

      // Calculate next scores
      const nextScores = [
        currentScores[0] + (p[0] === 0 ? tier.first : p[0] === 1 ? tier.second : tier.third),
        currentScores[1] + (p[1] === 0 ? tier.first : p[1] === 1 ? tier.second : tier.third),
        currentScores[2] + (p[2] === 0 ? tier.first : p[2] === 1 ? tier.second : tier.third),
      ]

      // Recurse
      const result = this.findValidPath(skirmishIdx + 1, nextScores)

      if (result) {
        // Found a path! Prepend this step and return up the stack
        return [permIdx, ...result]
      }
    }

    return null // Dead end
  }

  /**
   * Helper to try the most impactful moves first
   */
  private sortPermutationsForCatchup(scores: number[], skIdx: number): number[] {
    // Standard indices: 0..5
    const indices = [0, 1, 2, 3, 4, 5]

    const tier = this.skirmishes[skIdx].vpTier

    return indices.sort((a, b) => {
      // Simulate move A
      const pA = PERMS[a]
      // Score gain for Target 1 vs Target 2 in move A
      // We want to MAXIMIZE (Score1 - Score2) gain if score1 < score2

      // Simple heuristic: Just score the resulting state based on (S1-S2) + (S2-S3)
      const gainA_1v2 =
        (pA[0] === 0 ? tier.first : pA[0] === 1 ? tier.second : tier.third) -
        (pA[1] === 0 ? tier.first : pA[1] === 1 ? tier.second : tier.third)

      const pB = PERMS[b]
      const gainB_1v2 =
        (pB[0] === 0 ? tier.first : pB[0] === 1 ? tier.second : tier.third) -
        (pB[1] === 0 ? tier.first : pB[1] === 1 ? tier.second : tier.third)

      // Descending sort (Highest gain first)
      return gainB_1v2 - gainA_1v2
    })
  }

  /**
   * Phase 2: Minimize the gap (Minimum Effort)
   * Iteratively tries to lower the winner's rank in each skirmish
   */
  private optimizeGap(assignments: number[]): number[] {
    let currentAssigns = [...assignments]
    let currentGap = this.getGap(currentAssigns)

    let improved = true
    let optimizationIterations = 0
    const maxOptimizationIterations = 1000 // Prevent infinite optimization loops

    while (improved && optimizationIterations < maxOptimizationIterations) {
      improved = false
      optimizationIterations++

      for (let i = 0; i < currentAssigns.length; i++) {
        const original = currentAssigns[i]

        // Try all other moves
        for (let p = 0; p < 6; p++) {
          if (p === original) continue

          currentAssigns[i] = p
          const newGap = this.getGap(currentAssigns)

          // If valid AND smaller gap, keep it
          if (newGap !== -1 && newGap < currentGap) {
            currentGap = newGap
            improved = true
          } else {
            currentAssigns[i] = original // Revert
          }
        }
      }
    }

    if (optimizationIterations >= maxOptimizationIterations) {
      console.warn('[DFS Solver] Optimization phase reached max iterations')
    }

    return currentAssigns
  }

  private getGap(assignments: number[]): number {
    const scores = this.calculateScores(assignments)
    if (scores[0] > scores[1] && scores[1] > scores[2]) {
      return scores[0] - scores[1] + (scores[1] - scores[2])
    }
    return -1 // Invalid
  }

  private calculateScores(assignments: number[]): number[] {
    const s = [...this.initialScores]
    assignments.forEach((pIdx, i) => {
      const p = PERMS[pIdx] // [RankOf1, RankOf2, RankOf3]
      const tier = this.skirmishes[i].vpTier

      // Map rank index (0,1,2) to VP value
      const getVp = (rankIdx: number) =>
        rankIdx === 0 ? tier.first : rankIdx === 1 ? tier.second : tier.third

      s[0] += getVp(p[0])
      s[1] += getVp(p[1])
      s[2] += getVp(p[2])
    })
    return s
  }

  private buildOutput(assignments: number[]): SkirmishResult[] {
    return assignments.map((pIdx, i) => {
      const p = PERMS[pIdx]
      const tier = this.skirmishes[i].vpTier

      // Map rank index to VP
      const getVp = (rankIdx: number) =>
        rankIdx === 0 ? tier.first : rankIdx === 1 ? tier.second : tier.third

      return {
        skirmishId: i + 1, // display ID
        startTime: this.skirmishes[i].startTime,
        placements: {
          first: this.targetIds[p.indexOf(0)], // Who got rank 0?
          second: this.targetIds[p.indexOf(1)],
          third: this.targetIds[p.indexOf(2)],
        },
        vpAwarded: {
          [this.targetIds[0]]: getVp(p[0]),
          [this.targetIds[1]]: getVp(p[1]),
          [this.targetIds[2]]: getVp(p[2]),
        },
      }
    })
  }
}
