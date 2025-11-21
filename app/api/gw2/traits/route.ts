import { NextResponse } from 'next/server'
import { getAllTraits, getTraits } from '@/lib/gw2/api'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days

/**
 * GET /api/gw2/traits
 * Returns all traits or specific traits by IDs
 * Query params: ids (comma-separated trait IDs)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id, 10))
      const traits = await getTraits(ids)
      return NextResponse.json(traits)
    }

    const traits = await getAllTraits()
    return NextResponse.json(traits)
  } catch (error) {
    console.error('Error fetching traits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch traits' },
      { status: 500 }
    )
  }
}
