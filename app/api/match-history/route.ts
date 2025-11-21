import { NextRequest, NextResponse } from 'next/server';
import { getMatchHistory, getMatches } from '@/server/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const matchId = searchParams.get('matchId');
    const hoursParam = searchParams.get('hours');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      );
    }

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

    // Add optional time filters
    if (hoursParam) {
      queryOptions.hours = parseInt(hoursParam, 10);
    }
    if (startTime) {
      queryOptions.startTime = startTime;
    }
    if (endTime) {
      queryOptions.endTime = endTime;
    }

    // Query history using the new match-specific index
    const historyData = await getMatchHistory(queryOptions);

    // Filter for this specific match and format
    const matchHistory = historyData
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
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      matchId,
      history: matchHistory,
      dataPoints: matchHistory.length,
      matchStartTime: matchData.start_time,
      matchEndTime: matchData.end_time,
    });
  } catch (error) {
    console.error('Error fetching match history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match history' },
      { status: 500 }
    );
  }
}
