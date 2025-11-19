"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calculator, CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import {
  calculateScenario,
  getCurrentStandings,
  type ScenarioInput,
  type ScenarioResult,
} from '@/lib/vp-scenario-solver-greedy'
import { getVPTierForTime, getRegionFromMatchId } from '@/lib/vp-tiers'

interface VPScenarioPlannerProps {
  matchId: string
  match: {
    startDate: string
    worlds: Array<{
      name: string
      color: 'red' | 'blue' | 'green'
      victoryPoints: number
    }>
    skirmishes?: Array<{
      id: number
      vpTier?: {
        first: number
        second: number
        third: number
        tier: 'low' | 'medium' | 'high' | 'peak'
      }
    }>
  }
}

const colorClasses = {
  red: {
    bg: 'bg-chart-1/18',
    text: 'text-chart-1',
    border: 'border-chart-1/25',
  },
  blue: {
    bg: 'bg-chart-2/18',
    text: 'text-chart-2',
    border: 'border-chart-2/25',
  },
  green: {
    bg: 'bg-chart-3/18',
    text: 'text-chart-3',
    border: 'border-chart-3/25',
  },
}

const difficultyColors = {
  easy: 'text-green-600 dark:text-green-400',
  moderate: 'text-yellow-600 dark:text-yellow-400',
  hard: 'text-orange-600 dark:text-orange-400',
  'very-hard': 'text-red-600 dark:text-red-400',
}

