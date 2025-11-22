'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function AdminSubNav() {
  const pathname = usePathname()

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      id: 'guilds',
      label: 'Manage Guilds',
      href: '/admin/guilds',
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      href: '/admin/audit-logs',
    },
  ]

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname?.startsWith(tab.href)

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition-colors relative",
                  "hover:text-foreground",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
