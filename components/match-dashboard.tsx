"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trophy, Swords, Loader2, Info } from 'lucide-react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { ObjectivesDisplay } from '@/components/objectives-display'
import { SkirmishTimer } from '@/components/skirmish-timer'
import { AutoRefresh } from '@/components/auto-refresh'
import { PrimeTimePerformance } from '@/components/prime-time-performance'
import { PPTBreakdown } from '@/components/ppt-breakdown'
import { WorldAlliances } from '@/components/world-alliances'
import { SkirmishWinScenarioModal } from '@/components/skirmish-win-scenario-modal'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { calculateMatchPPT, getPPTTrend, calculateTicksBehind, ticksToTimeString, getTeamStatus, calculateRequiredPPTToOvertake, calculateMaxAchievablePPT } from '@/lib/ppt-calculator'
import { IGuild } from '@/server/queries'
import { SKIRMISH_DURATION_MS, POLL_INTERVALS_MS } from '@/lib/game-constants'

interface World {
  id: number
  name: string
  kills: number
  deaths: number
  color: 'red' | 'blue' | 'green'
  score: number
  victoryPoints: number
  skirmishes: { first: number; second: number; third: number; current: number }
}

interface Skirmish {
  id: number
  scores: {
    red: number
    blue: number
    green: number
  }
  vpTier?: {
    first: number
    second: number
    third: number
    tier: 'low' | 'medium' | 'high' | 'peak'
  }
}

interface MapData {
  id: number
  type: string
  scores: { red: number; blue: number; green: number }
  kills: { red: number; blue: number; green: number }
  deaths: { red: number; blue: number; green: number }
}

interface Match {
  tier: string
  region: string
  startDate: string
  endDate: string
  worlds: World[]
  objectives: {
    red: { keeps: number; towers: number; camps: number; castles: number }
    blue: { keeps: number; towers: number; camps: number; castles: number }
    green: { keeps: number; towers: number; camps: number; castles: number }
  }
  actualPPT?: {
    red: number
    blue: number
    green: number
  }
  maps?: MapData[]
  skirmishes?: Skirmish[]
}

interface MatchDashboardProps {
  match: Match
  matchId: string
  guilds: IGuild[]
  detailedObjectives: any[]
  primeTimeStats?: any // Pre-computed prime time stats from DynamoDB
}

const colorClasses = {
  red: {
    bg: 'bg-chart-1/18',
    text: 'text-chart-1',
    border: 'border-chart-1/25',
    primary: 'bg-chart-1'
  },
  blue: {
    bg: 'bg-chart-2/18',
    text: 'text-chart-2',
    border: 'border-chart-2/25',
    primary: 'bg-chart-2'
  },
  green: {
    bg: 'bg-chart-3/18',
    text: 'text-chart-3',
    border: 'border-chart-3/25',
    primary: 'bg-chart-3'
  },
}

const vpTierColors = {
  low: 'text-gray-500 dark:text-gray-400',
  medium: 'text-blue-600 dark:text-blue-400',
  high: 'text-orange-600 dark:text-orange-400',
  peak: 'text-purple-600 dark:text-purple-400',
}

const vpTierLabels = {
  low: 'Low Activity',
  medium: 'Medium Activity',
  high: 'High Activity',
  peak: 'Peak Hours',
}

interface HistoryPoint {
  timestamp: string
  red: { score: number; kills: number; deaths: number; victoryPoints: number }
  blue: { score: number; kills: number; deaths: number; victoryPoints: number }
  green: { score: number; kills: number; deaths: number; victoryPoints: number }
  maps?: HistoryMapData[]
}

interface HistoryMapData {
  type: string
  scores: { red: number; blue: number; green: number }
  kills: { red: number; blue: number; green: number }
  deaths: { red: number; blue: number; green: number }
}

