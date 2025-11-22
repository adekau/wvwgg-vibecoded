'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Loader2, TrendingUp, Award, RefreshCcw, AlertCircle } from 'lucide-react'
import { IGuild } from '@/server/queries'
import { useAuth } from '@/lib/auth-context'
import { getRatingTier } from '@/lib/glicko2'
import { getRatingSummary } from '@/lib/glicko-match-predictor'

interface WorldData {
  id: number
  name: string
}

export default function AdminRatingsPage() {
  const { user } = useAuth()
  const [guilds, setGuilds] = useState<IGuild[]>([])
  const [worlds, setWorlds] = useState<WorldData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [worldFilter, setWorldFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'rating' | 'matches' | 'name'>('rating')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [guildsRes, worldsRes] = await Promise.all([
        fetch('/api/guilds'),
        fetch('/api/worlds'),
      ])

      if (guildsRes.ok) {
        const guildsData = await guildsRes.json()
        setGuilds(guildsData || [])
      }

      if (worldsRes.ok) {
        const worldsData = await worldsRes.json()
        setWorlds(worldsData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const worldMap = useMemo(() => {
    const map = new Map<number, string>()
    worlds.forEach(world => map.set(world.id, world.name))
    return map
  }, [worlds])

  // Filter and sort guilds
  const filteredGuilds = useMemo(() => {
    // Only show alliance guilds
    const allianceGuilds = guilds.filter(guild => guild.classification === 'alliance')

    const filtered = allianceGuilds.filter(guild => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        guild.name.toLowerCase().includes(searchLower) ||
        guild.tag.toLowerCase().includes(searchLower)

      // World filter
      const matchesWorld = worldFilter === 'all' || guild.worldId === parseInt(worldFilter)

      // Tier filter
      let matchesTier = true
      if (tierFilter !== 'all' && guild.glickoRating) {
        const tier = getRatingTier(guild.glickoRating.rating)
        matchesTier = tier.tier === tierFilter
      } else if (tierFilter !== 'all') {
        matchesTier = false // Filter out guilds without ratings if tier is selected
      }

      return matchesSearch && matchesWorld && matchesTier
    })

    // Sort guilds
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0

      if (sortBy === 'rating') {
        const aRating = a.glickoRating?.rating || 0
        const bRating = b.glickoRating?.rating || 0
        compareValue = aRating - bRating
      } else if (sortBy === 'matches') {
        const aMatches = a.glickoRating?.matchCount || 0
        const bMatches = b.glickoRating?.matchCount || 0
        compareValue = aMatches - bMatches
      } else {
        compareValue = a.name.localeCompare(b.name)
      }

      return sortOrder === 'asc' ? compareValue : -compareValue
    })

    return sorted
  }, [guilds, searchTerm, worldFilter, tierFilter, sortBy, sortOrder])

  // Pagination
  const paginatedGuilds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredGuilds.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredGuilds, currentPage])

  const totalPages = Math.ceil(filteredGuilds.length / itemsPerPage)

  // Statistics
  const stats = useMemo(() => {
    const allianceGuilds = guilds.filter(g => g.classification === 'alliance')
    const ratedGuilds = allianceGuilds.filter(g => g.glickoRating && g.glickoRating.matchCount && g.glickoRating.matchCount > 0)
    const avgRating = ratedGuilds.length > 0
      ? ratedGuilds.reduce((sum, g) => sum + (g.glickoRating?.rating || 0), 0) / ratedGuilds.length
      : 0

    return {
      totalAlliances: allianceGuilds.length,
      ratedAlliances: ratedGuilds.length,
      averageRating: Math.round(avgRating),
    }
  }, [guilds])

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be logged in to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alliance Guild Ratings</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor Glicko-2 ratings for WvW alliance guilds
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Alliance Guilds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAlliances}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rated Guilds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ratedAlliances}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalAlliances > 0
                ? `${Math.round((stats.ratedAlliances / stats.totalAlliances) * 100)}% of total`
                : 'No guilds'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all rated guilds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                About Glicko-2 Ratings
              </p>
              <p className="text-blue-600 dark:text-blue-400">
                Ratings are automatically updated after each match. Higher ratings indicate stronger performance.
                Rating Deviation (RD) shows uncertainty - lower values mean more confidence in the rating.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guilds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* World Filter */}
            <Select value={worldFilter} onValueChange={setWorldFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Worlds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Worlds</SelectItem>
                {worlds.map(world => (
                  <SelectItem key={world.id} value={world.id.toString()}>
                    {world.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Legendary">Legendary (2200+)</SelectItem>
                <SelectItem value="Diamond">Diamond (2000-2199)</SelectItem>
                <SelectItem value="Platinum">Platinum (1800-1999)</SelectItem>
                <SelectItem value="Gold">Gold (1600-1799)</SelectItem>
                <SelectItem value="Silver">Silver (1400-1599)</SelectItem>
                <SelectItem value="Bronze">Bronze (1200-1399)</SelectItem>
                <SelectItem value="Iron">Iron (0-1199)</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [by, order] = value.split('-')
              setSortBy(by as 'rating' | 'matches' | 'name')
              setSortOrder(order as 'asc' | 'desc')
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating-desc">Rating (High to Low)</SelectItem>
                <SelectItem value="rating-asc">Rating (Low to High)</SelectItem>
                <SelectItem value="matches-desc">Matches (Most First)</SelectItem>
                <SelectItem value="matches-asc">Matches (Least First)</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Alliance Guilds ({filteredGuilds.length})
          </CardTitle>
          <CardDescription>
            Showing {paginatedGuilds.length} of {filteredGuilds.length} guilds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedGuilds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No guilds found matching your filters
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guild</TableHead>
                    <TableHead>World</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Matches</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGuilds.map((guild) => {
                    const worldName = worldMap.get(guild.worldId) || 'Unknown'
                    const hasRating = guild.glickoRating && guild.glickoRating.matchCount && guild.glickoRating.matchCount > 0
                    const tier = hasRating ? getRatingTier(guild.glickoRating!.rating) : null
                    const summary = hasRating ? getRatingSummary(guild.glickoRating!) : null

                    return (
                      <TableRow key={guild.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{guild.name}</div>
                            <div className="text-xs text-muted-foreground">[{guild.tag}]</div>
                          </div>
                        </TableCell>
                        <TableCell>{worldName}</TableCell>
                        <TableCell>
                          {hasRating && summary ? (
                            <div className="font-mono text-sm">
                              {summary.displayRating}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not rated</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tier ? (
                            <Badge
                              variant="outline"
                              style={{ color: tier.color, borderColor: tier.color }}
                            >
                              {tier.tier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {summary ? (
                            <span className="text-sm">{summary.confidence}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasRating ? (
                            <span className="text-sm">{guild.glickoRating!.matchCount}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasRating && guild.glickoRating!.lastUpdated ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(guild.glickoRating!.lastUpdated).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
