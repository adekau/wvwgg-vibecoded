import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getAllSkills, getSkills } from '@/lib/gw2/api'

// Force dynamic rendering since we use request.url for query params
export const dynamic = 'force-dynamic'

// GW2 skills rarely change, cache for 7 days
export const revalidate = 604800
export const maxDuration = 300 // 5 minutes max execution time for Vercel

// Cache all skills for 7 days since game data rarely changes
const getCachedAllSkills = unstable_cache(
  async () => {
    console.log('Fetching all skills from GW2 API...')
    const skills = await getAllSkills()
    console.log(`Fetched ${skills.length} skills`)
    return skills
  },
  ['gw2-all-skills'],
  {
    revalidate: 604800, // 7 days
    tags: ['gw2-skills'],
  }
)

/**
 * GET /api/gw2/skills
 * Returns all skills or specific skills by IDs
 * Query params: ids (comma-separated skill IDs)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id, 10))
      const skills = await getSkills(ids)
      return NextResponse.json(skills, {
        headers: {
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=1209600',
        },
      })
    }

    const skills = await getCachedAllSkills()
    return NextResponse.json(skills, {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=1209600',
      },
    })
  } catch (error) {
    console.error('Error fetching skills:', error)
    return NextResponse.json(
      { error: 'Failed to fetch skills', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
