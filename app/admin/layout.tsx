'use client'

import { usePathname } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Don't protect the login page
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return <ProtectedRoute>{children}</ProtectedRoute>
}
