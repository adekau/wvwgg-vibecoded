import { MatchesHeader } from '@/components/matches-header'
import { MatchDashboard } from '@/components/match-dashboard'
import { MatchHistoryChart } from '@/components/match-history-chart'
import { notFound } from 'next/navigation'
import { getMatches, getWorlds } from '@/server/queries'

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params

  // Fetch real data from DynamoDB
  const [matchesData, worldsData] = await Promise.all([
    getMatches(),
    getWorlds(),
  ]);

  if (!matchesData || !worldsData) {
    notFound()
  }

  const matchData = matchesData[matchId] as any

  if (!matchData) {
    notFound()
  }

  // Extract region from match ID (e.g., "1-1" = NA, "2-1" = EU)
  const [regionCode] = matchId.split('-')
  const regionName = regionCode === '1' ? 'North America' : 'Europe'

  // Calculate skirmish stats
  const calculateSkirmishStats = (color: 'red' | 'blue' | 'green') => {
    const scores = {
      red: matchData.red?.skirmishScore || 0,
      blue: matchData.blue?.skirmishScore || 0,
      green: matchData.green?.skirmishScore || 0,
    };

    const currentRank =
      scores.red > scores.blue && scores.red > scores.green ? 'red' :
      scores.blue > scores.green ? 'blue' : 'green';

    return {
      won: 0, // Would need skirmish history
      lost: 0, // Would need skirmish history
      current: currentRank === color ? 1 : (
        currentRank === (color === 'red' ? 'blue' : color === 'blue' ? 'green' : 'red') ? 2 : 3
      ),
    };
  };

  const match = {
    tier: matchId,
    region: regionName,
    startDate: new Date().toISOString(), // Placeholder - not in current data
    endDate: new Date().toISOString(), // Placeholder - not in current data
    worlds: [
      {
        name: matchData.red?.world?.name || 'Unknown',
        kills: matchData.red?.kills || 0,
        deaths: matchData.red?.deaths || 0,
        color: 'red' as const,
        score: matchData.red?.skirmishScore || 0,
        victoryPoints: matchData.red?.victoryPoints || 0,
        skirmishes: calculateSkirmishStats('red'),
      },
      {
        name: matchData.blue?.world?.name || 'Unknown',
        kills: matchData.blue?.kills || 0,
        deaths: matchData.blue?.deaths || 0,
        color: 'blue' as const,
        score: matchData.blue?.skirmishScore || 0,
        victoryPoints: matchData.blue?.victoryPoints || 0,
        skirmishes: calculateSkirmishStats('blue'),
      },
      {
        name: matchData.green?.world?.name || 'Unknown',
        kills: matchData.green?.kills || 0,
        deaths: matchData.green?.deaths || 0,
        color: 'green' as const,
        score: matchData.green?.skirmishScore || 0,
        victoryPoints: matchData.green?.victoryPoints || 0,
        skirmishes: calculateSkirmishStats('green'),
      },
    ],
    // Note: Objectives data not available in current data structure
    objectives: {
      red: { keeps: 0, towers: 0, camps: 0, castles: 0 },
      blue: { keeps: 0, towers: 0, camps: 0, castles: 0 },
      green: { keeps: 0, towers: 0, camps: 0, castles: 0 },
    },
  };

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <MatchDashboard match={match} matchId={matchId} />

        <MatchHistoryChart matchId={matchId} />
      </main>
    </div>
  )
}
