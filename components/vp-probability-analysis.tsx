"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Sparkles, TrendingUp, AlertTriangle, Info, RefreshCcw } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { getRegionFromMatchId } from '@/lib/vp-tiers'
import { TOTAL_SKIRMISHES_PER_MATCH } from '@/lib/game-constants'
import {
  analyzeHistoricalPerformance,
  convertMatchSkirmishesToResults,
  calculateRequiredPerformance,
  type TeamHistoricalStats,
} from '@/lib/historical-performance'
import {
  runMonteCarloSimulation,
  calculateRiskAssessment,
  type MonteCarloResult,
  type SkirmishInfo,
} from '@/lib/monte-carlo-simulator'

interface VPProbabilityAnalysisProps {
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
      scores: { red: number; blue: number; green: number }
      vpTier?: {
        first: number
        second: number
        third: number
        tier: 'low' | 'medium' | 'high' | 'peak'
      }
    }>
  }
  remainingSkirmishes: SkirmishInfo[]
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

const riskColors = {
  'very-low': 'text-green-600 dark:text-green-400',
  'low': 'text-green-500 dark:text-green-500',
  'moderate': 'text-yellow-600 dark:text-yellow-400',
  'high': 'text-orange-600 dark:text-orange-400',
  'very-high': 'text-red-600 dark:text-red-400',
}

