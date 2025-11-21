import { NextResponse } from 'next/server'
import { getAllSkills, getSkills } from '@/lib/gw2/api'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days

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
      return NextResponse.json(skills)
    }

    const skills = await getAllSkills()
    return NextResponse.json(skills)
  } catch (error) {
    console.error('Error fetching skills:', error)
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    )
  }
}
