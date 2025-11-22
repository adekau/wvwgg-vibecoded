'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, Users, CheckCircle, AlertCircle, LogOut, List, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalGuilds: number
  needsReview: number
  allianceGuilds: number
  memberGuilds: number
  independentGuilds: number
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalGuilds: 0,
    needsReview: 0,
    allianceGuilds: 0,
    memberGuilds: 0,
    independentGuilds: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch actual stats from API
    // For now, using mock data
    setTimeout(() => {
      setStats({
        totalGuilds: 1234,
        needsReview: 856,
        allianceGuilds: 45,
        memberGuilds: 178,
        independentGuilds: 155,
      })
      setIsLoading(false)
    }, 500)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/admin/login')
  }

  const getUsername = () => {
    if (!user) return ''
    return user.getUsername()
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Shield className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Guild Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage WvW guilds and classifications</p>
            </div>
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="panel-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Guilds</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.totalGuilds.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tracked in the database
                </p>
              </CardContent>
            </Card>

            <Card className="panel-border border-orange-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {isLoading ? '...' : stats.needsReview.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Guilds pending classification
                </p>
              </CardContent>
            </Card>

            <Card className="panel-border border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alliance Guilds</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {isLoading ? '...' : stats.allianceGuilds.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Main alliance guilds
                </p>
              </CardContent>
            </Card>

            <Card className="panel-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Member Guilds</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.memberGuilds.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Linked to alliances
                </p>
              </CardContent>
            </Card>

            <Card className="panel-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Independent</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.independentGuilds.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Not part of an alliance
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="panel-border hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/admin/guilds')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 group-hover:text-accent transition-colors">
                  <List className="h-5 w-5" />
                  Manage Guilds
                </CardTitle>
                <CardDescription>
                  Search and edit guild classifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={(e) => {
                  e.stopPropagation()
                  router.push('/admin/guilds')
                }}>
                  Manage Guilds
                </Button>
              </CardContent>
            </Card>

            <Card className="panel-border hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 group-hover:text-accent transition-colors">
                  <Users className="h-5 w-5" />
                  Manage Guilds
                </CardTitle>
                <CardDescription>
                  Edit guild classifications and alliances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  View All Guilds
                </Button>
              </CardContent>
            </Card>

            <Card className="panel-border hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/admin/ratings')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 group-hover:text-accent transition-colors">
                  <TrendingUp className="h-5 w-5" />
                  Alliance Ratings
                </CardTitle>
                <CardDescription>
                  View and manage Glicko-2 ratings for alliance guilds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={(e) => {
                  e.stopPropagation()
                  router.push('/admin/ratings')
                }}>
                  View Ratings
                </Button>
              </CardContent>
            </Card>

            <Card className="panel-border hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => router.push('/admin/audit-logs')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 group-hover:text-accent transition-colors">
                  <Shield className="h-5 w-5" />
                  Audit Log
                </CardTitle>
                <CardDescription>
                  View all administrative actions and changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={(e) => {
                  e.stopPropagation()
                  router.push('/admin/audit-logs')
                }}>
                  View Logs
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
