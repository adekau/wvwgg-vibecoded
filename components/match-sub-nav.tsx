'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface MatchSubNavProps {
  matchId: string
  currentTab?: 'overview' | 'scenarios'
}

export function MatchSubNav({ matchId, currentTab = 'overview' }: MatchSubNavProps) {
  const pathname = usePathname()

  const tabs = [
    {
      id: 'overview',
      label: 'Match Overview',
      href: `/matches/${matchId}`,
    },
    {
      id: 'scenarios',
      label: 'VP Scenarios',
      href: `/matches/${matchId}/scenarios`,
    },
  ]

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || currentTab === tab.id

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