export function VPProbabilityAnalysis({ matchId, match, remainingSkirmishes }: VPProbabilityAnalysisProps) {
  const [isCalculating, setIsCalculating] = useState(false)
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null)
  const [historicalStats, setHistoricalStats] = useState<{
    red: TeamHistoricalStats
    blue: TeamHistoricalStats
    green: TeamHistoricalStats
  } | null>(null)
  const [iterations, setIterations] = useState(10000)

  const currentVP = useMemo(() => ({
    red: match.worlds.find(w => w.color === 'red')?.victoryPoints || 0,
    blue: match.worlds.find(w => w.color === 'blue')?.victoryPoints || 0,
    green: match.worlds.find(w => w.color === 'green')?.victoryPoints || 0,
  }), [match.worlds])

  const region = getRegionFromMatchId(matchId)

  // Calculate historical stats from completed skirmishes
  useEffect(() => {
    if (!match.skirmishes || match.skirmishes.length === 0) {
      setHistoricalStats(null)
      return
    }

    const skirmishResults = convertMatchSkirmishesToResults(
      match.skirmishes,
      new Date(match.startDate),
      region
    )

    const stats = {
      red: analyzeHistoricalPerformance(
        skirmishResults,
        'red',
        match.worlds.find(w => w.color === 'red')?.name || 'Red',
        region
      ),
      blue: analyzeHistoricalPerformance(
        skirmishResults,
        'blue',
        match.worlds.find(w => w.color === 'blue')?.name || 'Blue',
        region
      ),
      green: analyzeHistoricalPerformance(
        skirmishResults,
        'green',
        match.worlds.find(w => w.color === 'green')?.name || 'Green',
        region
      ),
    }

    setHistoricalStats(stats)
  }, [match.skirmishes, match.worlds, match.startDate, region])

  const handleRunSimulation = async () => {
    if (!historicalStats || remainingSkirmishes.length === 0) return

    setIsCalculating(true)
    try {
      // Run in a setTimeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = runMonteCarloSimulation(
        currentVP,
        remainingSkirmishes,
        historicalStats,
        region,
        iterations
      )

      setMonteCarloResult(result)
    } finally {
      setIsCalculating(false)
    }
  }

  if (!historicalStats || match.skirmishes?.length === 0) {
    return (
      <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Probability Analysis</h2>
            <Badge variant="outline" className="ml-auto">Beta</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Not enough historical data yet. Complete a few skirmishes to see probability predictions.
          </div>
        </div>
      </Card>
    )
  }

  if (remainingSkirmishes.length === 0) {
    return (
      <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Probability Analysis</h2>
            <Badge variant="outline" className="ml-auto">Beta</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            No remaining skirmishes in this match. The final standings are determined.
          </div>
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
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Probability Analysis</h2>
            <Badge variant="outline">Beta</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value))}
              className="text-xs border rounded px-2 py-1 bg-background"
              disabled={isCalculating}
            >
              <option value={1000}>1,000 simulations</option>
              <option value={10000}>10,000 simulations</option>
              <option value={50000}>50,000 simulations</option>
              <option value={100000}>100,000 simulations</option>
            </select>
            <Button
              onClick={handleRunSimulation}
              disabled={isCalculating}
              size="sm"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
              {isCalculating ? 'Running...' : 'Run Simulation'}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-6">
          Monte Carlo simulation using historical performance data to predict probable outcomes.
          Based on {match.skirmishes?.length || 0} completed skirmishes.
        </div>

        {/* Historical Performance Summary */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Historical Win Rates</h3>
          <div className="grid grid-cols-3 gap-3">
            {(['red', 'blue', 'green'] as const).map(color => {
              const stats = historicalStats[color]
              const world = match.worlds.find(w => w.color === color)

              return (
                <div
                  key={color}
                  className={`rounded-md p-3 border ${colorClasses[color].bg} ${colorClasses[color].border}`}
                >
                  <div className="font-medium text-sm truncate mb-2" title={world?.name}>
                    {world?.name}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">1st</div>
                      <div className="font-bold">{(stats.placementProbability.first * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">2nd</div>
                      <div className="font-bold">{(stats.placementProbability.second * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">3rd</div>
                      <div className="font-bold">{(stats.placementProbability.third * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monte Carlo Results */}
        {monteCarloResult && (
          <div className="space-y-6">
            {/* Most Likely Outcome */}
            <div className="rounded-lg p-4 border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Most Likely Outcome</h3>
                <Badge variant="outline" className="ml-auto">
                  {(monteCarloResult.mostLikelyProbability * 100).toFixed(1)}% probability
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { place: '1st', color: monteCarloResult.mostLikelyOutcome.first },
                  { place: '2nd', color: monteCarloResult.mostLikelyOutcome.second },
                  { place: '3rd', color: monteCarloResult.mostLikelyOutcome.third },
                ].map(({ place, color }) => {
                  const world = match.worlds.find(w => w.color === color)
                  const vp = monteCarloResult.averageFinalVP[color]

                  return (
                    <div
                      key={place}
                      className={`rounded p-2 text-center ${colorClasses[color].bg} border ${colorClasses[color].border}`}
                    >
                      <div className="text-xs text-muted-foreground">{place} Place</div>
                      <div className="text-sm font-medium truncate" title={world?.name}>
                        {world?.name}
                      </div>
                      <div className="text-xs font-mono mt-1">
                        ~{Math.round(vp)} VP
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Team Position Probabilities */}
            <div>
              <h3 className="text-sm font-medium mb-3">Probability to Finish In Each Position</h3>
              <div className="space-y-3">
                {(['red', 'blue', 'green'] as const).map(color => {
                  const world = match.worlds.find(w => w.color === color)
                  const probs = monteCarloResult.teamPositionProbabilities[color]

                  return (
                    <div key={color} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${colorClasses[color].text}`}>
                          {world?.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">1st</span>
                            <span className="font-medium">{(probs.first * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={probs.first * 100} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">2nd</span>
                            <span className="font-medium">{(probs.second * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={probs.second * 100} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">3rd</span>
                            <span className="font-medium">{(probs.third * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={probs.third * 100} className="h-2" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* VP Confidence Intervals */}
            <div>
              <h3 className="text-sm font-medium mb-3">Final VP Projections (Confidence Intervals)</h3>
              <div className="space-y-3">
                {(['red', 'blue', 'green'] as const).map(color => {
                  const world = match.worlds.find(w => w.color === color)
                  const ci = monteCarloResult.vpConfidenceIntervals[color]

                  return (
                    <div key={color} className={`rounded-md p-3 border ${colorClasses[color].bg} ${colorClasses[color].border}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{world?.name}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">10th %ile</div>
                          <div className="font-mono font-bold">{Math.round(ci.p10)} VP</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Median</div>
                          <div className="font-mono font-bold">{Math.round(ci.p50)} VP</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">90th %ile</div>
                          <div className="font-mono font-bold">{Math.round(ci.p90)} VP</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        80% of outcomes fall between {Math.round(ci.p10)} and {Math.round(ci.p90)} VP
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Possible Outcomes */}
            <div>
              <h3 className="text-sm font-medium mb-3">Top 5 Possible Outcomes</h3>
              <div className="space-y-2">
                {monteCarloResult.outcomeProbabilities.slice(0, 5).map((outcome, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-muted-foreground">#{index + 1}</div>
                      <div className="flex items-center gap-2 text-sm">
                        {[
                          { place: '1st', color: outcome.outcome.first },
                          { place: '2nd', color: outcome.outcome.second },
                          { place: '3rd', color: outcome.outcome.third },
                        ].map(({ place, color }, i) => {
                          const world = match.worlds.find(w => w.color === color)
                          return (
                            <div key={i} className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs">{place}:</span>
                              <span className={`font-medium ${colorClasses[color].text}`}>
                                {world?.name}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {(outcome.probability * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulation Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>
                Based on {monteCarloResult.iterations.toLocaleString()} simulations using historical performance data
              </span>
            </div>
          </div>
        )}

        {!monteCarloResult && !isCalculating && (
          <div className="text-center p-8 border border-dashed border-border rounded-lg">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <div className="text-sm text-muted-foreground mb-4">
              Click "Run Simulation" to see probability predictions
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
