import { MatchesHeader } from '@/components/matches-header'
import { MatchSubNav } from '@/components/match-sub-nav'
import { MatchDashboard } from '@/components/match-dashboard'
import { MatchHistoryChart } from '@/components/match-history-chart'
import { MatchSelector } from '@/components/match-selector'
import { notFound } from 'next/navigation'
import { getMatches, getWorlds, getGuilds, getPrimeTimeStats } from '@/server/queries'

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params

  // Fetch real data from DynamoDB (minimal server-side data)
  const [matchesData, worldsData, guildsData, primeTimeStats] = await Promise.all([
    getMatches(),
    getWorlds(),
    getGuilds(),
    getPrimeTimeStats(matchId),
  ]);

  if (!matchesData || !worldsData) {
    notFound()
  }

  const matchData = matchesData[matchId] as any

  if (!matchData) {
    notFound()
  }

  // PPT is now calculated in the Lambda and stored in DynamoDB
  // Extract it from the match data
  const actualPPT = {
    red: matchData.red?.ppt || 0,
    blue: matchData.blue?.ppt || 0,
    green: matchData.green?.ppt || 0,
  };

  // For objectives display, we still need to fetch from API
  // (Lambda doesn't store objective counts by type)
  let objectives = {
    red: { keeps: 0, towers: 0, camps: 0, castles: 0 },
    blue: { keeps: 0, towers: 0, camps: 0, castles: 0 },
    green: { keeps: 0, towers: 0, camps: 0, castles: 0 },
  };
  let detailedObjectives: any[] = [];

  try {
    const objectivesResponse = await fetch(
      `https://api.guildwars2.com/v2/wvw/matches?id=${matchId}`,
      { next: { revalidate: 30 } }
    );

    if (objectivesResponse.ok) {
      const matchDataFromAPI = await objectivesResponse.json();

      // Store detailed objectives for PPT breakdown
      if (matchDataFromAPI.maps && Array.isArray(matchDataFromAPI.maps)) {
        detailedObjectives = matchDataFromAPI.maps.flatMap((map: any) => map.objectives || []);
      }

      // Count objectives by type for display
      if (matchDataFromAPI.maps && Array.isArray(matchDataFromAPI.maps)) {
        for (const map of matchDataFromAPI.maps) {
          if (map.objectives && Array.isArray(map.objectives)) {
            for (const obj of map.objectives) {
              const owner = obj.owner?.toLowerCase();
              if (!owner || !['red', 'blue', 'green'].includes(owner)) continue;

              const color = owner as 'red' | 'blue' | 'green';

              // Count objectives by type
              switch (obj.type) {
                case 'Keep':
                  objectives[color].keeps++;
                  break;
                case 'Tower':
                  objectives[color].towers++;
                  break;
                case 'Camp':
                  objectives[color].camps++;
                  break;
                case 'Castle':
                  objectives[color].castles++;
                  break;
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch objectives:', error);
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

  // Match history is now fetched client-side to avoid SSR payload issues

  // Format all matches for the selector
  const allMatches = Object.entries(matchesData).map(([id, data]: [string, any]) => {
    const [regionCode, tier] = id.split('-')
    return {
      id,
      tier,
      region: regionCode === '1' ? 'North America' : 'Europe',
      worlds: {
        red: data.red?.world?.name || 'Unknown',
        blue: data.blue?.world?.name || 'Unknown',
        green: data.green?.world?.name || 'Unknown',
      },
    }
  })

  const match = {
    tier: matchId,
    region: regionName,
    startDate: matchData.start_time || new Date().toISOString(),
    endDate: matchData.end_time || new Date().toISOString(),
    maps: matchData.maps || [],
    skirmishes: matchData.skirmishes || [],
    worlds: [
      {
        id: matchData.red?.world?.id || 0,
        name: matchData.red?.world?.name || 'Unknown',
        kills: matchData.red?.kills || 0,
        deaths: matchData.red?.deaths || 0,
        color: 'red' as const,
        score: matchData.red?.skirmishScore || 0,
        victoryPoints: matchData.red?.victoryPoints || 0,
        skirmishes: calculateSkirmishStats('red'),
      },
      {
        id: matchData.blue?.world?.id || 0,
        name: matchData.blue?.world?.name || 'Unknown',
        kills: matchData.blue?.kills || 0,
        deaths: matchData.blue?.deaths || 0,
        color: 'blue' as const,
        score: matchData.blue?.skirmishScore || 0,
        victoryPoints: matchData.blue?.victoryPoints || 0,
        skirmishes: calculateSkirmishStats('blue'),
      },
      {
        id: matchData.green?.world?.id || 0,
        name: matchData.green?.world?.name || 'Unknown',
        kills: matchData.green?.kills || 0,
        deaths: matchData.green?.deaths || 0,
        color: 'green' as const,
        score: matchData.green?.skirmishScore || 0,
        victoryPoints: matchData.green?.victoryPoints || 0,
        skirmishes: calculateSkirmishStats('green'),
      },
    ],
    objectives,
    actualPPT, // PPT from API with tier upgrades included
  };

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      {/* Match selector with frosted glass effect */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <MatchSelector currentMatchId={matchId} matches={allMatches} />
        </div>
      </div>

      <MatchSubNav matchId={matchId} currentTab="overview" />

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
        <MatchDashboard
          match={match}
          matchId={matchId}
          guilds={guildsData}
          detailedObjectives={detailedObjectives}
          primeTimeStats={primeTimeStats}
        />

        <MatchHistoryChart matchId={matchId} />
      </main>
    </div>
  )
}
