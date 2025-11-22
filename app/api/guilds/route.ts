/**
 * API Route: Get All Guilds
 *
 * Returns all guilds from DynamoDB including their Glicko-2 ratings.
 * Used by the ratings leaderboard and admin pages.
 */

import { NextResponse } from 'next/server'
import { getGuilds } from '@/server/queries'

export async function GET() {
  try {
    const guilds = await getGuilds()

    return NextResponse.json(guilds, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[API] Error fetching guilds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guilds' },
      { status: 500 }
    )
  }
}
