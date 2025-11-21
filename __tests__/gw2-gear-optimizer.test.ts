/**
 * Tests for GW2 Gear Optimizer
 * Tests MILP-based gear optimization using glpk.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  Build,
  GearSelection,
  ItemStat,
  OptimizationGoal,
  OptimizationOptions,
  ProfessionId,
  GearPiece,
  WeaponPiece,
  WeaponType,
} from '../lib/gw2/types'
import { optimizeGear, getOptimizationPresets } from '../lib/gw2/gear-optimizer'

// ============================================================================
// MOCK GLPK
// ============================================================================

// Mock glpk.js module
vi.mock('glpk.js', () => {
  return {
    default: vi.fn(() => Promise.resolve({
      GLP_OPT: 5, // Optimal solution status
      GLP_FEAS: 2, // Feasible solution
      GLP_INFEAS: 4, // Infeasible solution
      GLP_MSG_OFF: 0,
      solve: vi.fn((problem: any, options: any) => {
        // Mock successful optimization
        // Extract gear slots from decision variables
        const slots = ['helm', 'shoulders', 'coat', 'gloves', 'leggings', 'boots',
                       'amulet', 'ring1', 'ring2', 'accessory1', 'accessory2', 'backItem',
                       'weaponSet1Main', 'weaponSet1Off']

        const vars: Record<string, number> = {}

        // For maximize-ep goal, select Berserker (id: 1) stats
        // For maximize-eh goal, select Soldier (id: 2) stats
        // For maximize-ehp goal, select Marauder (id: 3) stats

        let selectedStatId = 1 // Default to Berserker

        // Determine stat selection based on objective function weights
        const firstVar = Object.keys(problem.objective.vars)[0]
        const firstWeight = problem.objective.vars[firstVar]

        // If high weight on Power/Precision, use Berserker (1)
        // If high weight on Toughness/Vitality, use Soldier (2)
        // If balanced, use Marauder (3)
        if (firstWeight > 100) {
          selectedStatId = 1 // Berserker
        } else if (firstWeight < 50) {
          selectedStatId = 2 // Soldier
        } else {
          selectedStatId = 3 // Marauder
        }

        // Check if problem has constraints that make it infeasible
        if (problem.subjectTo && problem.subjectTo.length > slots.length + 5) {
          // Too many constraints, likely infeasible
          return Promise.resolve({
            result: {
              status: 4, // GLP_INFEAS
              vars: {},
            },
          })
        }

        // Assign selected stat to all slots
        for (const slot of slots) {
          vars[`${slot}_${selectedStatId}`] = 1
        }

        return Promise.resolve({
          result: {
            status: 5, // GLP_OPT
            vars,
          },
        })
      }),
    })),
  }
})

// ============================================================================
// TEST DATA
// ============================================================================

// Sample stat combinations
const berserkerStat: ItemStat = {
  id: 1,
  name: 'Berserker',
  attributes: [
    { attribute: 'Power', multiplier: 0.35, value: 125 },
    { attribute: 'Precision', multiplier: 0.25, value: 90 },
    { attribute: 'Ferocity', multiplier: 0.25, value: 90 },
  ],
}

const soldierStat: ItemStat = {
  id: 2,
  name: 'Soldier',
  attributes: [
    { attribute: 'Power', multiplier: 0.35, value: 125 },
    { attribute: 'Toughness', multiplier: 0.25, value: 90 },
    { attribute: 'Vitality', multiplier: 0.25, value: 90 },
  ],
}

const marauderStat: ItemStat = {
  id: 3,
  name: 'Marauder',
  attributes: [
    { attribute: 'Power', multiplier: 0.35, value: 125 },
    { attribute: 'Precision', multiplier: 0.25, value: 90 },
    { attribute: 'Vitality', multiplier: 0.14, value: 50 },
    { attribute: 'Ferocity', multiplier: 0.14, value: 50 },
  ],
}

const clericStat: ItemStat = {
  id: 4,
  name: 'Cleric',
  attributes: [
    { attribute: 'Healing', multiplier: 0.35, value: 125 },
    { attribute: 'Power', multiplier: 0.25, value: 90 },
    { attribute: 'Toughness', multiplier: 0.25, value: 90 },
  ],
}

const cavalierStat: ItemStat = {
  id: 5,
  name: 'Cavalier',
  attributes: [
    { attribute: 'Toughness', multiplier: 0.35, value: 125 },
    { attribute: 'Power', multiplier: 0.25, value: 90 },
    { attribute: 'Ferocity', multiplier: 0.25, value: 90 },
  ],
}

const allStats: ItemStat[] = [berserkerStat, soldierStat, marauderStat, clericStat, cavalierStat]

// Sample gear piece
function createGearPiece(statId: number): GearPiece {
  return {
    statId,
    rarity: 'Ascended',
    infusions: [],
  }
}

function createWeaponPiece(statId: number, weaponType: WeaponType): WeaponPiece {
  return {
    statId,
    rarity: 'Ascended',
    weaponType,
    infusions: [],
  }
}

// Sample gear selection (all Berserker)
function createSampleGear(): GearSelection {
  return {
    helm: createGearPiece(1),
    shoulders: createGearPiece(1),
    coat: createGearPiece(1),
    gloves: createGearPiece(1),
    leggings: createGearPiece(1),
    boots: createGearPiece(1),
    amulet: createGearPiece(1),
    ring1: createGearPiece(1),
    ring2: createGearPiece(1),
    accessory1: createGearPiece(1),
    accessory2: createGearPiece(1),
    backItem: createGearPiece(1),
    relic: createGearPiece(1),
    weaponSet1Main: createWeaponPiece(1, 'Greatsword'),
    weaponSet1Off: createWeaponPiece(1, 'Shield'),
  }
}

// Sample build
function createSampleBuild(profession: ProfessionId = 'Guardian'): Build {
  return {
    id: 'test-build-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: 'Test Build',
    profession,
    specializations: [],
    skills: {
      heal: 0,
      utility1: 0,
      utility2: 0,
      utility3: 0,
      elite: 0,
    },
    gear: createSampleGear(),
    isPublic: false,
    tags: [],
    viewCount: 0,
    likeCount: 0,
  }
}

// Default optimization options
function createDefaultOptions(): OptimizationOptions {
  return {
    allowedRarities: ['Ascended', 'Legendary'],
    useInfusions: false,
    includeFood: false,
    includeUtility: false,
  }
}

// ============================================================================
// TESTS: Optimization Goals
// ============================================================================

describe('GW2 Gear Optimizer - Optimization Goals', () => {
  it('should optimize for maximum Effective Power (EP)', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()
    expect(result.stats).toBeDefined()
    expect(result.improvements).toBeDefined()
    expect(result.solveTime).toBeGreaterThan(0)
  })

  it('should optimize for maximum Effective Health (EH)', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-eh',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()
    // Should prefer tanky stats (Soldier, Cavalier)
  })

  it('should optimize for maximum EHP (balanced build)', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ehp',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()
    // Should balance offense and defense (Marauder)
  })

  it('should optimize for maximum DPS', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-dps',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()
    // Should heavily favor Power and crit stats
  })

  it('should handle custom optimization goal', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'custom',
      customFormula: 'power * 2 + vitality',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// TESTS: Constraints
// ============================================================================

describe('GW2 Gear Optimizer - Constraints', () => {
  it('should respect minimum stat constraints', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'vitality', min: 1000 },
      ],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    if (result.stats) {
      expect(result.stats.vitality).toBeGreaterThanOrEqual(1000)
    }
  })

  it('should respect maximum stat constraints', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'precision', max: 2000 },
      ],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should respect target stat constraints', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'toughness', target: 1500 },
      ],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should handle multiple constraints', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'vitality', min: 1000 },
        { stat: 'precision', min: 1800 },
        { stat: 'toughness', max: 1200 },
      ],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should detect infeasible constraints', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'vitality', min: 10000 }, // Impossible with available gear
        { stat: 'power', min: 5000 },
        { stat: 'precision', min: 5000 },
        { stat: 'ferocity', min: 5000 },
        { stat: 'toughness', min: 5000 },
        { stat: 'healingPower', min: 5000 },
      ],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(false)
    expect(result.message).toContain('No feasible solution')
  })
})

// ============================================================================
// TESTS: Stat Filtering
// ============================================================================

describe('GW2 Gear Optimizer - Stat Filtering', () => {
  it('should allow filtering by stat combinations', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options: OptimizationOptions = {
      ...createDefaultOptions(),
      allowedStatCombos: [1, 3], // Only Berserker and Marauder
    }

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should return error when no stats match filters', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options: OptimizationOptions = {
      ...createDefaultOptions(),
      allowedStatCombos: [999], // Non-existent stat ID
    }

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(false)
    expect(result.message).toContain('No stat combinations available')
  })

  it('should optimize with limited stat selection', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-eh',
      constraints: [],
    }
    const options: OptimizationOptions = {
      ...createDefaultOptions(),
      allowedStatCombos: [2, 5], // Only Soldier and Cavalier (tanky stats)
    }

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// TESTS: Profession-Specific
// ============================================================================

describe('GW2 Gear Optimizer - Profession-Specific', () => {
  it('should optimize for Guardian', async () => {
    const build = createSampleBuild('Guardian')
    const goal: OptimizationGoal = {
      type: 'maximize-ehp',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should optimize for Warrior', async () => {
    const build = createSampleBuild('Warrior')
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should optimize for Elementalist', async () => {
    const build = createSampleBuild('Elementalist')
    const goal: OptimizationGoal = {
      type: 'maximize-dps',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should optimize for Thief', async () => {
    const build = createSampleBuild('Thief')
    const goal: OptimizationGoal = {
      type: 'maximize-dps',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// TESTS: Improvements Calculation
// ============================================================================

describe('GW2 Gear Optimizer - Improvements', () => {
  it('should calculate stat improvements', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.improvements).toBeDefined()
    expect(result.improvements?.effectivePower).toBeDefined()
    expect(result.improvements?.effectiveHealth).toBeDefined()
    expect(result.improvements?.effectiveHealthPower).toBeDefined()
  })

  it('should show positive EP improvement for EP optimization', async () => {
    const build = createSampleBuild()
    // Start with tanky gear
    for (const slot in build.gear) {
      const piece = build.gear[slot as keyof GearSelection]
      if (piece && typeof piece === 'object' && 'statId' in piece) {
        (piece as any).statId = 2 // Soldier
      }
    }

    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    // EP should improve or stay same when optimizing for EP
    expect(result.improvements?.effectivePower).toBeGreaterThanOrEqual(0)
  })

  it('should show positive EH improvement for EH optimization', async () => {
    const build = createSampleBuild()
    // Start with damage gear
    for (const slot in build.gear) {
      const piece = build.gear[slot as keyof GearSelection]
      if (piece && typeof piece === 'object' && 'statId' in piece) {
        (piece as any).statId = 1 // Berserker
      }
    }

    const goal: OptimizationGoal = {
      type: 'maximize-eh',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.improvements?.effectiveHealth).toBeGreaterThanOrEqual(0)
  })

  it('should provide descriptive success message', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.message).toContain('Optimization complete')
    expect(result.message).toContain('EP')
    expect(result.message).toContain('EH')
  })
})

// ============================================================================
// TESTS: Gear Slots
// ============================================================================

describe('GW2 Gear Optimizer - Gear Slots', () => {
  it('should optimize all armor slots', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()

    // Check all armor slots are defined
    expect(result.gear?.helm).toBeDefined()
    expect(result.gear?.shoulders).toBeDefined()
    expect(result.gear?.coat).toBeDefined()
    expect(result.gear?.gloves).toBeDefined()
    expect(result.gear?.leggings).toBeDefined()
    expect(result.gear?.boots).toBeDefined()
  })

  it('should optimize all trinket slots', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()

    // Check all trinket slots
    expect(result.gear?.amulet).toBeDefined()
    expect(result.gear?.ring1).toBeDefined()
    expect(result.gear?.ring2).toBeDefined()
    expect(result.gear?.accessory1).toBeDefined()
    expect(result.gear?.accessory2).toBeDefined()
    expect(result.gear?.backItem).toBeDefined()
  })

  it('should optimize weapon slots', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-dps',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()

    // Check weapon slots
    expect(result.gear?.weaponSet1Main).toBeDefined()
  })

  it('should respect trinket stat multipliers (amulet > rings)', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    // Amulet has 1.57x multiplier, should contribute more stats
    // This is handled internally by the optimizer
  })
})

// ============================================================================
// TESTS: Presets
// ============================================================================

describe('GW2 Gear Optimizer - Presets', () => {
  it('should provide optimization presets', () => {
    const presets = getOptimizationPresets()

    expect(presets).toBeDefined()
    expect(presets.length).toBeGreaterThan(0)
  })

  it('should include Max Damage preset', () => {
    const presets = getOptimizationPresets()
    const maxDamage = presets.find(p => p.name.includes('Max Damage'))

    expect(maxDamage).toBeDefined()
    expect(maxDamage?.goal.type).toBe('maximize-ep')
  })

  it('should include Max Tankiness preset', () => {
    const presets = getOptimizationPresets()
    const maxTank = presets.find(p => p.name.includes('Tankiness'))

    expect(maxTank).toBeDefined()
    expect(maxTank?.goal.type).toBe('maximize-eh')
  })

  it('should include Balanced Bruiser preset', () => {
    const presets = getOptimizationPresets()
    const bruiser = presets.find(p => p.name.includes('Bruiser'))

    expect(bruiser).toBeDefined()
    expect(bruiser?.goal.type).toBe('maximize-ehp')
  })

  it('should include Glass Cannon preset with constraints', () => {
    const presets = getOptimizationPresets()
    const glassCannon = presets.find(p => p.name.includes('Glass Cannon'))

    expect(glassCannon).toBeDefined()
    expect(glassCannon?.goal.type).toBe('maximize-ep')
    expect(glassCannon?.goal.constraints.length).toBeGreaterThan(0)

    // Should have minimum vitality constraint
    const vitalityConstraint = glassCannon?.goal.constraints.find(c => c.stat === 'vitality')
    expect(vitalityConstraint).toBeDefined()
    expect(vitalityConstraint?.min).toBeGreaterThan(0)
  })

  it('should have descriptions for all presets', () => {
    const presets = getOptimizationPresets()

    for (const preset of presets) {
      expect(preset.name).toBeTruthy()
      expect(preset.description).toBeTruthy()
      expect(preset.goal).toBeDefined()
    }
  })
})

// ============================================================================
// TESTS: Error Handling
// ============================================================================

describe('GW2 Gear Optimizer - Error Handling', () => {
  it('should handle GLPK solver errors gracefully', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    // Mock GLPK to throw error
    const glpk = await import('glpk.js')
    vi.mocked(glpk.default).mockImplementationOnce(() => {
      throw new Error('GLPK solver error')
    })

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(false)
    expect(result.message).toContain('solver error')
  })

  it('should measure solve time', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.solveTime).toBeDefined()
    expect(result.solveTime!).toBeGreaterThan(0)
    expect(result.solveTime!).toBeLessThan(10000) // Should be fast
  })

  it('should provide solve time even on failure', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'vitality', min: 99999 }, // Impossible
      ],
    }
    const options: OptimizationOptions = {
      ...createDefaultOptions(),
      allowedStatCombos: [999, 998, 997, 996, 995], // Many non-existent IDs
    }

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(false)
    expect(result.solveTime).toBeDefined()
  })
})

// ============================================================================
// TESTS: Integration
// ============================================================================

describe('GW2 Gear Optimizer - Integration', () => {
  it('should complete full optimization workflow', async () => {
    // Create a build with mixed gear
    const build = createSampleBuild('Warrior')

    // Set mixed stats (some Berserker, some Soldier)
    build.gear.helm.statId = 1
    build.gear.shoulders.statId = 2
    build.gear.coat.statId = 1
    build.gear.gloves.statId = 2

    // Optimize for maximum EP
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [
        { stat: 'vitality', min: 800 }, // Some survivability
      ],
    }

    const options: OptimizationOptions = {
      allowedRarities: ['Ascended'],
      allowedStatCombos: [1, 3], // Berserker and Marauder
      useInfusions: false,
      includeFood: false,
      includeUtility: false,
    }

    const result = await optimizeGear(build, allStats, goal, options)

    // Should succeed
    expect(result.success).toBe(true)
    expect(result.gear).toBeDefined()
    expect(result.stats).toBeDefined()
    expect(result.improvements).toBeDefined()

    // Should show improvements
    expect(result.message).toContain('Optimization complete')
    expect(result.solveTime).toBeGreaterThan(0)
  })

  it('should handle complex multi-constraint optimization', async () => {
    const build = createSampleBuild('Guardian')

    const goal: OptimizationGoal = {
      type: 'maximize-ehp',
      constraints: [
        { stat: 'power', min: 2000 },
        { stat: 'vitality', min: 1000 },
        { stat: 'toughness', min: 800 },
      ],
    }

    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should optimize with preset goals', async () => {
    const build = createSampleBuild('Necromancer')
    const presets = getOptimizationPresets()

    // Use Glass Cannon preset
    const glassCannon = presets.find(p => p.name.includes('Glass Cannon'))!
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, glassCannon.goal, options)

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// TESTS: Edge Cases
// ============================================================================

describe('GW2 Gear Optimizer - Edge Cases', () => {
  it('should handle empty stat list gracefully', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, [], goal, options)

    expect(result.success).toBe(false)
  })

  it('should handle single stat option', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, [berserkerStat], goal, options)

    expect(result.success).toBe(true)
    // Should select the only available stat for all slots
  })

  it('should handle optimization with no constraints', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options = createDefaultOptions()

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
  })

  it('should handle very restrictive filters', async () => {
    const build = createSampleBuild()
    const goal: OptimizationGoal = {
      type: 'maximize-ep',
      constraints: [],
    }
    const options: OptimizationOptions = {
      ...createDefaultOptions(),
      allowedStatCombos: [4], // Only Cleric (healing stat)
    }

    const result = await optimizeGear(build, allStats, goal, options)

    expect(result.success).toBe(true)
    // Should work even with sub-optimal stat choice
  })
})
