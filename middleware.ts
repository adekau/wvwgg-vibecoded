import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Ensure guild detail pages are always server-rendered
  if (request.nextUrl.pathname.match(/^\/guilds\/[^\/]+$/)) {
    const response = NextResponse.next()
    // Prevent caching of guild pages to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/guilds/:guildId*',
}
