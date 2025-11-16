import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 30; // Cache for 30 seconds

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

  try {
    // Fetch detailed match data from GW2 API
    const response = await fetch(
      `https://api.guildwars2.com/v2/wvw/matches?id=${matchId}`,
      { next: { revalidate: 30 } }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch match data' },
        { status: response.status }
      );
    }

    const matchData = await response.json();

    // Extract objectives from each map
    const objectives = {
      red: { keeps: 0, towers: 0, camps: 0, castles: 0 },
      blue: { keeps: 0, towers: 0, camps: 0, castles: 0 },
      green: { keeps: 0, towers: 0, camps: 0, castles: 0 },
    };

    // Count objectives across all maps
    if (matchData.maps && Array.isArray(matchData.maps)) {
      for (const map of matchData.maps) {
        if (map.objectives && Array.isArray(map.objectives)) {
          for (const obj of map.objectives) {
            const owner = obj.owner?.toLowerCase();
            if (!owner || !['red', 'blue', 'green'].includes(owner)) continue;

            const color = owner as 'red' | 'blue' | 'green';

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

    return NextResponse.json({ objectives });
  } catch (error) {
    console.error('Error fetching objectives:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
