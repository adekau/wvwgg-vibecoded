import { NextResponse } from 'next/server'
import { getAllProfessionDetails } from '@/lib/gw2/api'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days

/**
 * GET /api/gw2/professions
 * Returns all professions with their details
 */
export async function GET() {
  try {
    const professions = await getAllProfessionDetails()
    return NextResponse.json(professions)
  } catch (error) {
    console.error('Error fetching professions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch professions' },
      { status: 500 }
    )
  }
}