export function MatchDashboard({ match, matchId, guilds, detailedObjectives, primeTimeStats }: MatchDashboardProps) {
  const sortedWorlds = useMemo(() => [...match.worlds].sort((a, b) => b.score - a.score), [match.worlds])
  const highestScore = sortedWorlds[0]?.score || 1 // Prevent division by zero

  // Use actual PPT from API if available, otherwise calculate from objectives
  const matchPPT = useMemo(() => match.actualPPT
    ? {
        red: { total: match.actualPPT.red, breakdown: { camps: 0, towers: 0, keeps: 0, castles: 0 } },
        blue: { total: match.actualPPT.blue, breakdown: { camps: 0, towers: 0, keeps: 0, castles: 0 } },
        green: { total: match.actualPPT.green, breakdown: { camps: 0, towers: 0, keeps: 0, castles: 0 } },
      }
    : calculateMatchPPT(match.objectives), [match.actualPPT, match.objectives])

  const highestPPT = useMemo(() => Math.max(matchPPT.red.total, matchPPT.blue.total, matchPPT.green.total), [matchPPT])

  // Get the leader's PPT (for comparison - teams are compared against the score leader, not PPT leader)
  const leaderColor = sortedWorlds[0]?.color || 'red'
  const leaderPPT = matchPPT[leaderColor].total

  const [selectedSkirmish, setSelectedSkirmish] = useState<number | 'all'>('all')
  const [selectedMap, setSelectedMap] = useState<string>('all')
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [openModalColor, setOpenModalColor] = useState<'red' | 'blue' | 'green' | null>(null)

  const skirmishes = match.skirmishes || []
  const maps = match.maps || []

  // Fetch history data client-side for skirmish calculations
  useEffect(() => {
    async function fetchHistory() {
      try {
        setHistoryLoading(true)
        const response = await fetch(`/api/history/${matchId}`)
        if (response.ok) {
          const data = await response.json()
          setHistoryData(data.history || [])
        }
      } catch (error) {
        console.error('Failed to fetch match history:', error)
      } finally {
        setHistoryLoading(false)
      }
    }
    fetchHistory()
  }, [matchId])

  const mapTypeNames: Record<string, string> = useMemo(() => ({
    'Center': 'Eternal Battlegrounds',
    'RedHome': 'Red Borderlands',
    'BlueHome': 'Blue Borderlands',
    'GreenHome': 'Green Borderlands',
  }), [])

  const mapOptions = useMemo(() => [
    { value: 'all', label: 'All Maps' },
    ...maps.map((m) => ({
      value: m.type,
      label: mapTypeNames[m.type] || m.type
    }))
  ], [maps, mapTypeNames])

  // Format skirmish time based on when it occurred
  const formatSkirmishTime = useCallback((skirmishId: number) => {
    const matchStart = new Date(match.startDate)
    // Each skirmish is 2 hours, skirmish IDs are 1-indexed
    const skirmishStart = new Date(matchStart.getTime() + ((skirmishId - 1) * SKIRMISH_DURATION_MS))

    return skirmishStart.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [match.startDate])

  const getTierIndicator = useCallback((tier?: 'low' | 'medium' | 'high' | 'peak') => {
    switch (tier) {
      case 'low': return '○';
      case 'medium': return '◐';
      case 'high': return '◉';
      case 'peak': return '⦿';
      default: return '';
    }
  }, [])

  const skirmishOptions = useMemo(() => [
    { value: 'all', label: 'All Skirmishes (Total)', tier: undefined },
    ...skirmishes
      .slice()
      .reverse()
      .map((s) => {
        const vpInfo = s.vpTier ? ` (${s.vpTier.first}/${s.vpTier.second}/${s.vpTier.third} VP)` : '';
        const tierIndicator = getTierIndicator(s.vpTier?.tier);
        return {
          value: s.id,
          label: `${tierIndicator} #${s.id} ${formatSkirmishTime(s.id)}${vpInfo}`,
          tier: s.vpTier?.tier
        };
      })
  ], [skirmishes, formatSkirmishTime, getTierIndicator])

  // Calculate per-skirmish stats from history data
  const calculateSkirmishStats = useCallback((skirmishId: number) => {
    if (historyData.length === 0) return null

    const matchStart = new Date(match.startDate)
    const skirmishStart = new Date(matchStart.getTime() + ((skirmishId - 1) * SKIRMISH_DURATION_MS))
    const skirmishEnd = new Date(skirmishStart.getTime() + SKIRMISH_DURATION_MS)

    // Find history points closest to start and end of skirmish
    const startPoint = historyData.reduce((closest, point) => {
      const pointTime = new Date(point.timestamp).getTime()
      const closestTime = new Date(closest.timestamp).getTime()
      return Math.abs(pointTime - skirmishStart.getTime()) < Math.abs(closestTime - skirmishStart.getTime()) ? point : closest
    })

    const endPoint = historyData.reduce((closest, point) => {
      const pointTime = new Date(point.timestamp).getTime()
      const closestTime = new Date(closest.timestamp).getTime()
      return Math.abs(pointTime - skirmishEnd.getTime()) < Math.abs(closestTime - skirmishEnd.getTime()) ? point : closest
    })

    return {
      red: {
        kills: endPoint.red.kills - startPoint.red.kills,
        deaths: endPoint.red.deaths - startPoint.red.deaths,
        victoryPoints: endPoint.red.victoryPoints - startPoint.red.victoryPoints,
      },
      blue: {
        kills: endPoint.blue.kills - startPoint.blue.kills,
        deaths: endPoint.blue.deaths - startPoint.blue.deaths,
        victoryPoints: endPoint.blue.victoryPoints - startPoint.blue.victoryPoints,
      },
      green: {
        kills: endPoint.green.kills - startPoint.green.kills,
        deaths: endPoint.green.deaths - startPoint.green.deaths,
        victoryPoints: endPoint.green.victoryPoints - startPoint.green.victoryPoints,
      },
    }
  }, [historyData, match.startDate])

  // Calculate per-skirmish, per-map stats from history
  const calculateSkirmishMapStats = useCallback((skirmishId: number, mapType: string) => {
    if (historyData.length === 0) return null

    const matchStart = new Date(match.startDate)
    const skirmishStart = new Date(matchStart.getTime() + ((skirmishId - 1) * SKIRMISH_DURATION_MS))
    const skirmishEnd = new Date(skirmishStart.getTime() + SKIRMISH_DURATION_MS)

    // Find history points closest to start and end of skirmish
    const startPoint = historyData.reduce((closest, point) => {
      const pointTime = new Date(point.timestamp).getTime()
      const closestTime = new Date(closest.timestamp).getTime()
      return Math.abs(pointTime - skirmishStart.getTime()) < Math.abs(closestTime - skirmishStart.getTime()) ? point : closest
    })

    const endPoint = historyData.reduce((closest, point) => {
      const pointTime = new Date(point.timestamp).getTime()
      const closestTime = new Date(closest.timestamp).getTime()
      return Math.abs(pointTime - skirmishEnd.getTime()) < Math.abs(closestTime - skirmishEnd.getTime()) ? point : closest
    })

    // Get map data from history snapshots
    const startMapData = startPoint?.maps?.find((m: HistoryMapData) => m.type === mapType)
    const endMapData = endPoint?.maps?.find((m: HistoryMapData) => m.type === mapType)

    if (!startMapData || !endMapData) return null

    return {
      red: {
        kills: endMapData.kills.red - startMapData.kills.red,
        deaths: endMapData.deaths.red - startMapData.deaths.red,
        score: endMapData.scores.red - startMapData.scores.red,
      },
      blue: {
        kills: endMapData.kills.blue - startMapData.kills.blue,
        deaths: endMapData.deaths.blue - startMapData.deaths.blue,
        score: endMapData.scores.blue - startMapData.scores.blue,
      },
      green: {
        kills: endMapData.kills.green - startMapData.kills.green,
        deaths: endMapData.deaths.green - startMapData.deaths.green,
        score: endMapData.scores.green - startMapData.scores.green,
      },
    }
  }, [historyData, match.startDate])

  // Get data for selected skirmish and map
  const getDisplayData = useCallback((): Array<World & { displayScore: number; displayKills?: number; displayDeaths?: number; displayVP?: number }> => {
    // Case 1: Specific map AND specific skirmish
    if (selectedMap !== 'all' && selectedSkirmish !== 'all' && typeof selectedSkirmish === 'number') {
      const mapSkirmishStats = calculateSkirmishMapStats(selectedSkirmish, selectedMap)

      if (!mapSkirmishStats) {
        return match.worlds.map(world => ({ ...world, displayScore: 0 }))
      }

      return match.worlds.map(world => ({
        ...world,
        displayScore: mapSkirmishStats[world.color].score,
        displayKills: mapSkirmishStats[world.color].kills,
        displayDeaths: mapSkirmishStats[world.color].deaths,
        displayVP: undefined,
      }))
    }

    // Case 2: Specific map, all skirmishes (totals for that map)
    if (selectedMap !== 'all') {
      const mapData = maps.find(m => m.type === selectedMap)
      if (!mapData) {
        return match.worlds.map(world => ({ ...world, displayScore: 0 }))
      }

      return match.worlds.map(world => ({
        ...world,
        displayScore: mapData.scores[world.color],
        displayKills: mapData.kills[world.color],
        displayDeaths: mapData.deaths[world.color],
        displayVP: undefined,
      }))
    }

    // Case 3: All maps, specific skirmish
    if (selectedSkirmish !== 'all' && typeof selectedSkirmish === 'number') {
      const skirmish = skirmishes.find(s => s.id === selectedSkirmish)
      const skirmishStats = calculateSkirmishStats(selectedSkirmish)

      if (!skirmish) {
        return match.worlds.map(world => ({ ...world, displayScore: world.score }))
      }

      return match.worlds.map(world => ({
        ...world,
        displayScore: skirmish.scores[world.color] || 0,
        displayKills: skirmishStats?.[world.color].kills,
        displayDeaths: skirmishStats?.[world.color].deaths,
        displayVP: skirmishStats?.[world.color].victoryPoints,
      }))
    }

    // Case 4: All maps, all skirmishes (total match data)
    return match.worlds.map(world => ({
      ...world,
      displayScore: world.score,
      displayKills: world.kills,
      displayDeaths: world.deaths,
      displayVP: world.victoryPoints,
    }))
  }, [selectedMap, selectedSkirmish, match.worlds, skirmishes, maps, calculateSkirmishMapStats, calculateSkirmishStats])

  const displayData = useMemo(() => getDisplayData(), [getDisplayData])

  // Calculate highest values for each stat category for highlighting
  const highestDisplayScore = useMemo(() => Math.max(...displayData.map(w => w.displayScore)), [displayData])
  const highestDisplayVP = useMemo(() => Math.max(...displayData.map(w => w.displayVP ?? 0)), [displayData])
  const highestDisplayKills = useMemo(() => Math.max(...displayData.map(w => w.displayKills ?? 0)), [displayData])
  const highestDisplayDeaths = useMemo(() => Math.max(...displayData.map(w => w.displayDeaths ?? 0)), [displayData])
  const highestDisplayKD = useMemo(() => Math.max(...displayData.map(w => {
    const kills = w.displayKills ?? 0
    const deaths = w.displayDeaths ?? 0
    return deaths > 0 ? kills / deaths : kills
  })), [displayData])
  const highestDisplayActivity = useMemo(() => Math.max(...displayData.map(w => {
    const kills = w.displayKills ?? 0
    const deaths = w.displayDeaths ?? 0
    return kills + deaths
  })), [displayData])

  // Calculate modal data for each team
  const teamModalData = useMemo(() => sortedWorlds.reduce((acc, world, idx) => {
    const pointsBehind = idx > 0 ? highestScore - world.score : 0
    const teamPPT = matchPPT[world.color]
    const pptDifferential = teamPPT.total - leaderPPT
    const teamStatus = getTeamStatus(pointsBehind, pptDifferential)

    const maxAchievableData = calculateMaxAchievablePPT(world.color, detailedObjectives)

    let requiredPPT: number | null = null
    let ticksRemaining = 0
    if ((teamStatus.status === 'falling-behind' || teamStatus.status === 'maintaining-gap') && pointsBehind > 0) {
      const matchStart = new Date(match.startDate)
      const now = new Date()
      const elapsedMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60))
      const skirmishNumber = Math.floor(elapsedMinutes / 120)
      const skirmishStartTime = new Date(matchStart.getTime() + (skirmishNumber * 120 * 60 * 1000))
      const skirmishElapsed = Math.floor((now.getTime() - skirmishStartTime.getTime()) / (1000 * 60))
      const minutesRemaining = Math.max(0, 120 - skirmishElapsed)
      ticksRemaining = Math.ceil(minutesRemaining / 5)

      requiredPPT = calculateRequiredPPTToOvertake(
        pointsBehind,
        teamPPT.total,
        leaderPPT,
        minutesRemaining
      )
    }

    acc[world.color] = {
      teamName: world.name,
      requiredPPT,
      currentPPT: teamPPT.total,
      maxAchievablePPT: maxAchievableData.maxPPT,
      pointsBehind,
      ticksRemaining,
      maxAchievableData,
    }
    return acc
  }, {} as Record<string, any>), [sortedWorlds, highestScore, matchPPT, leaderPPT, detailedObjectives, match.startDate])

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-md brushstroke-button">
          <Link href="/matches">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{match.tier}</h1>
            <Badge variant="outline" className="font-mono inset-card">{match.region}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(match.startDate).toLocaleDateString()} - {new Date(match.endDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SkirmishTimer matchStartDate={match.startDate} />
          <AutoRefresh interval={POLL_INTERVALS_MS.DASHBOARD} />
        </div>
      </div>

      {/* Score Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedWorlds.map((world, idx) => {
          const scorePercentage = (world.score / highestScore) * 100
          const kdRatio = (world.kills / world.deaths).toFixed(2)
          const classes = colorClasses[world.color]
          const frostedClass = world.color === 'red' ? 'frosted-card-red' : world.color === 'blue' ? 'frosted-card-blue' : 'frosted-card-green'
          const pointsBehind = idx > 0 ? highestScore - world.score : 0

          // Get PPT data for this team
          const teamPPT = matchPPT[world.color]
          const pptTrend = getPPTTrend(teamPPT.total, highestPPT)
          const pptDifferential = teamPPT.total - leaderPPT

          // Calculate ticks behind and team status
          const ticksBehind = pointsBehind > 0 ? calculateTicksBehind(pointsBehind, pptDifferential) : null
          const ticksTimeString = ticksBehind !== null ? ticksToTimeString(ticksBehind) : null
          const teamStatus = getTeamStatus(pointsBehind, pptDifferential)

          // Calculate maximum achievable PPT for this team
          const maxAchievableData = calculateMaxAchievablePPT(
            world.color,
            detailedObjectives
          )
          const maxAchievablePPT = maxAchievableData.maxPPT

          // Calculate required PPT to win skirmish and time remaining
          let requiredPPT: number | null = null
          let ticksRemaining = 0
          let ticksNeeded: number | null = null
          if (pointsBehind > 0) {
            // Calculate time remaining in current skirmish
            const matchStart = new Date(match.startDate)
            const now = new Date()
            const elapsedMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60))
            const skirmishNumber = Math.floor(elapsedMinutes / 120) // Each skirmish is 120 minutes
            const skirmishStartTime = new Date(matchStart.getTime() + (skirmishNumber * 120 * 60 * 1000))
            const skirmishElapsed = Math.floor((now.getTime() - skirmishStartTime.getTime()) / (1000 * 60))
            const minutesRemaining = Math.max(0, 120 - skirmishElapsed)
            ticksRemaining = Math.ceil(minutesRemaining / 5) // Ticks are every 5 minutes

            requiredPPT = calculateRequiredPPTToOvertake(
              pointsBehind,
              teamPPT.total,
              leaderPPT,
              minutesRemaining
            )

            // Calculate how many ticks it would take to catch up with required PPT
            if (requiredPPT !== null) {
              const pptGain = requiredPPT - leaderPPT
              if (pptGain > 0) {
                ticksNeeded = Math.ceil(pointsBehind / pptGain)
              }
            }
          }

          return (
            <Card key={world.name} className={`panel-border relative overflow-hidden ${frostedClass}`} style={{ background: 'transparent' }}>
              {idx === 0 && (
                <div className="absolute top-3 right-3" style={{ zIndex: 10 }}>
                  <Trophy className={`h-5 w-5 ${classes.text}`} />
                </div>
              )}
              <div className="p-6 space-y-4" style={{ position: 'relative', zIndex: 1 }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`${classes.text} ${classes.border} font-mono text-xs`}>
                      #{idx + 1}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{world.color.toUpperCase()}</span>
                  </div>
                  <h3 className="font-semibold text-lg leading-tight">{world.name}</h3>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono">{world.score.toLocaleString()}</span>
                      {pointsBehind > 0 && (
                        <span className="text-sm font-mono text-muted-foreground">
                          -{pointsBehind.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${classes.text}`}>{scorePercentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={scorePercentage} className={`h-2 progress-${world.color}`} />

                  {/* PPT Display */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`font-mono text-xs ${classes.text} ${classes.border}`}>
                          {teamPPT.total} PPT
                        </Badge>
                        {pptTrend === 'up' && <span className="text-green-600 dark:text-green-400" title="Highest PPT - gaining ground">↑</span>}
                        {pptTrend === 'down' && <span className="text-red-600 dark:text-red-400" title="Lower PPT - losing ground">↓</span>}
                      </div>
                      {ticksBehind !== null && ticksTimeString && (
                        <span className="text-muted-foreground font-mono" title={`${ticksBehind} ticks behind at current PPT rate`}>
                          {ticksBehind} ticks ({ticksTimeString})
                        </span>
                      )}
                    </div>
                    {pointsBehind > 0 && teamStatus.status !== 'leading' && (
                      <div className="text-xs space-y-0.5">
                        <div className="text-muted-foreground italic">
                          {teamStatus.status === 'catching-up' && '🔼 Catching up'}
                          {teamStatus.status === 'maintaining-gap' && 'Gap maintained'}
                          {teamStatus.status === 'falling-behind' && '🔻 Falling behind'}
                        </div>
                        {/* Show required PPT info for all non-leading teams */}
                        {teamStatus.status === 'catching-up' && ticksBehind !== null && ticksBehind > ticksRemaining && requiredPPT !== null && (
                          <>
                            {/* Catching up but not enough time at current PPT rate */}
                            {requiredPPT > maxAchievablePPT ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>
                                  Can't win skirmish (need <span className="font-mono font-semibold text-red-600 dark:text-red-400">{requiredPPT} PPT</span>, max {maxAchievablePPT})
                                </span>
                                <button
                                  onClick={() => setOpenModalColor(world.color)}
                                  className="inline-flex items-center justify-center hover:bg-accent rounded p-0.5 transition-colors"
                                  title="View detailed breakdown"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>
                                  Need <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">{requiredPPT} PPT</span> to win skirmish
                                </span>
                                <button
                                  onClick={() => setOpenModalColor(world.color)}
                                  className="inline-flex items-center justify-center hover:bg-accent rounded p-0.5 transition-colors"
                                  title="View detailed breakdown"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {(teamStatus.status === 'falling-behind' || teamStatus.status === 'maintaining-gap') && requiredPPT !== null && (
                          <>
                            {/* Check if achievable: must have enough time AND enough objectives available */}
                            {requiredPPT > maxAchievablePPT ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>
                                  Can't win skirmish (need <span className="font-mono font-semibold text-red-600 dark:text-red-400">{requiredPPT} PPT</span>, max {maxAchievablePPT})
                                </span>
                                <button
                                  onClick={() => setOpenModalColor(world.color)}
                                  className="inline-flex items-center justify-center hover:bg-accent rounded p-0.5 transition-colors"
                                  title="View detailed breakdown"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (ticksNeeded !== null && ticksNeeded > ticksRemaining) ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>
                                  Not enough time (need <span className="font-mono font-semibold text-red-600 dark:text-red-400">{requiredPPT} PPT</span>)
                                </span>
                                <button
                                  onClick={() => setOpenModalColor(world.color)}
                                  className="inline-flex items-center justify-center hover:bg-accent rounded p-0.5 transition-colors"
                                  title="View detailed breakdown"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>
                                  Need <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">{requiredPPT} PPT</span> to win skirmish
                                </span>
                                <button
                                  onClick={() => setOpenModalColor(world.color)}
                                  className="inline-flex items-center justify-center hover:bg-accent rounded p-0.5 transition-colors"
                                  title="View detailed breakdown"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Victory Points</div>
                    <div className="text-lg font-bold font-mono">{world.victoryPoints}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">K/D Ratio</div>
                    <div className="text-lg font-bold font-mono">{kdRatio}</div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Match Statistics & Skirmish Performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Match Statistics</h2>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedMap}
                  onChange={(e) => setSelectedMap(e.target.value)}
                  className="text-sm border rounded px-3 py-1.5 bg-background"
                >
                  {mapOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSkirmish}
                  onChange={(e) => setSelectedSkirmish(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="text-sm border rounded px-3 py-1.5 bg-background"
                >
                  {skirmishOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">World</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">VP</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Kills</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Deaths</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">K/D</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((world) => {
                    const classes = colorClasses[world.color]
                    const kills = world.displayKills ?? 0
                    const deaths = world.displayDeaths ?? 0
                    const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)
                    const kdValue = deaths > 0 ? kills / deaths : kills

                    return (
                      <tr key={world.name} className={`border-b border-border/30 ${classes.bg}`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${classes.primary}`}></div>
                            <span className="font-medium">{world.name}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 font-mono font-semibold">
                          <span className={world.displayScore === highestDisplayScore && highestDisplayScore > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}>
                            {world.displayScore.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {historyLoading && (selectedSkirmish !== 'all' || selectedMap !== 'all') ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : world.displayVP !== undefined ? (
                            <span className={world.displayVP === highestDisplayVP && highestDisplayVP > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}>
                              {world.displayVP.toLocaleString()}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {historyLoading && (selectedSkirmish !== 'all' || selectedMap !== 'all') ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : world.displayKills !== undefined ? (
                            <span className={world.displayKills === highestDisplayKills && highestDisplayKills > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}>
                              {world.displayKills.toLocaleString()}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {historyLoading && (selectedSkirmish !== 'all' || selectedMap !== 'all') ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : world.displayDeaths !== undefined ? (
                            <span className={world.displayDeaths === highestDisplayDeaths && highestDisplayDeaths > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}>
                              {world.displayDeaths.toLocaleString()}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {historyLoading && (selectedSkirmish !== 'all' || selectedMap !== 'all') ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : world.displayKills !== undefined && world.displayDeaths !== undefined ? (
                            <span className={kdValue === highestDisplayKD && highestDisplayKD > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}>
                              {kdRatio}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {historyLoading && (selectedSkirmish !== 'all' || selectedMap !== 'all') ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : world.displayKills !== undefined && world.displayDeaths !== undefined ? (
                            <span className={(kills + deaths) === highestDisplayActivity && highestDisplayActivity > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}>
                              {(kills + deaths).toLocaleString()}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
          <div className="p-6">
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Skirmish Performance</h2>
                </div>
                {(() => {
                  const currentSkirmish = skirmishes[skirmishes.length - 1];
                  if (currentSkirmish?.vpTier) {
                    return (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={`text-xs font-mono ${vpTierColors[currentSkirmish.vpTier.tier]}`}>
                          {vpTierLabels[currentSkirmish.vpTier.tier]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {currentSkirmish.vpTier.first}/{currentSkirmish.vpTier.second}/{currentSkirmish.vpTier.third} VP
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="text-xs text-muted-foreground flex gap-4">
                <span>○ Low</span>
                <span>◐ Medium</span>
                <span>◉ High</span>
                <span className={vpTierColors.peak}>⦿ Peak</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {match.worlds.map((world) => {
                const classes = colorClasses[world.color]
                const totalSkirmishes = world.skirmishes.first + world.skirmishes.second + world.skirmishes.third
                const firstPlaceRate = totalSkirmishes > 0 ? ((world.skirmishes.first / totalSkirmishes) * 100).toFixed(0) : '0'

                return (
                  <div key={world.name} className={`rounded-md p-4 border world-card-frosted ${classes.bg} ${classes.border}`}>
                    <div className="mb-3">
                      <div className="font-medium text-sm mb-1">{world.name}</div>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {firstPlaceRate}% 1st place
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">1st Place</span>
                        <span className="font-mono font-semibold text-yellow-700 dark:text-yellow-400">
                          {world.skirmishes.first}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">2nd Place</span>
                        <span className="font-mono font-semibold text-gray-600 dark:text-gray-300">
                          {world.skirmishes.second}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">3rd Place</span>
                        <span className="font-mono font-semibold text-orange-700 dark:text-orange-400">
                          {world.skirmishes.third}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                        <span className="text-muted-foreground">Current Place</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          #{world.skirmishes.current}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Map Performance & Map Objectives */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Swords className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Map Performance</h2>
            </div>

            <div className="space-y-4">
              {maps.map((map) => {
                // Get the world name for this borderland
                let mapName = mapTypeNames[map.type] || map.type
                if (map.type === 'RedHome') {
                  const redWorld = match.worlds.find(w => w.color === 'red')
                  mapName = redWorld ? `${redWorld.name} Borderlands` : mapName
                } else if (map.type === 'BlueHome') {
                  const blueWorld = match.worlds.find(w => w.color === 'blue')
                  mapName = blueWorld ? `${blueWorld.name} Borderlands` : mapName
                } else if (map.type === 'GreenHome') {
                  const greenWorld = match.worlds.find(w => w.color === 'green')
                  mapName = greenWorld ? `${greenWorld.name} Borderlands` : mapName
                }

                // Calculate highest values for this map
                const mapHighestKills = Math.max(...match.worlds.map(w => map.kills[w.color]))
                const mapHighestDeaths = Math.max(...match.worlds.map(w => map.deaths[w.color]))
                const mapHighestKD = Math.max(...match.worlds.map(w => {
                  const k = map.kills[w.color]
                  const d = map.deaths[w.color]
                  return d > 0 ? k / d : k
                }))

                return (
                  <div key={map.type} className="rounded-md p-4 border border-border/50 bg-background/50">
                    <div className="font-medium text-sm mb-3">{mapName}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {match.worlds.map((world) => {
                        const classes = colorClasses[world.color]
                        const kills = map.kills[world.color]
                        const deaths = map.deaths[world.color]
                        const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)
                        const kdValue = deaths > 0 ? kills / deaths : kills

                        return (
                          <div key={world.color} className={`rounded p-2 ${classes.bg} ${classes.border} border`}>
                            <div className="text-xs text-muted-foreground mb-1 truncate" title={world.name}>
                              {world.name}
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Kills</span>
                                <span className={`font-mono ${kills === mapHighestKills && mapHighestKills > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                  {kills.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Deaths</span>
                                <span className={`font-mono ${deaths === mapHighestDeaths && mapHighestDeaths > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                  {deaths.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">K/D</span>
                                <span className={`font-mono font-semibold ${kdValue === mapHighestKD && mapHighestKD > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                  {kdRatio}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <PPTBreakdown
          matchId={matchId}
          ppt={{
            red: matchPPT.red.total,
            blue: matchPPT.blue.total,
            green: matchPPT.green.total,
          }}
          objectives={detailedObjectives}
        />
      </div>

      {/* World Alliances */}
      <WorldAlliances
        worlds={match.worlds.map(w => ({ id: w.id, name: w.name, color: w.color }))}
        guilds={guilds}
      />

      {/* Prime Time Performance */}
      <PrimeTimePerformance
        matchId={matchId}
        worlds={match.worlds.map(w => ({ name: w.name, color: w.color }))}
        primeTimeStats={primeTimeStats}
      />

      {/* Skirmish Win Scenario Modals */}
      {(['red', 'blue', 'green'] as const).map(color => {
        const data = teamModalData[color]
        if (!data) return null

        return (
          <SkirmishWinScenarioModal
            key={color}
            open={openModalColor === color}
            onOpenChange={(open) => setOpenModalColor(open ? color : null)}
            teamColor={color}
            teamName={data.teamName}
            requiredPPT={data.requiredPPT || 0}
            currentPPT={data.currentPPT}
            maxAchievablePPT={data.maxAchievablePPT}
            pointsBehind={data.pointsBehind}
            ticksRemaining={data.ticksRemaining}
            maxAchievableData={data.maxAchievableData}
          />
        )
      })}
    </div>
  )
}
