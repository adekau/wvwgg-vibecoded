import { EnhancedMatchCard } from './enhanced-match-card'

interface World {
  name: string
  kills: number
  deaths: number
  color: 'red' | 'blue' | 'green'
  score?: number
  victoryPoints?: number
  ratio?: number
  activity?: number
  population?: string
}

interface Match {
  tier: string
  worlds: World[]
}

interface MatchesGridProps {
  matches: Match[]
}

export function MatchesGrid({ matches }: MatchesGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {matches.map((match) => (
        <EnhancedMatchCard key={match.tier} tier={match.tier} worlds={match.worlds} />
      ))}
    </div>
  )
}
