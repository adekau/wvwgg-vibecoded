"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import { useEffect, useState, useMemo, memo } from 'react'
import {
  getDominantTeam,
  calculateScoreDistribution,
  calculateActivityDistribution,
  type WindowStats,
} from '@/lib/prime-time-stats'
import {
  getAllTimeWindows,
  getLocalizedTimeRange,
  getOffHoursDescription,
  getActiveWindows,
  type PrimeTimeWindow,
} from '@/lib/prime-time-windows'
import { POLL_INTERVALS_MS } from '@/lib/game-constants'

interface PrimeTimePerformanceProps {
  matchId: string
  worlds: Array<{
    name: string
    color: 'red' | 'blue' | 'green'
  }>
  primeTimeStats?: WindowStats[] | null // Pre-computed stats from SSR
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

// Memoized to prevent re-renders when parent re-renders with same props
export const PrimeTimePerformance = memo(function PrimeTimePerformance({ matchId, worlds, primeTimeStats }: PrimeTimePerformanceProps) {
  // Use pre-computed stats from SSR (no client-side fetching needed!)
  const [activeWindows, setActiveWindows] = useState<PrimeTimeWindow[]>(getActiveWindows())

  // Window stats are either from SSR or empty array
  const windowStats = primeTimeStats || []

  // Update active windows every 15 minutes (aligns with snapshot frequency)
  // This just highlights which time windows are currently active, doesn't fetch data
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWindows(getActiveWindows())
    }, 15 * 60 * 1000) // 15 minutes

    return () => clearInterval(interval)
  }, [])

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

  // Calculate score distribution for each team (memoized to prevent recalculation on every render)
  const scoreDistributions = useMemo(() => ({
    red: calculateScoreDistribution(windowStats, 'red'),
    blue: calculateScoreDistribution(windowStats, 'blue'),
    green: calculateScoreDistribution(windowStats, 'green'),
  }), [windowStats])

  // Calculate activity distribution for each team (memoized to prevent recalculation on every render)
  const activityDistributions = useMemo(() => ({
    red: calculateActivityDistribution(windowStats, 'red'),
    blue: calculateActivityDistribution(windowStats, 'blue'),
    green: calculateActivityDistribution(windowStats, 'green'),
  }), [windowStats])

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
                const isActive = activeWindows.includes(window.windowId)

                // Calculate highest values for this window
                const windowHighestScore = Math.max(...worlds.map(w => window[w.color].score))
                const windowHighestKills = Math.max(...worlds.map(w => window[w.color].kills))
                const windowHighestDeaths = Math.max(...worlds.map(w => window[w.color].deaths))
                const windowHighestActivity = Math.max(...worlds.map(w => window[w.color].kills + window[w.color].deaths))
                const windowHighestVP = Math.max(...worlds.map(w => window[w.color].victoryPoints))
                const windowHighestKD = Math.max(...worlds.map(w => {
                  const deaths = window[w.color].deaths
                  return deaths > 0 ? window[w.color].kills / deaths : window[w.color].kills
                }))

                return (
                  <tr
                    key={window.windowId}
                    className={`border-b border-border/50 hover:bg-muted/50 ${
                      isActive ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    <td className="py-4 px-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{window.windowName}</span>
                          {isActive && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                              Active
                            </Badge>
                          )}
                        </div>
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
                      const activityDistribution = activityDistributions[world.color][window.windowId]
                      const hasNoData = window.dataPoints === 0 && !isActive
                      const activity = stats.kills + stats.deaths
                      const kdValue = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills

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
                                  <span className={`font-mono font-semibold ${stats.score === windowHighestScore && windowHighestScore > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                    {stats.score.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Kills</span>
                                  <span className={`font-mono text-xs ${stats.kills === windowHighestKills && windowHighestKills > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                    {stats.kills.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Deaths</span>
                                  <span className={`font-mono text-xs ${stats.deaths === windowHighestDeaths && windowHighestDeaths > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                    {stats.deaths.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Activity</span>
                                  <span className={`font-mono text-xs ${activity === windowHighestActivity && windowHighestActivity > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                    {activity.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">K/D</span>
                                  <span className={`font-mono text-xs ${kdValue === windowHighestKD && windowHighestKD > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                    {stats.kdRatio}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">VP</span>
                                  <span className={`font-mono text-xs ${stats.victoryPoints === windowHighestVP && windowHighestVP > 0 ? 'bg-yellow-500/20 px-1.5 py-0.5 rounded' : ''}`}>
                                    {stats.victoryPoints}
                                  </span>
                                </div>
                                {activityDistribution > 0 && (
                                  <div className="text-center pt-1 border-t border-border/30">
                                    <Badge variant="secondary" className="text-xs">
                                      {activityDistribution}% of total activity
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
              const distribution = activityDistributions[world.color]
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
                        Most active during <span className="font-semibold">{topWindowName}</span>
                        <br />
                        ({topWindow[1]}% of total activity)
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
})
