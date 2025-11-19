import { NextRequest, NextResponse } from 'next/server';
import { getMatchHistory, getMatches } from '@/server/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const matchId = searchParams.get('matchId');
    const hoursParam = searchParams.get('hours');

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      );
    }

    let historyData;

    // If hours parameter is provided, use legacy time-based query
    if (hoursParam) {
      const hours = parseInt(hoursParam, 10);
      historyData = await getMatchHistory({ hours });
    } else {
      // Otherwise, fetch match-specific history from match start to now
      const matchesData = await getMatches();
      const matchData = matchesData?.[matchId];

      if (!matchData?.start_time) {
        // Fallback to 24 hours if we can't find match start time
        console.warn(`[HISTORY API] Could not find start_time for match ${matchId}, falling back to 24h`);
        historyData = await getMatchHistory({ hours: 24 });
      } else {
        // Query from match start time to now
        historyData = await getMatchHistory({
          matchId,
          matchStartTime: matchData.start_time,
        });
      }
    }

    // Filter for this specific match and format
    const matchHistory = historyData
      .map((snapshot) => {
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
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      matchId,
      history: matchHistory,
      dataPoints: matchHistory.length,
    });
  } catch (error) {
    console.error('Error fetching match history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match history' },
      { status: 500 }
    );
  }
}
