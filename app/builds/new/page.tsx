'use client'

import { useState, useEffect } from 'react'
import {
  useProfessions,
  usePopularItemStats,
  useSkills,
  useTraits,
  useRunes,
  useSigils,
} from '@/lib/gw2/hooks'
import { getAllSpecializations } from '@/lib/gw2/api'
import { calculateBuildStats } from '@/lib/gw2/build-calculator'
import type {
  Build,
  ProfessionId,
  SpecializationSelection,
  SkillSelection,
  GearSelection,
  Item,
  ItemStat,
  Specialization,
} from '@/lib/gw2/types'
import {
  ProfessionSelector,
  SpecializationSelector,
  TraitLineSelector,
  SkillBar,
  GearPanel,
  GearOptimizer,
  SkillDamageDisplay,
} from '@/components/build-editor'
import { InGameGearPanel } from '@/components/build-editor/in-game-gear-panel'
import { InGameStatsPanel } from '@/components/build-editor/in-game-stats-panel'
import { InGameSkillPanel } from '@/components/build-editor/in-game-skill-panel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Save, Share2, Sparkles } from 'lucide-react'

/**
 * Build Editor Page - Full Interactive Build Editor
 * Integrates all build editor components
 */
export default function BuildEditorPage() {
  // Data loading
  const { data: professions, isLoading: professionsLoading } = useProfessions()
  const { data: itemStats, isLoading: itemStatsLoading } = usePopularItemStats()
  const { data: skills, isLoading: skillsLoading } = useSkills()
  const { data: traits, isLoading: traitsLoading } = useTraits()
  const { data: runes, isLoading: runesLoading } = useRunes()
  const { data: sigils, isLoading: sigilsLoading } = useSigils()

  const [specializations, setSpecializations] = useState<Specialization[]>([])
  const [specsLoading, setSpecsLoading] = useState(true)

  // Build state
  const [build, setBuild] = useState<Build>(createDefaultBuild())

  // Optimizer modal state
  const [optimizerOpen, setOptimizerOpen] = useState(false)

  // Load specializations
  useEffect(() => {
    getAllSpecializations()
      .then(setSpecializations)
      .finally(() => setSpecsLoading(false))
  }, [])

  // Loading state
  const isLoading =
    professionsLoading ||
    itemStatsLoading ||
    skillsLoading ||
    traitsLoading ||
    runesLoading ||
    sigilsLoading ||
    specsLoading

  // Calculate stats
  const itemStatsMap = new Map<number, ItemStat>(
    itemStats?.map((stat) => [stat.id, stat] as [number, ItemStat]) || []
  )
  const itemsMap = new Map<number, Item>(
    [...(runes || []), ...(sigils || [])].map((item) => [item.id, item])
  )

  const stats =
    itemStats && !isLoading ? calculateBuildStats(build, itemStatsMap, itemsMap) : null

  // Update handlers
  const handleProfessionChange = (professionId: ProfessionId) => {
    setBuild({
      ...build,
      profession: professionId,
      specializations: [], // Reset specializations when changing profession
      skills: {
        heal: 0,
        utility1: 0,
        utility2: 0,
        utility3: 0,
        elite: 0,
      },
    })
  }

  const handleSpecializationChange = (specId: number | null) => {
    // When selecting/deselecting elite spec, maintain 3 total specializations
    // Remove any existing elite spec first
    const nonEliteSpecs = build.specializations.filter((s) => {
      const spec = specializations.find((spec) => spec.id === s.id)
      return spec && !spec.elite
    })

    if (specId) {
      // Adding an elite spec - keep up to 2 non-elite specs
      const specsToKeep = nonEliteSpecs.slice(0, 2)
      setBuild({
        ...build,
        specializations: [
          ...specsToKeep,
          {
            id: specId,
            traits: [0, 0, 0],
          },
        ],
      })
    } else {
      // Removing elite spec - keep all non-elite specs
      setBuild({
        ...build,
        specializations: nonEliteSpecs,
      })
    }
  }

  const handleTraitLinesChange = (lines: SpecializationSelection[]) => {
    setBuild({
      ...build,
      specializations: lines,
    })
  }

  const handleSkillsChange = (skills: SkillSelection) => {
    setBuild({
      ...build,
      skills,
    })
  }

  const handleGearChange = (gear: GearSelection) => {
    setBuild({
      ...build,
      gear,
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Loading Build Editor...</h2>
              <p className="text-muted-foreground">
                Fetching professions, skills, traits, and gear data
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Get available specializations for current profession
  const availableSpecs = specializations.filter(
    (spec) => spec.profession === build.profession
  )

  // Get selected elite spec (if any)
  const eliteSpecId = build.specializations.find((s) =>
    specializations.find((spec) => spec.id === s.id && spec.elite)
  )?.id

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Build Editor</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="bg-black/30 border-white/20 hover:bg-black/50">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" size="sm" disabled className="bg-black/30 border-white/20 hover:bg-black/50">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button size="sm" onClick={() => setOptimizerOpen(true)} className="bg-amber-600 hover:bg-amber-700">
                <Sparkles className="w-4 h-4 mr-2" />
                Optimize
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="container mx-auto p-4 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column - Equipment Slots */}
          <div className="col-span-2">
            {itemStats && runes && sigils && (
              <InGameGearPanel
                gear={build.gear}
                itemStats={itemStats}
                runes={runes}
                sigils={sigils}
                onUpdateGear={handleGearChange}
              />
            )}
          </div>

          {/* Center Column - Skills/Traits */}
          <div className="col-span-7 flex flex-col gap-4 overflow-y-auto">
            {/* Profession Selection */}
            <div className="flex-shrink-0 bg-black/30 backdrop-blur-md border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-white/80 mb-3">Profession</h2>
              {professions && (
                <ProfessionSelector
                  professions={professions}
                  selected={build.profession}
                  onSelect={handleProfessionChange}
                />
              )}
            </div>

            {/* Elite Specialization */}
            {specializations.length > 0 && (
              <div className="flex-shrink-0">
                <SpecializationSelector
                  specializations={specializations}
                  professionId={build.profession}
                  selected={eliteSpecId || null}
                  onSelect={handleSpecializationChange}
                />
              </div>
            )}

            {/* Skills & Traits */}
            {skills && traits && specializations.length > 0 && (
              <InGameSkillPanel
                skills={skills}
                traits={traits}
                profession={build.profession}
                skillSelection={build.skills}
                specializations={availableSpecs}
                selectedLines={build.specializations}
                onUpdateSkills={handleSkillsChange}
                onUpdateTraitLines={handleTraitLinesChange}
              />
            )}
          </div>

          {/* Right Column - Stats Panel */}
          <div className="col-span-3">
            <InGameStatsPanel stats={stats} />
          </div>
        </div>
      </div>

      {/* Gear Optimizer Modal */}
      {itemStats && (
        <GearOptimizer
          open={optimizerOpen}
          onClose={() => setOptimizerOpen(false)}
          build={build}
          itemStats={itemStats}
          onApplyGear={handleGearChange}
        />
      )}
    </div>
  )
}

/**
 * Create a default build with all fields initialized
 */
function createDefaultBuild(): Build {
  const defaultGearPiece = {
    statId: 584, // Berserker's
    rarity: 'Ascended' as const,
    infusions: [],
  }

  const defaultWeaponPiece = {
    ...defaultGearPiece,
    weaponType: 'Greatsword',
  }

  return {
    id: 'temp',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: 'New Build',
    profession: 'Warrior',
    specializations: [],
    skills: {
      heal: 0,
      utility1: 0,
      utility2: 0,
      utility3: 0,
      elite: 0,
    },
    gear: {
      helm: defaultGearPiece,
      shoulders: defaultGearPiece,
      coat: defaultGearPiece,
      gloves: defaultGearPiece,
      leggings: defaultGearPiece,
      boots: defaultGearPiece,
      amulet: defaultGearPiece,
      ring1: defaultGearPiece,
      ring2: defaultGearPiece,
      accessory1: defaultGearPiece,
      accessory2: defaultGearPiece,
      backItem: defaultGearPiece,
      relic: defaultGearPiece,
      weaponSet1Main: defaultWeaponPiece,
    },
    isPublic: false,
    tags: [],
    viewCount: 0,
    likeCount: 0,
  }
}

/**
 * StatRow component for displaying individual stats
 */
function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={highlight ? 'font-semibold' : 'text-sm'}>{label}</span>
      <span className={highlight ? 'font-bold text-primary' : 'text-sm font-mono'}>
        {value}
      </span>
    </div>
  )
}
