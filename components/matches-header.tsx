"use client"

import { Moon, Sun, ChevronDown } from 'lucide-react'
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'

interface Match {
  id: string
  tier: string
  region: string
  worlds: {
    red: string
    blue: string
    green: string
  }
}

export function MatchesHeader() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const { user, session } = useAuth()

  // Fetch matches for the dropdown
  const { data: matches = [] } = useQuery<Match[]>({
    queryKey: ['nav-matches'],
    queryFn: async () => {
      const res = await fetch('/api/matches')
      if (!res.ok) throw new Error('Failed to fetch matches')
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Group matches by region
  const matchesByRegion = matches.reduce((acc, match) => {
    if (!acc[match.region]) {
      acc[match.region] = []
    }
    acc[match.region].push(match)
    return acc
  }, {} as Record<string, Match[]>)

  const sortedRegions = Object.keys(matchesByRegion).sort((a, b) => {
    if (a === 'North America') return -1
    if (b === 'North America') return 1
    return 0
  })

  const navLinks = [
    { href: '/maps', label: 'Maps' },
    { href: '/guilds', label: 'Guilds' },
    { href: '/legend', label: 'Legend' },
  ]

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50 header-shadow">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/matches" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="relative">
                <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6 text-primary-foreground"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">WvW.gg</h1>
                <p className="text-xs text-muted-foreground">World vs World Matches</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {/* Matches link with dropdown */}
              <div className="flex items-center h-9">
                <Link
                  href="/matches"
                  className={`pl-4 pr-2 h-full flex items-center rounded-l-md text-sm font-medium transition-colors ${
                    pathname === '/matches' || pathname?.startsWith('/matches/')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  Matches
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`px-2 h-full flex items-center rounded-r-md text-sm font-medium transition-colors border-l border-primary-foreground/20 ${
                        pathname === '/matches' || pathname?.startsWith('/matches/')
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-[340px] bg-popover/95 backdrop-blur-md border-border/40 shadow-xl rounded-xl"
                    sideOffset={8}
                  >
                    {sortedRegions.map((region) => (
                      <DropdownMenuGroup key={region}>
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 px-4 pt-3 pb-1.5">
                          {region}
                        </DropdownMenuLabel>
                        {matchesByRegion[region].map((match) => (
                          <DropdownMenuItem
                            key={match.id}
                            onClick={() => {
                              router.push(`/matches/${match.id}`)
                            }}
                            className="cursor-pointer py-2.5 px-4 mx-1.5 mb-1 rounded-lg focus:bg-accent/40 hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm">Tier {match.tier}</span>
                              </div>
                              <div className="text-xs flex items-center gap-1.5 flex-wrap">
                                <span className="text-chart-1 font-medium">{match.worlds.red}</span>
                                <span className="text-muted-foreground/40">vs</span>
                                <span className="text-chart-2 font-medium">{match.worlds.blue}</span>
                                <span className="text-muted-foreground/40">vs</span>
                                <span className="text-chart-3 font-medium">{match.worlds.green}</span>
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Other nav links */}
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user && session && (
              <Link href="/admin/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                >
                  Admin Panel
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
