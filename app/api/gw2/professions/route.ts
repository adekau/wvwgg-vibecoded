import { NextResponse } from 'next/server'
import { getAllProfessionDetails } from '@/lib/gw2/api'

// GW2 professions rarely change, cache for 7 days
export const revalidate = 604800

/**
 * GET /api/gw2/professions
 * Returns all professions with their details
 */
export async function GET() {
  try {
    const professions = await getAllProfessionDetails()
    return NextResponse.json(professions, {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=1209600',
      },
    })
  } catch (error) {
    console.error('Error fetching professions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch professions' },
      { status: 500 }
    )
  }
}
