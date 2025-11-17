"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  calculatePrimeTimeStats,
  getDominantTeam,
  calculateScoreDistribution,
  type WindowStats,
} from '@/lib/prime-time-stats'
import {
  getAllTimeWindows,
  getLocalizedTimeRange,
  getOffHoursDescription,
  getCurrentActiveWindow,
  type PrimeTimeWindow,
} from '@/lib/prime-time-windows'

interface HistoricalDataPoint {
  timestamp: string | number
  red: { score: number; kills: number; deaths: number; victoryPoints: number }
  blue: { score: number; kills: number; deaths: number; victoryPoints: number }
  green: { score: number; kills: number; deaths: number; victoryPoints: number }
}

interface PrimeTimePerformanceProps {
  matchId: string
  worlds: Array<{
    name: string
    color: 'red' | 'blue' | 'green'
  }>
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

export function PrimeTimePerformance({ matchId, worlds }: PrimeTimePerformanceProps) {
  const [windowStats, setWindowStats] = useState<WindowStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeWindow, setActiveWindow] = useState<PrimeTimeWindow>(getCurrentActiveWindow())

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/history/${matchId}`)
        if (!response.ok) {
          console.error('Failed to fetch match history')
          setLoading(false)
          return
        }

        const responseData = await response.json()
        const data: HistoricalDataPoint[] = responseData.history || []

        console.log('Prime Time Performance - Total history points:', data.length)
        if (data.length > 0) {
          console.log('First timestamp:', data[0].timestamp)
          console.log('Last timestamp:', data[data.length - 1].timestamp)
          console.log('Sample data point:', data[0])
        }

        // Calculate stats for each time window
        const stats = calculatePrimeTimeStats(data)
        console.log('Prime Time Performance - Window stats:', stats)
        setWindowStats(stats)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching match history:', error)
        setLoading(false)
      }
    }

    fetchHistory()

    // Refresh data every 2 minutes to capture new snapshots during active windows
    const refreshInterval = setInterval(() => {
      fetchHistory()
    }, 2 * 60 * 1000) // 2 minutes

    return () => clearInterval(refreshInterval)
  }, [matchId])

  // Update active window every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWindow(getCurrentActiveWindow())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Prime Time Performance</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Loading prime time data...
          </p>
        </div>
      </Card>
    )
  }

  if (windowStats.length === 0) {
    return (
      <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Prime Time Performance</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Prime time data will be available once sufficient historical snapshots are collected.
            Snapshots are captured every 15 minutes.
          </p>
        </div>
      </Card>
    )
  }

  // Calculate score distribution for each team
  const scoreDistributions = {
    red: calculateScoreDistribution(windowStats, 'red'),
    blue: calculateScoreDistribution(windowStats, 'blue'),
    green: calculateScoreDistribution(windowStats, 'green'),
  }

  return (
    <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Prime Time Performance</h2>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          Performance breakdown by coverage window. Shows which teams dominate during specific time periods.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 font-medium">Coverage Window</th>
                {worlds.map((world) => (
                  <th key={world.color} className="text-center py-3 px-2 font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <span className="truncate max-w-[120px]" title={world.name}>
                        {world.name}
                      </span>
                      <span className={`text-xs ${colorClasses[world.color].text}`}>
                        ({world.color})
                      </span>
                    </div>
                  </th>
                ))}
                <th className="text-center py-3 px-2 font-medium">Dominant</th>
              </tr>
            </thead>
            <tbody>
              {windowStats.map((window) => {
                const dominant = getDominantTeam(window)
                const isActive = window.windowId === activeWindow

                return (
                  <tr
                    key={window.windowId}
                    className={`border-b border-border/50 hover:bg-muted/50 ${
                      isActive ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    <td className="py-4 px-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{window.windowName}</span>
                        {(() => {
                          const windowInfo = getAllTimeWindows().find(w => w.id === window.windowId)
                          if (window.windowId === 'off-hours') {
                            // Use special formatting for off-hours to show all periods with line breaks
                            const offHoursDesc = getOffHoursDescription()
                            const timeRanges = offHoursDesc.split(', ')
                            return (
                              <span
                                className="text-xs text-muted-foreground cursor-help"
                                title={windowInfo?.description}
                              >
                                {timeRanges.map((range, idx) => (
                                  <span key={idx}>
                                    {range}
                                    {idx < timeRanges.length - 1 && <br />}
                                  </span>
                                ))}
                              </span>
                            )
                          }
                          const localizedTime = windowInfo ? getLocalizedTimeRange(windowInfo) : ''
                          return (
                            <span
                              className="text-xs text-muted-foreground cursor-help"
                              title={windowInfo?.description}
                            >
                              {localizedTime}
                            </span>
                          )
                        })()}
                        {window.dataPoints > 0 && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {window.duration}h of data
                          </span>
                        )}
                      </div>
                    </td>

                    {worlds.map((world) => {
                      const stats = window[world.color]
                      const distribution = scoreDistributions[world.color][window.windowId]
                      const hasNoData = window.dataPoints === 0 && !isActive

                      return (
                        <td key={world.color} className="py-4 px-2">
                          <div className={`rounded p-2 ${colorClasses[world.color].bg} ${colorClasses[world.color].border} border`}>
                            {hasNoData ? (
                              <div className="text-center text-muted-foreground text-xs">
                                No data
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Score</span>
                                  <span className="font-mono font-semibold">{stats.score.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Kills</span>
                                  <span className="font-mono text-xs">{stats.kills.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Deaths</span>
                                  <span className="font-mono text-xs">{stats.deaths.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Activity</span>
                                  <span className="font-mono text-xs">{(stats.kills + stats.deaths).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">K/D</span>
                                  <span className="font-mono text-xs">{stats.kdRatio}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">VP</span>
                                  <span className="font-mono text-xs">{stats.victoryPoints}</span>
                                </div>
                                {distribution > 0 && (
                                  <div className="text-center pt-1 border-t border-border/30">
                                    <Badge variant="secondary" className="text-xs">
                                      {distribution}% of total
                                    </Badge>
                                  </div>
                                )}
                                {isActive && window.dataPoints === 0 && (
                                  <div className="text-center pt-1 border-t border-border/30">
                                    <span className="text-xs text-muted-foreground italic">
                                      (No data yet)
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}

                    <td className="py-4 px-2 text-center">
                      {dominant ? (
                        <Badge variant="outline" className={`${colorClasses[dominant].text} border-current`}>
                          {worlds.find(w => w.color === dominant)?.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <h3 className="text-sm font-medium mb-3">Key Insights</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {worlds.map((world) => {
              const distribution = scoreDistributions[world.color]
              const topWindow = Object.entries(distribution).sort(([, a], [, b]) => b - a)[0]
              const topWindowName = topWindow
                ? getAllTimeWindows().find(w => w.id === topWindow[0])?.name
                : null

              return (
                <div
                  key={world.color}
                  className={`rounded-md p-3 border ${colorClasses[world.color].bg} ${colorClasses[world.color].border}`}
                >
                  <div className="font-medium text-sm mb-1 truncate" title={world.name}>
                    {world.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {topWindowName && topWindow[1] > 0 ? (
                      <>
                        Strongest during <span className="font-semibold">{topWindowName}</span>
                        <br />
                        ({topWindow[1]}% of total score)
                      </>
                    ) : (
                      'Insufficient data'
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
