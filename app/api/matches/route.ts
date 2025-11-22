import { NextResponse } from 'next/server'
import { getMatches } from '@/server/queries'

// Cache for 60 seconds to match server query cache duration
export const revalidate = 60

export async function GET() {
  try {
    const matchesData = await getMatches()

    if (!matchesData) {
      return NextResponse.json(
        { error: 'No matches data available' },
        { status: 404 }
      )
    }

    // Transform data for the dropdown
    const matches = Object.values(matchesData)
      .filter((match: any) => match.red && match.blue && match.green)
      .map((match: any) => ({
        id: match.id,
        tier: match.id.split('-')[1],
        region: match.id.startsWith('1-') ? 'North America' : 'Europe',
        worlds: {
          red: match.red.world.name,
          blue: match.blue.world.name,
          green: match.green.world.name,
        },
      }))
      .sort((a: any, b: any) => {
        // Sort by region (NA first) then tier
        if (a.region !== b.region) {
          return a.region === 'North America' ? -1 : 1
        }
        return parseInt(a.tier) - parseInt(b.tier)
      })

    return NextResponse.json(matches, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    )
  }
}
