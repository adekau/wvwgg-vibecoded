'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

export function AdminSubNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()

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

  const handleLogout = () => {
    logout()
    router.push('/admin/login')
  }

  const getUsername = () => {
    if (!user) return ''
    return user.getUsername()
  }

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between">
          <div className="flex gap-1">
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
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{getUsername()}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </nav>
      </div>
    </div>
  )
}
