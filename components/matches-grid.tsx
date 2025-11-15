import { MatchCard } from './match-card'

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

interface MatchesGridProps {
  matches: Match[]
}

export function MatchesGrid({ matches }: MatchesGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {matches.map((match, index) => (
        <MatchCard key={match.tier} match={match} index={index} />
      ))}
    </div>
  )
}
