'use client'

import { useState } from 'react'
import { useProfessions, usePopularItemStats } from '@/lib/gw2/hooks'
import { calculateBuildStats, formatStatValue } from '@/lib/gw2/build-calculator'
import type { Build, ProfessionId, GearSelection, Item, ItemStat } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Build Editor Page - Proof of Concept
 * Demonstrates the GW2 build editor foundation
 */
export default function BuildEditorPage() {
  const { data: professions, isLoading: professionsLoading } = useProfessions()
  const { data: itemStats, isLoading: itemStatsLoading } = usePopularItemStats()

  const [selectedProfession, setSelectedProfession] = useState<ProfessionId>('Warrior')
  const [selectedStatId, setSelectedStatId] = useState<number>(584) // Berserker's

  // Create a default build for demonstration
  const createDefaultBuild = (): Build => {
    const defaultGearPiece = {
      statId: selectedStatId,
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
      name: 'Test Build',
      profession: selectedProfession,
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

  // Calculate stats
  const build = createDefaultBuild()
  const itemStatsMap = new Map<number, ItemStat>(
    itemStats?.map(stat => [stat.id, stat] as [number, ItemStat]) || []
  )
  const itemsMap = new Map<number, Item>() // Empty for now - we're only using stat combos

  const stats = itemStats
    ? calculateBuildStats(build, itemStatsMap, itemsMap)
    : null

  if (professionsLoading || itemStatsLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Loading Build Editor...</h2>
            <p className="text-muted-foreground">Fetching GW2 data</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">GW2 Build Editor</h1>
        <p className="text-muted-foreground">
          Create and optimize your Guild Wars 2 builds with gear optimizer and stat calculations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Build Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profession</CardTitle>
              <CardDescription>Select your profession</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProfession}
                onValueChange={(value) => setSelectedProfession(value as ProfessionId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select profession" />
                </SelectTrigger>
                <SelectContent>
                  {professions?.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gear Stats</CardTitle>
              <CardDescription>
                Select stat combination for all gear (Berserker, Marauder, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedStatId.toString()}
                onValueChange={(value) => setSelectedStatId(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select stat combo" />
                </SelectTrigger>
                <SelectContent>
                  {itemStats?.map((stat) => (
                    <SelectItem key={stat.id} value={stat.id.toString()}>
                      {stat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>Features coming soon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>✓ Data foundation complete</p>
              <p>✓ Calculation engine working</p>
              <p>✓ Real-time stat calculation</p>
              <p>⏳ Trait line selector</p>
              <p>⏳ Skill bar editor</p>
              <p>⏳ Individual gear piece editor</p>
              <p>⏳ Rune and sigil selector</p>
              <p>⏳ Gear optimizer</p>
              <p>⏳ Build save/share</p>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Stats Display */}
        <div className="space-y-6">
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
                  <StatRow label="Toughness" value={stats.toughness} />
                  <StatRow label="Vitality" value={stats.vitality} />
                  <StatRow label="Condition Damage" value={stats.conditionDamage} />
                  <StatRow label="Healing Power" value={stats.healingPower} />
                </>
              )}
            </CardContent>
          </Card>

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
                  <StatRow
                    label="Health"
                    value={stats.health.toLocaleString()}
                  />
                  <StatRow
                    label="Armor"
                    value={stats.armor.toLocaleString()}
                  />
                </>
              )}
            </CardContent>
          </Card>

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
                      value={stats.effectivePower.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      highlight
                    />
                    <p className="text-xs text-muted-foreground">
                      Average damage accounting for crits
                    </p>
                  </div>

                  <div className="space-y-1">
                    <StatRow
                      label="Effective Health (EH)"
                      value={stats.effectiveHealth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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

          <Card className="bg-muted">
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

function StatRow({
  label,
  value,
  highlight = false
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
