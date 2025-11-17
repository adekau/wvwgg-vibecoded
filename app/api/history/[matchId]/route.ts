import { NextRequest, NextResponse } from 'next/server';
import { getMatchHistory } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

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
  const hours = parseInt(searchParams.get('hours') || '24', 10);

  try {
    const history = await getMatchHistory(hours);

    // Extract data for specific match
    const matchHistory = history
      .map((snapshot) => {
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
