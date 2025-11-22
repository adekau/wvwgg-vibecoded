import { NextResponse } from 'next/server'
import { getGuilds } from '@/server/queries'

export async function GET() {
  try {
    const guilds = await getGuilds()

    // Calculate statistics
    const totalGuilds = guilds.length

    const needsReview = guilds.filter(
      g => !g.classification || g.classification === undefined
    ).length

    const allianceGuilds = guilds.filter(
      g => g.classification === 'alliance'
    ).length

    const memberGuilds = guilds.filter(
      g => g.classification === 'member'
    ).length

    const independentGuilds = guilds.filter(
      g => g.classification === 'independent'
    ).length

    return NextResponse.json({
      totalGuilds,
      needsReview,
      allianceGuilds,
      memberGuilds,
      independentGuilds,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
