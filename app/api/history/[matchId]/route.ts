import { NextRequest, NextResponse } from 'next/server';
import { getMatchHistory, getMatches } from '@/server/queries';

// Caching is handled by unstable_cache in getMatchHistory (2 minutes)
export const revalidate = 120; // Cache API route for 2 minutes

interface RouteParams {
  params: Promise<{
    matchId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { matchId } = await params;
  const { searchParams } = new URL(request.url);
  const hoursParam = searchParams.get('hours');

  try {
    let history;

    // If hours parameter is provided, use legacy time-based query
    if (hoursParam) {
      const hours = parseInt(hoursParam, 10);
      history = await getMatchHistory({ hours });
    } else {
      // Otherwise, fetch match-specific history from match start to now
      const matchesData = await getMatches();
      const matchData = matchesData?.[matchId];

      if (!matchData?.start_time) {
        // Fallback to 24 hours if we can't find match start time
        console.warn(`[HISTORY API] Could not find start_time for match ${matchId}, falling back to 24h`);
        history = await getMatchHistory({ hours: 24 });
      } else {
        // Query from match start time to now
        history = await getMatchHistory({
          matchId,
          matchStartTime: matchData.start_time,
        });
      }
    }

    // Extract data for specific match
    const matchHistory = history
      .map((snapshot) => {
        // Type guard: data should be decompressed by now, but check to be safe
        if (typeof snapshot.data === 'string') {
          console.error('Snapshot data is still compressed');
          return null;
        }
        const matchData = snapshot.data[matchId];
        if (!matchData) return null;

        return {
          timestamp: snapshot.timestamp,
          red: {
            score: matchData.red?.totalScore || 0,
            kills: matchData.red?.kills || 0,
            deaths: matchData.red?.deaths || 0,
            victoryPoints: matchData.red?.victoryPoints || 0,
          },
          blue: {
            score: matchData.blue?.totalScore || 0,
            kills: matchData.blue?.kills || 0,
            deaths: matchData.blue?.deaths || 0,
            victoryPoints: matchData.blue?.victoryPoints || 0,
          },
          green: {
            score: matchData.green?.totalScore || 0,
            kills: matchData.green?.kills || 0,
            deaths: matchData.green?.deaths || 0,
            victoryPoints: matchData.green?.victoryPoints || 0,
          },
          maps: matchData.maps || [],
        };
      })
      .filter(Boolean);

    return NextResponse.json({ history: matchHistory });
  } catch (error) {
    console.error('Error fetching match history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
