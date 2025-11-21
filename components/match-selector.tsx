'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Match {
  id: string
  tier: string
  region: string
  worlds: {
    red: string
    blue: string
    green: string
  }
}

interface MatchSelectorProps {
  currentMatchId: string
  matches: Match[]
  className?: string
}

export function MatchSelector({ currentMatchId, matches, className }: MatchSelectorProps) {
  const router = useRouter()

  // Group matches by region
  const matchesByRegion = matches.reduce((acc, match) => {
    if (!acc[match.region]) {
      acc[match.region] = []
    }
    acc[match.region].push(match)
    return acc
  }, {} as Record<string, Match[]>)

  // Sort regions (NA first, then EU)
  const sortedRegions = Object.keys(matchesByRegion).sort((a, b) => {
    if (a === 'North America') return -1
    if (b === 'North America') return 1
    return 0
  })

  // Sort matches within each region by tier
  sortedRegions.forEach((region) => {
    matchesByRegion[region].sort((a, b) => {
      const tierA = parseInt(a.tier)
      const tierB = parseInt(b.tier)
      return tierA - tierB
    })
  })

  const handleMatchChange = (matchId: string) => {
    router.push(`/matches/${matchId}`)
  }

  // Find current match for display
  const currentMatch = matches.find((m) => m.id === currentMatchId)

  return (
    <Select value={currentMatchId} onValueChange={handleMatchChange}>
      <SelectTrigger
        className={cn(
          'w-full md:w-[280px] lg:w-[320px]',
          'bg-card/50 backdrop-blur-md border-border/50',
          'shadow-lg shadow-black/5',
          'hover:bg-card/60 hover:border-border/70',
          'transition-all duration-200',
          'font-medium',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-normal">Match</span>
          <span className="font-semibold">{currentMatch?.id}</span>
          <span className="text-muted-foreground ml-2 hidden sm:inline">
            Tier {currentMatch?.tier}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent
        className={cn(
          'bg-popover border-border',
          'shadow-2xl shadow-black/20',
          'min-w-[280px] lg:min-w-[320px]'
        )}
      >
        {sortedRegions.map((region) => (
          <SelectGroup key={region}>
            <SelectLabel className="text-xs font-semibold uppercase tracking-wider px-3 py-2">
              {region}
            </SelectLabel>
            {matchesByRegion[region].map((match) => (
              <SelectItem
                key={match.id}
                value={match.id}
                className={cn(
                  'cursor-pointer py-2.5 px-3',
                  'hover:bg-accent/80',
                  'transition-colors duration-150',
                  match.id === currentMatchId && 'bg-accent/50'
                )}
              >
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{match.id}</span>
                    <span className="text-xs text-muted-foreground">
                      Tier {match.tier}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span className="text-chart-1">{match.worlds.red}</span>
                    <span className="text-muted-foreground/50">vs</span>
                    <span className="text-chart-2">{match.worlds.blue}</span>
                    <span className="text-muted-foreground/50">vs</span>
                    <span className="text-chart-3">{match.worlds.green}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
