import { NextResponse } from 'next/server'
import { getItems, getAllRunes, getAllSigils } from '@/lib/gw2/api'

export const dynamic = 'force-dynamic'
export const revalidate = 604800 // 7 days

/**
 * GET /api/gw2/items
 * Returns items by IDs or filtered by type
 * Query params:
 *   - ids: comma-separated item IDs
 *   - type: 'runes' | 'sigils'
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const type = searchParams.get('type')

    if (type === 'runes') {
      const runes = await getAllRunes()
      return NextResponse.json(runes)
    }

    if (type === 'sigils') {
      const sigils = await getAllSigils()
      return NextResponse.json(sigils)
    }

    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id, 10))
      const items = await getItems(ids)
      return NextResponse.json(items)
    }

    return NextResponse.json(
      { error: 'Please provide ids or type parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}
