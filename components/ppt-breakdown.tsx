"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'
import { useMemo } from 'react'
import { PPT_VALUES, TIER_LABELS } from '@/lib/game-constants'

interface PPTBreakdownProps {
  matchId: string
  ppt: {
    red: number
    blue: number
    green: number
  }
  objectives: any[]
}

interface TierBreakdown {
  tier0: { count: number; ppt: number }
  tier1: { count: number; ppt: number }
  tier2: { count: number; ppt: number }
  tier3: { count: number; ppt: number }
  total: number
}

interface ObjectiveTypeBreakdown {
  camps: TierBreakdown
  towers: TierBreakdown
  keeps: TierBreakdown
  castles: TierBreakdown
}

interface DetailedPPT {
  red: ObjectiveTypeBreakdown
  blue: ObjectiveTypeBreakdown
  green: ObjectiveTypeBreakdown
}

const colorClasses = {
  red: {
    bg: 'bg-chart-1/10',
    text: 'text-chart-1',
    border: 'border-chart-1/30',
  },
  blue: {
    bg: 'bg-chart-2/10',
    text: 'text-chart-2',
    border: 'border-chart-2/30',
  },
  green: {
    bg: 'bg-chart-3/10',
    text: 'text-chart-3',
    border: 'border-chart-3/30',
  },
}

