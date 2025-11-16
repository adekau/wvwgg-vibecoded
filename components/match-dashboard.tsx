"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trophy, Swords, Skull, TrendingUp, Castle, Flag, Tent } from 'lucide-react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'

interface World {
  name: string
  kills: number
  deaths: number
  color: 'red' | 'blue' | 'green'
  score: number
  victoryPoints: number
  skirmishes: { won: number; lost: number; current: number }
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

export function MatchDashboard({ match, matchId }: MatchDashboardProps) {
  const totalScore = match.worlds.reduce((sum, world) => sum + world.score, 0)
  const sortedWorlds = [...match.worlds].sort((a, b) => b.score - a.score)
  
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
      </div>

      {/* Score Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {sortedWorlds.map((world, idx) => {
          const scorePercentage = (world.score / totalScore) * 100
          const kdRatio = (world.kills / world.deaths).toFixed(2)
          const classes = colorClasses[world.color]
          const frostedClass = world.color === 'red' ? 'frosted-card-red' : world.color === 'blue' ? 'frosted-card-blue' : 'frosted-card-green'

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
                    <span className="text-2xl font-bold font-mono">{world.score.toLocaleString()}</span>
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

      {/* Detailed Stats Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Combat Statistics */}
        <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Swords className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Combat Statistics</h2>
            </div>

            <div className="space-y-4">
              {match.worlds.map((world) => {
                const classes = colorClasses[world.color]
                return (
                  <div key={world.name} className={`rounded-md p-4 border ${classes.bg} ${classes.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{world.name}</span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {world.color.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Swords className="h-3.5 w-3.5 opacity-60" />
                          <span className="text-xs text-muted-foreground">Kills</span>
                        </div>
                        <span className="text-lg font-bold font-mono">{world.kills.toLocaleString()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Skull className="h-3.5 w-3.5 opacity-60" />
                          <span className="text-xs text-muted-foreground">Deaths</span>
                        </div>
                        <span className="text-lg font-bold font-mono">{world.deaths.toLocaleString()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="h-3.5 w-3.5 opacity-60" />
                          <span className="text-xs text-muted-foreground">K/D</span>
                        </div>
                        <span className="text-lg font-bold font-mono">
                          {(world.kills / world.deaths).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Objectives Control */}
        <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Castle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Objective Control</h2>
            </div>
            
            <div className="space-y-4">
              {match.worlds.map((world) => {
                const classes = colorClasses[world.color]
                const objectives = match.objectives[world.color]
                const totalObjectives = objectives.keeps + objectives.towers + objectives.camps + objectives.castles
                
                return (
                  <div key={world.name} className={`rounded-md p-4 border ${classes.bg} ${classes.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{world.name}</span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {totalObjectives} total
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center">
                        <Castle className="h-4 w-4 mx-auto mb-1 opacity-60" />
                        <div className="text-xs text-muted-foreground mb-0.5">Castles</div>
                        <div className="text-lg font-bold font-mono">{objectives.castles}</div>
                      </div>
                      <div className="text-center">
                        <Flag className="h-4 w-4 mx-auto mb-1 opacity-60" />
                        <div className="text-xs text-muted-foreground mb-0.5">Keeps</div>
                        <div className="text-lg font-bold font-mono">{objectives.keeps}</div>
                      </div>
                      <div className="text-center">
                        <Castle className="h-4 w-4 mx-auto mb-1 opacity-60" />
                        <div className="text-xs text-muted-foreground mb-0.5">Towers</div>
                        <div className="text-lg font-bold font-mono">{objectives.towers}</div>
                      </div>
                      <div className="text-center">
                        <Tent className="h-4 w-4 mx-auto mb-1 opacity-60" />
                        <div className="text-xs text-muted-foreground mb-0.5">Camps</div>
                        <div className="text-lg font-bold font-mono">{objectives.camps}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Skirmish Performance */}
      <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Skirmish Performance</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            {match.worlds.map((world) => {
              const classes = colorClasses[world.color]
              const totalSkirmishes = world.skirmishes.won + world.skirmishes.lost
              const winRate = ((world.skirmishes.won / totalSkirmishes) * 100).toFixed(0)
              
              return (
                <div key={world.name} className={`rounded-md p-4 border world-card-frosted ${classes.bg} ${classes.border}`}>
                  <div className="mb-3">
                    <div className="font-medium text-sm mb-1">{world.name}</div>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {winRate}% win rate
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Won</span>
                      <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                        {world.skirmishes.won}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lost</span>
                      <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                        {world.skirmishes.lost}
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
  )
}
