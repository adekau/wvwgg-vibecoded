"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Play,
  Undo2,
  Redo2,
  RotateCcw,
  Share2,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { getVPTierForTime, getRegionFromMatchId } from '@/lib/vp-tiers'
import { TOTAL_SKIRMISHES_PER_MATCH } from '@/lib/game-constants'
import { calculateScenario, type ScenarioInput } from '@/lib/vp-scenario-solver-greedy'

interface InteractiveVPPlannerProps {
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

type Placement = 1 | 2 | 3 | null
type TeamColor = 'red' | 'blue' | 'green'

interface SkirmishAssignment {
  skirmishId: number
  placements: {
    red: Placement
    blue: Placement
    green: Placement
  }
}

interface SkirmishInfo {
  id: number
  startTime: Date
  endTime: Date
  vpAwards: { first: number; second: number; third: number }
}

const colorClasses = {
  red: {
    bg: 'bg-chart-1/18',
    text: 'text-chart-1',
    border: 'border-chart-1/25',
    hover: 'hover:bg-chart-1/30',
  },
  blue: {
    bg: 'bg-chart-2/18',
    text: 'text-chart-2',
    border: 'border-chart-2/25',
    hover: 'hover:bg-chart-2/30',
  },
  green: {
    bg: 'bg-chart-3/18',
    text: 'text-chart-3',
    border: 'border-chart-3/25',
    hover: 'hover:bg-chart-3/30',
  },
}

const placementColors = {
  1: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  2: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30',
  3: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
}

export function InteractiveVPPlanner({ matchId, match }: InteractiveVPPlannerProps) {
  // Calculate current VP for each team
  const currentVP = useMemo(() => ({
    red: match.worlds.find(w => w.color === 'red')?.victoryPoints || 0,
    blue: match.worlds.find(w => w.color === 'blue')?.victoryPoints || 0,
    green: match.worlds.find(w => w.color === 'green')?.victoryPoints || 0,
  }), [match.worlds])

  // Calculate remaining skirmishes
  const completedSkirmishes = match.skirmishes?.length || 0
  const remainingCount = TOTAL_SKIRMISHES_PER_MATCH - completedSkirmishes
  const currentSkirmishId = completedSkirmishes - 1

  // Calculate remaining skirmishes with their VP tiers
  const remainingSkirmishes = useMemo<SkirmishInfo[]>(() => {
    const matchStartDate = new Date(match.startDate)
    const region = getRegionFromMatchId(matchId)
    const skirmishes: SkirmishInfo[] = []

    for (let i = 1; i <= remainingCount; i++) {
      const skirmishId = currentSkirmishId + i
      const hoursFromStart = skirmishId * 2
      const startTime = new Date(matchStartDate.getTime() + hoursFromStart * 60 * 60 * 1000)
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
      const vpTier = getVPTierForTime(startTime, region)

      skirmishes.push({
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

    return skirmishes
  }, [matchId, match.startDate, remainingCount, currentSkirmishId])

  // State for assignments
  const [assignments, setAssignments] = useState<Map<number, SkirmishAssignment>>(new Map())
  const [history, setHistory] = useState<Map<number, SkirmishAssignment>[]>([new Map()])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [desiredOutcome, setDesiredOutcome] = useState<{
    first: TeamColor
    second: TeamColor
    third: TeamColor
  }>({ first: 'red', second: 'blue', third: 'green' })
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null)

  // Calculate projected VP based on current assignments
  const projectedVP = useMemo(() => {
    const vp = { ...currentVP }

    remainingSkirmishes.forEach(skirmish => {
      const assignment = assignments.get(skirmish.id)
      if (!assignment) return

      const teams: TeamColor[] = ['red', 'blue', 'green']
      teams.forEach(team => {
        const placement = assignment.placements[team]
        if (placement === 1) vp[team] += skirmish.vpAwards.first
        else if (placement === 2) vp[team] += skirmish.vpAwards.second
        else if (placement === 3) vp[team] += skirmish.vpAwards.third
      })
    })

    return vp
  }, [assignments, currentVP, remainingSkirmishes])

  // Check if current projection achieves desired outcome
  const outcomeStatus = useMemo(() => {
    const sorted = Object.entries(projectedVP)
      .sort(([, a], [, b]) => b - a)
      .map(([color]) => color as TeamColor)

    const achieves =
      sorted[0] === desiredOutcome.first &&
      sorted[1] === desiredOutcome.second &&
      sorted[2] === desiredOutcome.third

    return {
      achieves,
      currentStandings: sorted,
      vpGaps: {
        firstSecond: projectedVP[sorted[0]] - projectedVP[sorted[1]],
        secondThird: projectedVP[sorted[1]] - projectedVP[sorted[2]],
      }
    }
  }, [projectedVP, desiredOutcome])

  // Assignment change handler
  const handlePlacementChange = useCallback((skirmishId: number, team: TeamColor, placement: Placement) => {
    setAssignments(prev => {
      const newAssignments = new Map(prev)
      const current = newAssignments.get(skirmishId) || {
        skirmishId,
        placements: { red: null, blue: null, green: null }
      }

      // Validate: ensure no duplicate placements in same skirmish
      if (placement !== null) {
        const teams: TeamColor[] = ['red', 'blue', 'green']
        teams.forEach(t => {
          if (t !== team && current.placements[t] === placement) {
            current.placements[t] = null
          }
        })
      }

      current.placements[team] = placement
      newAssignments.set(skirmishId, current)

      // Add to history
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(new Map(newAssignments))
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)

      return newAssignments
    })
  }, [history, historyIndex])

  // Undo/Redo handlers
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1)
      setAssignments(new Map(history[historyIndex - 1]))
    }
  }, [canUndo, historyIndex, history])

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1)
      setAssignments(new Map(history[historyIndex + 1]))
    }
  }, [canRedo, historyIndex, history])

  // Reset handler
  const handleReset = useCallback(() => {
    setAssignments(new Map())
    setHistory([new Map()])
    setHistoryIndex(0)
  }, [])

  // Share handler (encode scenario to URL)
  const handleShare = useCallback(() => {
    const encoded = encodeScenario(assignments)
    const url = `${window.location.origin}${window.location.pathname}?scenario=${encoded}`
    navigator.clipboard.writeText(url)
    alert('Scenario link copied to clipboard!')
  }, [assignments])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // Auto-fill handler (use solver solution)
  const handleAutoFill = useCallback(async () => {
    setIsAutoFilling(true)
    setAutoFillMessage('Running solver...')

    try {
      // Prepare input for solver
      const solverInput: ScenarioInput = {
        currentVP,
        remainingSkirmishes: remainingSkirmishes.map(s => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          vpAwards: s.vpAwards,
        })),
        desiredOutcome,
        minMargin: 0,
      }

      // Call the solver
      const result = await calculateScenario(solverInput)

      const newAssignments = new Map<number, SkirmishAssignment>()

      if (result.isPossible && result.requiredPlacements) {
        // Use solver's solution
        result.requiredPlacements.forEach(placement => {
          newAssignments.set(placement.skirmishId, {
            skirmishId: placement.skirmishId,
            placements: placement.placements,
          })
        })

        setAutoFillMessage(
          `Solution found using ${result.solver || 'solver'}! ` +
          `Difficulty: ${result.difficulty || 'unknown'}. ` +
          `Final margin: ${result.margin || 0} VP.`
        )
      } else {
        // Fallback to simple greedy strategy if solver couldn't find a solution
        remainingSkirmishes.forEach(skirmish => {
          newAssignments.set(skirmish.id, {
            skirmishId: skirmish.id,
            placements: {
              [desiredOutcome.first]: 1,
              [desiredOutcome.second]: 2,
              [desiredOutcome.third]: 3,
            } as any
          })
        })

        setAutoFillMessage(
          `Solver could not find a solution. Using simple greedy strategy instead. ` +
          `Reason: ${result.reason || 'Unknown'}`
        )
      }

      setAssignments(newAssignments)
      setHistory([...history, newAssignments])
      setHistoryIndex(history.length)
    } catch (error) {
      // Fallback to simple greedy strategy on error
      const newAssignments = new Map<number, SkirmishAssignment>()

      remainingSkirmishes.forEach(skirmish => {
        newAssignments.set(skirmish.id, {
          skirmishId: skirmish.id,
          placements: {
            [desiredOutcome.first]: 1,
            [desiredOutcome.second]: 2,
            [desiredOutcome.third]: 3,
          } as any
        })
      })

      setAssignments(newAssignments)
      setHistory([...history, newAssignments])
      setHistoryIndex(history.length)
      setAutoFillMessage('Error running solver. Using simple greedy strategy.')
    } finally {
      setIsAutoFilling(false)
      // Clear message after 5 seconds
      setTimeout(() => setAutoFillMessage(null), 5000)
    }
  }, [remainingSkirmishes, desiredOutcome, history, currentVP])

  if (remainingCount === 0) {
    return (
      <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
        <div className="p-6 text-center text-muted-foreground">
          No remaining skirmishes in this match. The final standings are determined.
        </div>
      </Card>
    )
  }

  return (
    <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Interactive Scenario Builder</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              title="Reset all assignments"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              title="Share scenario"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-6">
          Manually assign skirmish placements to explore different scenarios.
          Watch the projections update in real-time as you make changes.
        </div>

        {/* Desired Outcome Selector */}
        <div className="mb-6 p-4 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Target Outcome</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              disabled={isAutoFilling}
              className="text-xs"
            >
              <Lightbulb className="h-3 w-3 mr-1" />
              {isAutoFilling ? 'Solving...' : 'Auto-fill'}
            </Button>
          </div>
          {autoFillMessage && (
            <div className="mb-3 p-2 rounded bg-blue-500/10 border border-blue-500/30 text-xs text-blue-700 dark:text-blue-300">
              {autoFillMessage}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {(['first', 'second', 'third'] as const).map((place, index) => (
              <div key={place}>
                <label className="text-xs text-muted-foreground mb-2 block">
                  {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'} Place
                </label>
                <select
                  value={desiredOutcome[place]}
                  onChange={(e) => setDesiredOutcome({
                    ...desiredOutcome,
                    [place]: e.target.value as TeamColor
                  })}
                  className="w-full text-sm border rounded px-3 py-2 bg-background"
                >
                  {(['red', 'blue', 'green'] as TeamColor[]).map(color => {
                    const world = match.worlds.find(w => w.color === color)
                    return (
                      <option key={color} value={color}>
                        {world?.name || color}
                      </option>
                    )
                  })}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Live Projection */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          outcomeStatus.achieves
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {outcomeStatus.achieves ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-green-600 dark:text-green-400">
                  On Track!
                </h3>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-semibold text-orange-600 dark:text-orange-400">
                  Adjust Placements
                </h3>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {outcomeStatus.currentStandings.map((color, index) => {
              const world = match.worlds.find(w => w.color === color)
              const isTarget =
                (index === 0 && color === desiredOutcome.first) ||
                (index === 1 && color === desiredOutcome.second) ||
                (index === 2 && color === desiredOutcome.third)

              const vpChange = projectedVP[color] - currentVP[color]

              return (
                <div
                  key={color}
                  className={`rounded-md p-3 border-2 ${colorClasses[color].bg} ${
                    isTarget ? colorClasses[color].border : 'border-transparent'
                  }`}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'} Place
                    {isTarget && <span className="ml-1">✓</span>}
                  </div>
                  <div className="font-medium text-sm truncate" title={world?.name}>
                    {world?.name}
                  </div>
                  <div className="text-xs font-mono mt-1 flex items-center gap-1">
                    {projectedVP[color]} VP
                    {vpChange > 0 && (
                      <span className="text-green-600 dark:text-green-400 flex items-center">
                        <TrendingUp className="h-3 w-3" />
                        +{vpChange}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Skirmish Assignment Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted z-10">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-medium">Skirmish</th>
                  <th className="text-left py-3 px-3 font-medium">Time</th>
                  <th className="text-center py-3 px-3 font-medium">VP Awards</th>
                  {match.worlds.map(world => (
                    <th
                      key={world.color}
                      className={`text-center py-3 px-3 font-medium ${colorClasses[world.color].text}`}
                    >
                      {world.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {remainingSkirmishes.map((skirmish) => {
                  const assignment = assignments.get(skirmish.id)
                  const isComplete = assignment &&
                    assignment.placements.red !== null &&
                    assignment.placements.blue !== null &&
                    assignment.placements.green !== null

                  return (
                    <tr
                      key={skirmish.id}
                      className={`border-b border-border/50 ${isComplete ? 'bg-muted/30' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          #{skirmish.id + 1}
                          {isComplete && (
                            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-xs">
                        {skirmish.startTime.toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-xs">
                        {skirmish.vpAwards.first}/{skirmish.vpAwards.second}/{skirmish.vpAwards.third}
                      </td>
                      {match.worlds.map(world => {
                        const placement = assignment?.placements[world.color]

                        return (
                          <td key={world.color} className="py-3 px-3">
                            <select
                              value={placement || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                handlePlacementChange(
                                  skirmish.id,
                                  world.color,
                                  value === '' ? null : parseInt(value) as Placement
                                )
                              }}
                              className={`w-full text-xs border rounded px-2 py-1 ${
                                placement ? placementColors[placement] : 'bg-background'
                              }`}
                            >
                              <option value="">-</option>
                              <option value="1">1st</option>
                              <option value="2">2nd</option>
                              <option value="3">3rd</option>
                            </select>
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

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Assigned:</span>{' '}
            {Array.from(assignments.values()).filter(a =>
              a.placements.red !== null && a.placements.blue !== null && a.placements.green !== null
            ).length} / {remainingSkirmishes.length}
          </div>
          <div>
            <span className="font-medium">1st-2nd Gap:</span>{' '}
            {outcomeStatus.vpGaps.firstSecond > 0 ? '+' : ''}{outcomeStatus.vpGaps.firstSecond} VP
          </div>
          <div>
            <span className="font-medium">2nd-3rd Gap:</span>{' '}
            {outcomeStatus.vpGaps.secondThird > 0 ? '+' : ''}{outcomeStatus.vpGaps.secondThird} VP
          </div>
        </div>
      </div>
    </Card>
  )
}

// Helper function to encode scenario to URL-safe string
function encodeScenario(assignments: Map<number, SkirmishAssignment>): string {
  const data = Array.from(assignments.entries()).map(([id, assignment]) => ({
    id,
    p: assignment.placements
  }))
  return btoa(JSON.stringify(data))
}

// Helper function to decode scenario from URL
export function decodeScenario(encoded: string): Map<number, SkirmishAssignment> {
  try {
    const data = JSON.parse(atob(encoded))
    const map = new Map<number, SkirmishAssignment>()
    data.forEach(({ id, p }: any) => {
      map.set(id, {
        skirmishId: id,
        placements: p
      })
    })
    return map
  } catch {
    return new Map()
  }
}
