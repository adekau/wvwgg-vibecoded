import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getAllTraits, getTraits } from '@/lib/gw2/api'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days
export const maxDuration = 300 // 5 minutes max execution time for Vercel

// Cache all traits for 7 days since game data rarely changes
const getCachedAllTraits = unstable_cache(
  async () => {
    console.log('Fetching all traits from GW2 API...')
    const traits = await getAllTraits()
    console.log(`Fetched ${traits.length} traits`)
    return traits
  },
  ['gw2-all-traits'],
  {
    revalidate: 604800, // 7 days
    tags: ['gw2-traits'],
  }
)

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

    const traits = await getCachedAllTraits()
    return NextResponse.json(traits)
  } catch (error) {
    console.error('Error fetching traits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch traits', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