export function PPTBreakdown({ matchId, ppt, objectives: serverObjectives }: PPTBreakdownProps) {
  const loading = false

  const detailedPPT = useMemo(() => {
    try {
      // Helper to infer tier from points_tick using game constants
      const inferTier = (type: string, pointsTick: number): number => {
        const typeKey = type.toLowerCase() as keyof typeof PPT_VALUES;
        const pptArray = PPT_VALUES[typeKey];
        if (!pptArray) return 0;

        const tier = (pptArray as readonly number[]).indexOf(pointsTick);
        return tier !== -1 ? tier : 0;
      }

      // Initialize breakdown structure
      const createEmptyBreakdown = (): ObjectiveTypeBreakdown => ({
        camps: { tier0: { count: 0, ppt: 0 }, tier1: { count: 0, ppt: 0 }, tier2: { count: 0, ppt: 0 }, tier3: { count: 0, ppt: 0 }, total: 0 },
        towers: { tier0: { count: 0, ppt: 0 }, tier1: { count: 0, ppt: 0 }, tier2: { count: 0, ppt: 0 }, tier3: { count: 0, ppt: 0 }, total: 0 },
        keeps: { tier0: { count: 0, ppt: 0 }, tier1: { count: 0, ppt: 0 }, tier2: { count: 0, ppt: 0 }, tier3: { count: 0, ppt: 0 }, total: 0 },
        castles: { tier0: { count: 0, ppt: 0 }, tier1: { count: 0, ppt: 0 }, tier2: { count: 0, ppt: 0 }, tier3: { count: 0, ppt: 0 }, total: 0 },
      })

      const breakdown: DetailedPPT = {
        red: createEmptyBreakdown(),
        blue: createEmptyBreakdown(),
        green: createEmptyBreakdown(),
      }

      // Process server-provided objectives
      for (const obj of serverObjectives) {
        const owner = obj.owner?.toLowerCase() as 'red' | 'blue' | 'green' | undefined
        if (!owner || !['red', 'blue', 'green'].includes(owner)) continue

        const pointsTick = obj.points_tick || 0
        const tier = inferTier(obj.type, pointsTick)
        const tierKey = `tier${tier}` as 'tier0' | 'tier1' | 'tier2' | 'tier3'

        switch (obj.type) {
          case 'Camp':
            breakdown[owner].camps[tierKey].count++
            breakdown[owner].camps[tierKey].ppt += pointsTick
            breakdown[owner].camps.total += pointsTick
            break
          case 'Tower':
            breakdown[owner].towers[tierKey].count++
            breakdown[owner].towers[tierKey].ppt += pointsTick
            breakdown[owner].towers.total += pointsTick
            break
          case 'Keep':
            breakdown[owner].keeps[tierKey].count++
            breakdown[owner].keeps[tierKey].ppt += pointsTick
            breakdown[owner].keeps.total += pointsTick
            break
          case 'Castle':
            breakdown[owner].castles[tierKey].count++
            breakdown[owner].castles[tierKey].ppt += pointsTick
            breakdown[owner].castles.total += pointsTick
            break
        }
      }

      return breakdown
    } catch (error) {
      console.error('Failed to calculate detailed PPT:', error)
      return null
    }
  }, [serverObjectives])

  const highestPPT = Math.max(ppt.red, ppt.blue, ppt.green)

  // Helper to get highest PPT for each objective type
  const getHighestForObjectiveType = (objectiveType: 'castles' | 'towers' | 'keeps' | 'camps') => {
    if (!detailedPPT) return 0
    return Math.max(
      detailedPPT.red[objectiveType].total,
      detailedPPT.blue[objectiveType].total,
      detailedPPT.green[objectiveType].total
    )
  }

  if (loading || !detailedPPT) {
    return (
      <Card className="panel-border inset-card frosted-panel">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Points Per Tick Breakdown</h2>
          </div>
          <div className="text-center text-muted-foreground py-8">Loading PPT breakdown...</div>
        </div>
      </Card>
    )
  }

  // Helper to get PPT values string for an objective type
  const getPPTValuesString = (objectiveType: keyof typeof PPT_VALUES): string => {
    return PPT_VALUES[objectiveType].join('/');
  };

  // Helper to render tier details
  const renderTierDetails = (tierData: TierBreakdown) => {
    const tiers = TIER_LABELS.map((label, index) => ({
      key: `tier${index}` as const,
      label,
      data: tierData[`tier${index}` as keyof TierBreakdown] as { count: number; ppt: number },
    }))

    const nonZeroTiers = tiers.filter(t => t.data.count > 0)

    if (nonZeroTiers.length === 0) return <div className="text-muted-foreground text-xs h-[20px] flex items-center">—</div>

    return (
      <div className="flex flex-col justify-start min-h-[20px] gap-0.5">
        {nonZeroTiers.map(tier => (
          <div key={tier.key} className="text-xs leading-5 grid grid-cols-[auto_1fr_auto] gap-1 items-baseline">
            <span className="text-muted-foreground">{tier.label}: {tier.data.count}×</span>
            <span className="text-right">=</span>
            <span className="font-mono font-semibold">{tier.data.ppt}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card className="panel-border inset-card frosted-panel">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Points Per Tick Breakdown</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground w-32">Type</th>
                <th className="text-left py-2 px-2 font-medium text-chart-1">Red</th>
                <th className="text-left py-2 px-2 font-medium text-chart-2">Blue</th>
                <th className="text-left py-2 px-2 font-medium text-chart-3">Green</th>
              </tr>
            </thead>
            <tbody>
              {/* Castles */}
              <tr className="border-b border-border/30">
                <td className="py-3 px-2">
                  <div className="font-medium">Castles</div>
                  <div className="text-xs text-muted-foreground">{getPPTValuesString('castle')}</div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.red.castles.total > 0 && detailedPPT.red.castles.total === getHighestForObjectiveType('castles') && getHighestForObjectiveType('castles') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.red.castles.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.red.castles)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-1 text-xs">
                          = {detailedPPT.red.castles.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.blue.castles.total > 0 && detailedPPT.blue.castles.total === getHighestForObjectiveType('castles') && getHighestForObjectiveType('castles') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.blue.castles.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.blue.castles)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-2 text-xs">
                          = {detailedPPT.blue.castles.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.green.castles.total > 0 && detailedPPT.green.castles.total === getHighestForObjectiveType('castles') && getHighestForObjectiveType('castles') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.green.castles.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.green.castles)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-3 text-xs">
                          = {detailedPPT.green.castles.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* Keeps */}
              <tr className="border-b border-border/30">
                <td className="py-3 px-2">
                  <div className="font-medium">Keeps</div>
                  <div className="text-xs text-muted-foreground">{getPPTValuesString('keep')}</div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.red.keeps.total > 0 && detailedPPT.red.keeps.total === getHighestForObjectiveType('keeps') && getHighestForObjectiveType('keeps') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.red.keeps.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.red.keeps)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-1 text-xs">
                          = {detailedPPT.red.keeps.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.blue.keeps.total > 0 && detailedPPT.blue.keeps.total === getHighestForObjectiveType('keeps') && getHighestForObjectiveType('keeps') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.blue.keeps.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.blue.keeps)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-2 text-xs">
                          = {detailedPPT.blue.keeps.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.green.keeps.total > 0 && detailedPPT.green.keeps.total === getHighestForObjectiveType('keeps') && getHighestForObjectiveType('keeps') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.green.keeps.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.green.keeps)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-3 text-xs">
                          = {detailedPPT.green.keeps.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* Towers */}
              <tr className="border-b border-border/30">
                <td className="py-3 px-2">
                  <div className="font-medium">Towers</div>
                  <div className="text-xs text-muted-foreground">{getPPTValuesString('tower')}</div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.red.towers.total > 0 && detailedPPT.red.towers.total === getHighestForObjectiveType('towers') && getHighestForObjectiveType('towers') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.red.towers.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.red.towers)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-1 text-xs">
                          = {detailedPPT.red.towers.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.blue.towers.total > 0 && detailedPPT.blue.towers.total === getHighestForObjectiveType('towers') && getHighestForObjectiveType('towers') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.blue.towers.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.blue.towers)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-2 text-xs">
                          = {detailedPPT.blue.towers.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.green.towers.total > 0 && detailedPPT.green.towers.total === getHighestForObjectiveType('towers') && getHighestForObjectiveType('towers') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.green.towers.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.green.towers)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-3 text-xs">
                          = {detailedPPT.green.towers.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* Camps */}
              <tr className="border-b border-border/30">
                <td className="py-3 px-2">
                  <div className="font-medium">Camps</div>
                  <div className="text-xs text-muted-foreground">{getPPTValuesString('camp')}</div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.red.camps.total > 0 && detailedPPT.red.camps.total === getHighestForObjectiveType('camps') && getHighestForObjectiveType('camps') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.red.camps.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.red.camps)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-1 text-xs">
                          = {detailedPPT.red.camps.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.blue.camps.total > 0 && detailedPPT.blue.camps.total === getHighestForObjectiveType('camps') && getHighestForObjectiveType('camps') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.blue.camps.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.blue.camps)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-2 text-xs">
                          = {detailedPPT.blue.camps.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className={`flex flex-col h-full min-h-[60px] rounded ${detailedPPT.green.camps.total > 0 && detailedPPT.green.camps.total === getHighestForObjectiveType('camps') && getHighestForObjectiveType('camps') > 0 ? 'bg-amber-400/10 px-2 -mx-2' : ''}`}>
                    {detailedPPT.green.camps.total > 0 ? (
                      <>
                        <div className="flex-grow">{renderTierDetails(detailedPPT.green.camps)}</div>
                        <div className="mt-auto pt-2 border-t border-border/30 font-semibold text-chart-3 text-xs">
                          = {detailedPPT.green.camps.total} PPT
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-grow flex items-start">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-border/30 text-muted-foreground text-xs">
                          —
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>

              <tr className="bg-muted/20 font-bold">
                <td className="py-3 px-2">
                  Total PPT
                </td>
                <td className="text-center py-3 px-2">
                  <Badge
                    variant="outline"
                    className={`font-mono ${colorClasses.red.text} ${colorClasses.red.border} ${ppt.red === highestPPT && highestPPT > 0 ? 'bg-amber-400/20 border-amber-400' : ''}`}
                  >
                    {ppt.red} PPT
                  </Badge>
                </td>
                <td className="text-center py-3 px-2">
                  <Badge
                    variant="outline"
                    className={`font-mono ${colorClasses.blue.text} ${colorClasses.blue.border} ${ppt.blue === highestPPT && highestPPT > 0 ? 'bg-amber-400/20 border-amber-400' : ''}`}
                  >
                    {ppt.blue} PPT
                  </Badge>
                </td>
                <td className="text-center py-3 px-2">
                  <Badge
                    variant="outline"
                    className={`font-mono ${colorClasses.green.text} ${colorClasses.green.border} ${ppt.green === highestPPT && highestPPT > 0 ? 'bg-amber-400/20 border-amber-400' : ''}`}
                  >
                    {ppt.green} PPT
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>• All values calculated from real-time objective data (includes upgrade tiers)</p>
          <p>• Gold highlight indicates highest PPT (gaining ground fastest)</p>
        </div>
      </div>
    </Card>
  )
}
