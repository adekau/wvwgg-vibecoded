import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tag, secret } = body

    // Check secret to prevent abuse
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    if (!tag) {
      return NextResponse.json({ error: 'Tag is required' }, { status: 400 })
    }

    revalidateTag(tag)

    return NextResponse.json({
      revalidated: true,
      tag,
      now: Date.now(),
    })
  } catch (error) {
    console.error('Error revalidating:', error)
    return NextResponse.json(
      { error: 'Failed to revalidate' },
      { status: 500 }
    )
  }
}
