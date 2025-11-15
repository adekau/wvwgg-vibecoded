import { MatchesHeader } from '@/components/matches-header'
import { MatchDashboard } from '@/components/match-dashboard'
import { notFound } from 'next/navigation'

// Mock data - replace with your actual data fetching
const mockMatches: Record<string, any> = {
  'na-1': {
    tier: 'NA-1',
    region: 'North America',
    startDate: '2025-01-10',
    endDate: '2025-01-17',
    worlds: [
      { 
        name: 'Ruined Cathedral of Blood', 
        kills: 27908, 
        deaths: 38418, 
        color: 'red',
        score: 245678,
        victoryPoints: 42,
        skirmishes: { won: 12, lost: 9, current: 2 }
      },
      { 
        name: 'Lutgardis Conservatory', 
        kills: 52599, 
        deaths: 36721, 
        color: 'blue',
        score: 312456,
        victoryPoints: 56,
        skirmishes: { won: 15, lost: 6, current: 1 }
      },
      { 
        name: "Dwayna's Temple", 
        kills: 29069, 
        deaths: 37052, 
        color: 'green',
        score: 198234,
        victoryPoints: 38,
        skirmishes: { won: 8, lost: 13, current: 3 }
      },
    ],
    objectives: {
      red: { keeps: 4, towers: 8, camps: 12, castles: 1 },
      blue: { keeps: 6, towers: 12, camps: 15, castles: 2 },
      green: { keeps: 2, towers: 5, camps: 8, castles: 0 },
    }
  },
  'na-2': {
    tier: 'NA-2',
    region: 'North America',
    startDate: '2025-01-10',
    endDate: '2025-01-17',
    worlds: [
      { 
        name: 'Moogooloo', 
        kills: 44646, 
        deaths: 40240, 
        color: 'red',
        score: 278901,
        victoryPoints: 48,
        skirmishes: { won: 14, lost: 7, current: 2 }
      },
      { 
        name: 'Tombs of Drascir', 
        kills: 25657, 
        deaths: 38383, 
        color: 'blue',
        score: 189432,
        victoryPoints: 35,
        skirmishes: { won: 7, lost: 14, current: 3 }
      },
      { 
        name: 'Yohlon Haven', 
        kills: 44304, 
        deaths: 39170, 
        color: 'green',
        score: 265789,
        victoryPoints: 46,
        skirmishes: { won: 13, lost: 8, current: 1 }
      },
    ],
    objectives: {
      red: { keeps: 5, towers: 10, camps: 13, castles: 1 },
      blue: { keeps: 3, towers: 6, camps: 9, castles: 0 },
      green: { keeps: 4, towers: 9, camps: 13, castles: 2 },
    }
  },
}

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params
  const match = mockMatches[matchId]
  
  if (!match) {
    notFound()
  }
  
  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8">
        <MatchDashboard match={match} matchId={matchId} />
      </main>
    </div>
  )
}
