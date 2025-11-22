/**
 * API route to optimize gear based on target stats
 */

import { NextResponse } from 'next/server'
import { getAllItemStats } from '@/server/build-queries'
import { optimizeGear, type TargetStats } from '@/lib/gw2/gear-optimizer'

export async function POST(request: Request) {
  try {
    const targetStats: TargetStats = await request.json()

    // Get all itemstats from database
    const itemStats = await getAllItemStats()

    if (itemStats.length === 0) {
      return NextResponse.json(
        { error: 'No itemstats found in database. Please sync game data first.' },
        { status: 404 }
      )
    }

    // Optimize gear selection
    const optimizedBuild = optimizeGear(itemStats, targetStats)

    return NextResponse.json(optimizedBuild)
  } catch (error) {
    console.error('Error optimizing gear:', error)
    return NextResponse.json(
      { error: 'Failed to optimize gear' },
      { status: 500 }
    )
  }
}
