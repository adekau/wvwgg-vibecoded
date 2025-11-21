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
} from '@/components/build-editor'
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
    setBuild({
      ...build,
      // Add/update elite spec in specializations array
      specializations: specId
        ? [
            {
              id: specId,
              traits: [0, 0, 0],
            },
          ]
        : [],
    })
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
    <div className="container mx-auto p-4 md:p-8 max-w-[1600px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-bold">Build Editor</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button size="sm" disabled>
              <Sparkles className="w-4 h-4 mr-2" />
              Optimize
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Create and optimize your Guild Wars 2 build with advanced stat calculations
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Panel - Build Configuration */}
        <div className="xl:col-span-8 space-y-6">
          {/* Profession Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Profession</CardTitle>
              <CardDescription>Select your profession</CardDescription>
            </CardHeader>
            <CardContent>
              {professions && (
                <ProfessionSelector
                  professions={professions}
                  selected={build.profession}
                  onSelect={handleProfessionChange}
                />
              )}
            </CardContent>
          </Card>

          {/* Elite Specialization */}
          {specializations.length > 0 && (
            <SpecializationSelector
              specializations={specializations}
              professionId={build.profession}
              selected={eliteSpecId || null}
              onSelect={handleSpecializationChange}
            />
          )}

          {/* Trait Lines */}
          {specializations.length > 0 && traits && (
            <TraitLineSelector
              availableSpecializations={availableSpecs}
              selectedLines={build.specializations}
              allTraits={traits}
              onUpdateLines={handleTraitLinesChange}
            />
          )}

          {/* Skills */}
          {skills && (
            <SkillBar
              skills={skills}
              profession={build.profession}
              selection={build.skills}
              onUpdateSelection={handleSkillsChange}
            />
          )}

          {/* Gear */}
          {itemStats && runes && sigils && (
            <GearPanel
              gear={build.gear}
              itemStats={itemStats}
              runes={runes}
              sigils={sigils}
              onUpdateGear={handleGearChange}
            />
          )}
        </div>

        {/* Right Panel - Stats Display */}
        <div className="xl:col-span-4 space-y-6">
          {/* Base Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Base Stats</CardTitle>
              <CardDescription>Stats from gear</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats && (
                <>
                  <StatRow label="Power" value={stats.power} />
                  <StatRow label="Precision" value={stats.precision} />
                  <StatRow label="Ferocity" value={stats.ferocity} />
                  <Separator className="my-2" />
                  <StatRow label="Toughness" value={stats.toughness} />
                  <StatRow label="Vitality" value={stats.vitality} />
                  <Separator className="my-2" />
                  <StatRow label="Condition Damage" value={stats.conditionDamage} />
                  <StatRow label="Expertise" value={stats.expertise} />
                  <StatRow label="Concentration" value={stats.concentration} />
                  <StatRow label="Healing Power" value={stats.healingPower} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Derived Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Derived Stats</CardTitle>
              <CardDescription>Calculated from base stats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats && (
                <>
                  <StatRow
                    label="Crit Chance"
                    value={`${stats.critChance.toFixed(1)}%`}
                  />
                  <StatRow
                    label="Crit Damage"
                    value={`${(stats.critDamage * 100).toFixed(0)}%`}
                  />
                  <Separator className="my-2" />
                  <StatRow label="Health" value={stats.health.toLocaleString()} />
                  <StatRow label="Armor" value={stats.armor.toLocaleString()} />
                  <Separator className="my-2" />
                  <StatRow
                    label="Boon Duration"
                    value={`${stats.boonDuration.toFixed(1)}%`}
                  />
                  <StatRow
                    label="Condition Duration"
                    value={`${stats.conditionDuration.toFixed(1)}%`}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Effective Metrics */}
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-primary">Effective Metrics</CardTitle>
              <CardDescription>
                Advanced calculations for WvW optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats && (
                <>
                  <div className="space-y-1">
                    <StatRow
                      label="Effective Power (EP)"
                      value={stats.effectivePower.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                      highlight
                    />
                    <p className="text-xs text-muted-foreground">
                      Average damage accounting for crits
                    </p>
                  </div>

                  <div className="space-y-1">
                    <StatRow
                      label="Effective Health (EH)"
                      value={stats.effectiveHealth.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                      highlight
                    />
                    <p className="text-xs text-muted-foreground">
                      Tankiness from health + armor
                    </p>
                  </div>

                  <div className="space-y-1">
                    <StatRow
                      label="EH × EP (Bruiser Score)"
                      value={(stats.effectiveHealthPower / 1_000_000).toFixed(1) + 'M'}
                      highlight
                    />
                    <p className="text-xs text-muted-foreground">
                      Combined damage + survivability
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Formula Reference */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">Formula Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              <p>EP = Power × (1 + CC% × (CD - 1))</p>
              <p>EH = Health × (Armor / 1000)</p>
              <p>CC% = (Precision - 895) / 21</p>
              <p>CD = 1.5 + (Ferocity / 1500)</p>
            </CardContent>
          </Card>
        </div>
      </div>
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
