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
    const skirmishes = matchData.skirmishes || [];

    if (skirmishes.length === 0) {
      return { first: 0, second: 0, third: 0, current: 0 };
    }

    let first = 0;
    let second = 0;
    let third = 0;

    // Count 1st, 2nd, 3rd place finishes for each completed skirmish
    for (const skirmish of skirmishes) {
      const scores = skirmish.scores;

      // Sort colors by score to determine placement
      const rankings = [
        { color: 'red', score: scores.red },
        { color: 'blue', score: scores.blue },
        { color: 'green', score: scores.green }
      ].sort((a, b) => b.score - a.score);

      const placement = rankings.findIndex(r => r.color === color) + 1;

      if (placement === 1) {
        first++;
      } else if (placement === 2) {
        second++;
      } else if (placement === 3) {
        third++;
      }
    }

    // Calculate current placement based on the most recent skirmish
    const currentSkirmish = skirmishes[skirmishes.length - 1];
    const currentScores = currentSkirmish.scores;

    // Sort colors by score to determine placement
    const rankings = [
      { color: 'red', score: currentScores.red },
      { color: 'blue', score: currentScores.blue },
      { color: 'green', score: currentScores.green }
    ].sort((a, b) => b.score - a.score);

    const currentPlacement = rankings.findIndex(r => r.color === color) + 1;

    return {
      first,
      second,
      third,
      current: currentPlacement,
    };
  };

  const match = {
    tier: matchId,
    region: regionName,
    startDate: matchData.start_time || new Date().toISOString(),
    endDate: matchData.end_time || new Date().toISOString(),
    maps: matchData.maps || [],
    skirmishes: matchData.skirmishes || [],
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
