"use client"

import { Moon, Sun } from 'lucide-react'
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function MatchesHeader() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  
  const navLinks = [
    { href: '/matches', label: 'Matches' },
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
