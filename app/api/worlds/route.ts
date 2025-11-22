import { NextResponse } from 'next/server'
import { getWorlds } from '@/server/queries'

// Cache for 1 day to match server query cache duration
export const revalidate = 86400

export async function GET() {
  try {
    const worlds = await getWorlds()
    return NextResponse.json(worlds, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
      },
    })
  } catch (error) {
    console.error('Error fetching worlds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch worlds' },
      { status: 500 }
    )
  }
}
