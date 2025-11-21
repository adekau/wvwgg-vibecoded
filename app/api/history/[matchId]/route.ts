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
    // Get match data to determine start time
    const matchesData = await getMatches();
    const matchData = matchesData?.[matchId];

    if (!matchData?.start_time) {
      console.warn(`[HISTORY API] Could not find start_time for match ${matchId}`);
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Build query options
    const queryOptions: any = {
      matchId,
      matchStartTime: matchData.start_time,
    };

    // Add optional time filter
    if (hoursParam) {
      queryOptions.hours = parseInt(hoursParam, 10);
    }

    // Query history using the new match-specific index
    const history = await getMatchHistory(queryOptions);

    // Extract data for specific match
    const matchHistory = history
      .map((snapshot) => {
        // Type guard: data should be decompressed by now, but check to be safe
        if (typeof snapshot.data === 'string') {
          console.error('Snapshot data is still compressed');
          return null;
        }
        const matchDataSnapshot = snapshot.data[matchId];
        if (!matchDataSnapshot) return null;

        return {
          timestamp: snapshot.timestamp,
          red: {
            score: matchDataSnapshot.red?.totalScore || 0,
            kills: matchDataSnapshot.red?.kills || 0,
            deaths: matchDataSnapshot.red?.deaths || 0,
            victoryPoints: matchDataSnapshot.red?.victoryPoints || 0,
          },
          blue: {
            score: matchDataSnapshot.blue?.totalScore || 0,
            kills: matchDataSnapshot.blue?.kills || 0,
            deaths: matchDataSnapshot.blue?.deaths || 0,
            victoryPoints: matchDataSnapshot.blue?.victoryPoints || 0,
          },
          green: {
            score: matchDataSnapshot.green?.totalScore || 0,
            kills: matchDataSnapshot.green?.kills || 0,
            deaths: matchDataSnapshot.green?.deaths || 0,
            victoryPoints: matchDataSnapshot.green?.victoryPoints || 0,
          },
          maps: matchDataSnapshot.maps || [],
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
