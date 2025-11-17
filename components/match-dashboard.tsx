"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trophy, Swords } from 'lucide-react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { ObjectivesDisplay } from '@/components/objectives-display'
import { SkirmishTimer } from '@/components/skirmish-timer'
import { AutoRefresh } from '@/components/auto-refresh'
import { useState, useEffect } from 'react'

interface World {
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
  maps?: MapData[]
  skirmishes?: Skirmish[]
}

interface MatchDashboardProps {
  match: Match
  matchId: string
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

interface HistoryPoint {
  timestamp: string
  red: { score: number; kills: number; deaths: number; victoryPoints: number }
  blue: { score: number; kills: number; deaths: number; victoryPoints: number }
  green: { score: number; kills: number; deaths: number; victoryPoints: number }
}

interface HistoryMapData {
  type: string
  scores: { red: number; blue: number; green: number }
  kills: { red: number; blue: number; green: number }
  deaths: { red: number; blue: number; green: number }
}

export function MatchDashboard({ match, matchId }: MatchDashboardProps) {
  const sortedWorlds = [...match.worlds].sort((a, b) => b.score - a.score)
  const highestScore = sortedWorlds[0]?.score || 1 // Prevent division by zero

  const [selectedSkirmish, setSelectedSkirmish] = useState<number | 'all'>('all')
  const [selectedMap, setSelectedMap] = useState<string>('all')
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([])

  const skirmishes = match.skirmishes || []
  const maps = match.maps || []

  const mapTypeNames: Record<string, string> = {
    'Center': 'Eternal Battlegrounds',
    'RedHome': 'Red Borderlands',
    'BlueHome': 'Blue Borderlands',
    'GreenHome': 'Green Borderlands',
  }

  const mapOptions = [
    { value: 'all', label: 'All Maps' },
    ...maps.map((m) => ({
      value: m.type,
      label: mapTypeNames[m.type] || m.type
    }))
  ]

  // Fetch match history for per-skirmish stats
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/history/${matchId}`)
        if (response.ok) {
          const data = await response.json()
          setHistoryData(data.history || [])
        }
      } catch (error) {
        console.error('Failed to fetch match history:', error)
      }
    }

    fetchHistory()
  }, [matchId])

  // Format skirmish time based on when it occurred
  const formatSkirmishTime = (skirmishId: number) => {
    const matchStart = new Date(match.startDate)
    // Each skirmish is 2 hours, skirmish IDs are 1-indexed
    const skirmishStart = new Date(matchStart.getTime() + ((skirmishId - 1) * 2 * 60 * 60 * 1000))

    return skirmishStart.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const skirmishOptions = [
    { value: 'all', label: 'All Skirmishes (Total)' },
    ...skirmishes
      .slice()
      .reverse()
      .map((s) => ({
        value: s.id,
        label: `#${s.id} ${formatSkirmishTime(s.id)}`
      }))
  ]

  // Calculate per-skirmish stats from history data
  const calculateSkirmishStats = (skirmishId: number) => {
    if (historyData.length === 0) return null

    const matchStart = new Date(match.startDate)
    const skirmishStart = new Date(matchStart.getTime() + ((skirmishId - 1) * 2 * 60 * 60 * 1000))
    const skirmishEnd = new Date(skirmishStart.getTime() + (2 * 60 * 60 * 1000))

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
  }

  // Calculate per-skirmish, per-map stats from history
  const calculateSkirmishMapStats = (skirmishId: number, mapType: string) => {
    if (historyData.length === 0) return null

    const matchStart = new Date(match.startDate)
    const skirmishStart = new Date(matchStart.getTime() + ((skirmishId - 1) * 2 * 60 * 60 * 1000))
    const skirmishEnd = new Date(skirmishStart.getTime() + (2 * 60 * 60 * 1000))

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
    const startMapData = (startPoint as any)?.maps?.find((m: HistoryMapData) => m.type === mapType)
    const endMapData = (endPoint as any)?.maps?.find((m: HistoryMapData) => m.type === mapType)

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
  }

  // Get data for selected skirmish and map
  const getDisplayData = (): Array<World & { displayScore: number; displayKills?: number; displayDeaths?: number; displayVP?: number }> => {
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
  }

  const displayData = getDisplayData()

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
          <AutoRefresh interval={60000} />
        </div>
      </div>

      {/* Score Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {sortedWorlds.map((world, idx) => {
          const scorePercentage = (world.score / highestScore) * 100
          const kdRatio = (world.kills / world.deaths).toFixed(2)
          const classes = colorClasses[world.color]
          const frostedClass = world.color === 'red' ? 'frosted-card-red' : world.color === 'blue' ? 'frosted-card-blue' : 'frosted-card-green'
          const pointsBehind = idx > 0 ? highestScore - world.score : 0

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

      {/* Map Performance & Map Objectives */}
      <div className="grid gap-6 md:grid-cols-2">
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

                return (
                  <div key={map.type} className="rounded-md p-4 border border-border/50 bg-background/50">
                    <div className="font-medium text-sm mb-3">{mapName}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {match.worlds.map((world) => {
                        const classes = colorClasses[world.color]
                        const kills = map.kills[world.color]
                        const deaths = map.deaths[world.color]
                        const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)

                        return (
                          <div key={world.color} className={`rounded p-2 ${classes.bg} ${classes.border} border`}>
                            <div className="text-xs text-muted-foreground mb-1 truncate" title={world.name}>
                              {world.name}
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Kills</span>
                                <span className="font-mono">{kills.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Deaths</span>
                                <span className="font-mono">{deaths.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">K/D</span>
                                <span className="font-mono font-semibold">{kdRatio}</span>
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

        <ObjectivesDisplay
          matchId={matchId}
          worlds={match.worlds.map(w => ({ name: w.name, color: w.color }))}
        />
      </div>

      {/* Match Statistics & Skirmish Performance */}
      <div className="grid gap-6 md:grid-cols-2">
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
                    {selectedSkirmish === 'all' && (
                      <>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">1st</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">2nd</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">3rd</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((world) => {
                    const classes = colorClasses[world.color]
                    const kills = world.displayKills ?? 0
                    const deaths = world.displayDeaths ?? 0
                    const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)

                    return (
                      <tr key={world.name} className={`border-b border-border/30 ${classes.bg}`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${classes.primary}`}></div>
                            <span className="font-medium">{world.name}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 font-mono font-semibold">
                          {world.displayScore.toLocaleString()}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {world.displayVP !== undefined ? world.displayVP.toLocaleString() : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {world.displayKills !== undefined ? world.displayKills.toLocaleString() : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {world.displayDeaths !== undefined ? world.displayDeaths.toLocaleString() : '-'}
                        </td>
                        <td className="text-right py-3 px-2 font-mono">
                          {world.displayKills !== undefined && world.displayDeaths !== undefined ? kdRatio : '-'}
                        </td>
                        {selectedSkirmish === 'all' && (
                          <>
                            <td className="text-right py-3 px-2 font-mono text-yellow-600 dark:text-yellow-400">
                              {world.skirmishes.first}
                            </td>
                            <td className="text-right py-3 px-2 font-mono text-gray-400 dark:text-gray-300">
                              {world.skirmishes.second}
                            </td>
                            <td className="text-right py-3 px-2 font-mono text-orange-600 dark:text-orange-400">
                              {world.skirmishes.third}
                            </td>
                          </>
                        )}
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
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Skirmish Performance</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
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
    </div>
  )
}
