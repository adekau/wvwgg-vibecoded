import { NextResponse } from 'next/server'
import { getProfession } from '@/lib/gw2/api'
import type { ProfessionId } from '@/lib/gw2/types'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days

/**
 * GET /api/gw2/professions/[id]
 * Returns a specific profession by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const profession = await getProfession(params.id as ProfessionId)
    return NextResponse.json(profession)
  } catch (error) {
    console.error(`Error fetching profession ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch profession' },
      { status: 500 }
    )
  }
}
