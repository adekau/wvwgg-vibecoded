import { NextResponse } from 'next/server'
import { getWorlds } from '@/server/queries'

export async function GET() {
  try {
    const worlds = await getWorlds()
    return NextResponse.json(worlds)
  } catch (error) {
    console.error('Error fetching worlds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch worlds' },
      { status: 500 }
    )
  }
}
