import { NextResponse } from 'next/server'
import { getAllItemStats, getPopularItemStats, getItemStats } from '@/lib/gw2/api'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days

/**
 * GET /api/gw2/itemstats
 * Returns item stat combinations
 * Query params:
 *   - ids: comma-separated itemstat IDs
 *   - popular: 'true' to get only popular stat combos
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const popular = searchParams.get('popular')

    if (popular === 'true') {
      const itemStats = await getPopularItemStats()
      return NextResponse.json(itemStats)
    }

    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id, 10))
      const itemStats = await getItemStats(ids)
      return NextResponse.json(itemStats)
    }

    const itemStats = await getAllItemStats()
    return NextResponse.json(itemStats)
  } catch (error) {
    console.error('Error fetching itemstats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch itemstats' },
      { status: 500 }
    )
  }
}