export function VPScenarioPlanner({ matchId, match }: VPScenarioPlannerProps) {
  const [desiredFirst, setDesiredFirst] = useState<'red' | 'blue' | 'green'>('red')
  const [desiredSecond, setDesiredSecond] = useState<'red' | 'blue' | 'green'>('blue')
  const [desiredThird, setDesiredThird] = useState<'red' | 'blue' | 'green'>('green')
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Reset result when desired outcome changes
  const handleFirstChange = (value: 'red' | 'blue' | 'green') => {
    setDesiredFirst(value)
    setResult(null)
  }

  const handleSecondChange = (value: 'red' | 'blue' | 'green') => {
    setDesiredSecond(value)
    setResult(null)
  }

  const handleThirdChange = (value: 'red' | 'blue' | 'green') => {
    setDesiredThird(value)
    setResult(null)
  }

  // Calculate current VP for each team
  const currentVP = {
    red: match.worlds.find(w => w.color === 'red')?.victoryPoints || 0,
    blue: match.worlds.find(w => w.color === 'blue')?.victoryPoints || 0,
    green: match.worlds.find(w => w.color === 'green')?.victoryPoints || 0,
  }

  // Calculate remaining skirmishes
  const totalSkirmishes = 84 // 7 days × 12 skirmishes per day
  const completedSkirmishes = match.skirmishes?.length || 0
  const remainingCount = totalSkirmishes - completedSkirmishes

  // Get current skirmish ID (0-indexed, so if 34 are complete, next is skirmish 34 which is the 35th skirmish)
  const currentSkirmishId = completedSkirmishes - 1

  // Calculate remaining skirmishes with their VP tiers and timing
  const matchStartDate = new Date(match.startDate)
  const region = getRegionFromMatchId(matchId)
  const remainingSkirmishes: Array<{
    id: number
    startTime: Date
    endTime: Date
    vpAwards: { first: number; second: number; third: number }
  }> = []
  for (let i = 1; i <= remainingCount; i++) {
    const skirmishId = currentSkirmishId + i

    // Calculate skirmish start and end times (each skirmish is 2 hours)
    const hoursFromStart = skirmishId * 2
    const startTime = new Date(matchStartDate.getTime() + hoursFromStart * 60 * 60 * 1000)
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)

    // Calculate VP tier based on time
    const vpTier = getVPTierForTime(startTime, region)

    remainingSkirmishes.push({
      id: skirmishId,
      startTime,
      endTime,
      vpAwards: {
        first: vpTier.first,
        second: vpTier.second,
        third: vpTier.third,
      },
    })
  }

  const handleCalculate = async () => {
    setIsCalculating(true)
    try {
      const input: ScenarioInput = {
        currentVP,
        remainingSkirmishes,
        desiredOutcome: {
          first: desiredFirst,
          second: desiredSecond,
          third: desiredThird,
        },
      }

      const scenarioResult = await calculateScenario(input)
      setResult(scenarioResult)
    } catch (error) {
      console.error('Error calculating scenario:', error)
      setResult({
        isPossible: false,
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      })
    } finally {
      setIsCalculating(false)
    }
  }

  // Get current standings
  const currentStandings = getCurrentStandings(currentVP)

  // Available options for each dropdown (excluding already selected)
  const colors: Array<'red' | 'blue' | 'green'> = ['red', 'blue', 'green']

  return (
    <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">VP Scenario Planner</h2>
        </div>

        <div className="text-sm text-muted-foreground mb-6">
          Explore "what if" scenarios to see if desired match outcomes are achievable.
          {remainingCount > 0 && (
            <span className="block mt-1">
              {remainingCount} skirmish{remainingCount !== 1 ? 'es' : ''} remaining in this match.
            </span>
          )}
        </div>

        {/* Current Standings */}
        <div className="mb-6 p-4 rounded-lg bg-muted/30">
          <h3 className="text-sm font-medium mb-3">Current Standings</h3>
          <div className="grid grid-cols-3 gap-3">
            {[currentStandings.first, currentStandings.second, currentStandings.third].map((color, index) => {
              const world = match.worlds.find(w => w.color === color)
              return (
                <div key={color} className={`rounded-md p-3 border ${colorClasses[color].bg} ${colorClasses[color].border}`}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'} Place
                  </div>
                  <div className="font-medium text-sm truncate" title={world?.name}>
                    {world?.name}
                  </div>
                  <div className="text-xs font-mono mt-1">
                    {currentVP[color]} VP
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Desired Outcome Selector */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Desired Final Standings</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">1st Place</label>
              <select
                value={desiredFirst}
                onChange={(e) => handleFirstChange(e.target.value as any)}
                className="w-full text-sm border rounded px-3 py-2 bg-background"
              >
                {colors.map((color) => {
                  const world = match.worlds.find(w => w.color === color)
                  return (
                    <option key={color} value={color}>
                      {world?.name || color}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">2nd Place</label>
              <select
                value={desiredSecond}
                onChange={(e) => handleSecondChange(e.target.value as any)}
                className="w-full text-sm border rounded px-3 py-2 bg-background"
              >
                {colors.map((color) => {
                  const world = match.worlds.find(w => w.color === color)
                  return (
                    <option key={color} value={color}>
                      {world?.name || color}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">3rd Place</label>
              <select
                value={desiredThird}
                onChange={(e) => handleThirdChange(e.target.value as any)}
                className="w-full text-sm border rounded px-3 py-2 bg-background"
              >
                {colors.map((color) => {
                  const world = match.worlds.find(w => w.color === color)
                  return (
                    <option key={color} value={color}>
                      {world?.name || color}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <Button
            onClick={handleCalculate}
            className="w-full mt-4"
            disabled={remainingCount === 0 || isCalculating}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculating ? 'Calculating...' : 'Calculate Scenario'}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className={`rounded-lg p-4 border ${result.isPossible ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.isPossible ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-600 dark:text-green-400">
                    This outcome is achievable!
                  </h3>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <h3 className="font-semibold text-red-600 dark:text-red-400">
                    This outcome is not achievable
                  </h3>
                </>
              )}
            </div>

            {result.isPossible ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {result.difficulty && (
                    <div>
                      <span className="text-sm text-muted-foreground">Difficulty: </span>
                      <Badge variant="outline" className={difficultyColors[result.difficulty]}>
                        {result.difficulty.replace('-', ' ')}
                      </Badge>
                    </div>
                  )}
                  {result.solver && (
                    <div>
                      <span className="text-sm text-muted-foreground">Solver: </span>
                      <Badge variant="outline">
                        {result.solver === 'dfs' ? 'DFS (Optimal)' : result.solver === 'random' ? 'Random Search' : 'Greedy'}
                      </Badge>
                    </div>
                  )}
                </div>

                {result.finalVP && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Projected Final VP</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[desiredFirst, desiredSecond, desiredThird].map((color, index) => {
                        const world = match.worlds.find(w => w.color === color)
                        return (
                          <div key={color} className={`rounded p-2 text-center ${colorClasses[color].bg} border ${colorClasses[color].border}`}>
                            <div className="text-xs text-muted-foreground">
                              {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
                            </div>
                            <div className="text-sm font-medium truncate" title={world?.name}>
                              {world?.name}
                            </div>
                            <div className="font-mono font-bold text-sm">
                              {result.finalVP?.[color]} VP
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {result.margin !== undefined && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Margin between 1st and 2nd: {result.margin} VP
                      </p>
                    )}
                  </div>
                )}

                {/* Minimum Effort Breakdown */}
                {result.requiredPlacements && result.requiredPlacements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Minimum Effort Scenario</h4>
                    <div className="text-xs text-muted-foreground mb-2">
                      Required placements for each remaining skirmish to achieve this outcome:
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b border-border/50">
                            <th className="text-left py-2 px-2">Skirmish</th>
                            <th className="text-left py-2 px-2">Time</th>
                            <th className="text-center py-2 px-2">VP Awards</th>
                            {match.worlds.map(world => (
                              <th key={world.color} className={`text-center py-2 px-2 ${colorClasses[world.color].text}`}>
                                {world.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.requiredPlacements.map((placement) => {
                            const skirmish = remainingSkirmishes.find(s => s.id === placement.skirmishId)
                            if (!skirmish) return null

                            return (
                              <tr key={placement.skirmishId} className="border-b border-border/50">
                                <td className="py-2 px-2">#{skirmish.id + 1}</td>
                                <td className="py-2 px-2 whitespace-nowrap">
                                  {skirmish.startTime.toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2 px-2 text-center font-mono">
                                  {skirmish.vpAwards.first}/{skirmish.vpAwards.second}/{skirmish.vpAwards.third}
                                </td>
                                {match.worlds.map(world => {
                                  const place = placement.placements[world.color]
                                  const placeText = place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'
                                  const placeBg = place === 1 ? 'bg-yellow-500/20' : place === 2 ? 'bg-gray-500/20' : 'bg-orange-500/20'

                                  return (
                                    <td key={world.color} className="py-2 px-2 text-center">
                                      <span className={`inline-block px-2 py-1 rounded ${placeBg} font-semibold`}>
                                        {placeText}
                                      </span>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {result.reason}
              </div>
            )}
          </div>
        )}

        {remainingCount === 0 && (
          <div className="text-center text-muted-foreground text-sm p-4 rounded-lg bg-muted/30">
            No remaining skirmishes in this match. The final standings are determined.
          </div>
        )}
      </div>
    </Card>
  )
}
