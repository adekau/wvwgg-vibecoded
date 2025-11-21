'use client'

import { usePathname } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { MatchesHeader } from '@/components/matches-header'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Don't protect the login page
  if (pathname === '/admin/login') {
    return (
      <>
        <MatchesHeader />
        {children}
      </>
    )
  }

  return (
    <ProtectedRoute>
      <MatchesHeader />
      {children}
    </ProtectedRoute>
  )
}
