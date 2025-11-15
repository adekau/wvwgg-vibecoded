"use client"

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowUpRight, Swords, Skull } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface World {
  name: string
  kills: number
  deaths: number
  color: 'red' | 'blue' | 'green'
}

interface Match {
  tier: string
  worlds: World[]
}

interface MatchCardProps {
  match: Match
  index: number
}

const colorClasses = {
  red: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  blue: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  green: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
}

export function MatchCard({ match, index }: MatchCardProps) {
  const totalActivity = match.worlds.reduce((sum, world) => sum + world.kills + world.deaths, 0)
  
  return (
    <Link 
      href={`/matches/${match.tier.toLowerCase()}`}
      className="block"
      style={{ viewTransitionName: `match-${match.tier}` }}
    >
      <Card className="panel-border inset-card overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] relative" style={{ animationDelay: `${index * 0.1}s` }}>
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono font-semibold">
                {match.tier}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {totalActivity.toLocaleString()} total
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md brushstroke-button">
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Worlds */}
          <div className="space-y-3">
            {match.worlds.map((world) => {
              const kdRatio = (world.kills / world.deaths).toFixed(2)
              const activity = world.kills + world.deaths
              
              return (
                <div
                  key={world.name}
                  className={`rounded-md p-3 border transition-all hover:scale-[1.02] ${colorClasses[world.color]}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm leading-tight line-clamp-1 min-w-0 flex-1">
                      {world.name}
                    </h3>
                    <Badge variant="secondary" className="shrink-0 text-xs font-mono">
                      {kdRatio}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                    <div className="flex items-center gap-1">
                      <Swords className="h-3 w-3 opacity-60" />
                      <span className="font-mono">{world.kills.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Skull className="h-3 w-3 opacity-60" />
                      <span className="font-mono">{world.deaths.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <span className="opacity-60">Act:</span>
                      <span className="font-mono">{activity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </Link>
  )
}
