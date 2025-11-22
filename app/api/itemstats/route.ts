/**
 * API route to get all itemstats
 */

import { NextResponse } from 'next/server'
import { getAllItemStats } from '@/server/build-queries'

export async function GET() {
  try {
    const itemStats = await getAllItemStats()

    return NextResponse.json({
      itemStats,
      count: itemStats.length
    })
  } catch (error) {
    console.error('Error fetching itemstats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch itemstats' },
      { status: 500 }
    )
  }
}
