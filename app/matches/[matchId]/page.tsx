import { MatchesHeader } from '@/components/matches-header'
import { MatchDashboard } from '@/components/match-dashboard'
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

  const matchData = matchesData[matchId]

  if (!matchData) {
    notFound()
  }

  // Transform data for display
  const regionName = matchData.region === 'NA' ? 'North America' : 'Europe'

  // Group worlds by color
  const worldsByColor = matchData.all_worlds.reduce((acc, world) => {
    if (!acc[world.color]) {
      acc[world.color] = [];
    }
    acc[world.color].push(world);
    return acc;
  }, {} as Record<string, typeof matchData.all_worlds>);

  // Get primary world for each color (first in the list)
  const redWorlds = worldsByColor.red || [];
  const blueWorlds = worldsByColor.blue || [];
  const greenWorlds = worldsByColor.green || [];

  // Find world names
  const getWorldName = (worldId: number) => {
    const world = worldsData.find((w) => w.id === worldId);
    return world?.name || `World ${worldId}`;
  };

  // Calculate skirmish stats from skirmishes array
  const calculateSkirmishStats = (color: 'red' | 'blue' | 'green') => {
    if (!matchData.skirmish) {
      return { won: 0, lost: 0, current: 0 };
    }

    // For now, use placeholder logic - you can enhance this with actual skirmish history
    const currentRank =
      matchData.scores.red > matchData.scores.blue && matchData.scores.red > matchData.scores.green ? 'red' :
      matchData.scores.blue > matchData.scores.green ? 'blue' : 'green';

    return {
      won: 0, // Would need skirmish history
      lost: 0, // Would need skirmish history
      current: currentRank === color ? 1 : (
        currentRank === (color === 'red' ? 'blue' : color === 'blue' ? 'green' : 'red') ? 2 : 3
      ),
    };
  };

  const match = {
    tier: `${matchData.region}-${matchData.tier}`,
    region: regionName,
    startDate: matchData.start_time,
    endDate: matchData.end_time,
    worlds: [
      ...(redWorlds.length > 0 ? [{
        name: getWorldName(redWorlds[0].id),
        kills: redWorlds[0].kills,
        deaths: redWorlds[0].deaths,
        color: 'red' as const,
        score: matchData.scores.red,
        victoryPoints: redWorlds[0].victory_points,
        skirmishes: calculateSkirmishStats('red'),
      }] : []),
      ...(blueWorlds.length > 0 ? [{
        name: getWorldName(blueWorlds[0].id),
        kills: blueWorlds[0].kills,
        deaths: blueWorlds[0].deaths,
        color: 'blue' as const,
        score: matchData.scores.blue,
        victoryPoints: blueWorlds[0].victory_points,
        skirmishes: calculateSkirmishStats('blue'),
      }] : []),
      ...(greenWorlds.length > 0 ? [{
        name: getWorldName(greenWorlds[0].id),
        kills: greenWorlds[0].kills,
        deaths: greenWorlds[0].deaths,
        color: 'green' as const,
        score: matchData.scores.green,
        victoryPoints: greenWorlds[0].victory_points,
        skirmishes: calculateSkirmishStats('green'),
      }] : []),
    ],
    // Note: Objectives data not available in basic match endpoint
    // Would need additional API calls to get current map objectives
    objectives: {
      red: { keeps: 0, towers: 0, camps: 0, castles: 0 },
      blue: { keeps: 0, towers: 0, camps: 0, castles: 0 },
      green: { keeps: 0, towers: 0, camps: 0, castles: 0 },
    },
  };

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8">
        <MatchDashboard match={match} matchId={matchId} />
      </main>
    </div>
  )
}
