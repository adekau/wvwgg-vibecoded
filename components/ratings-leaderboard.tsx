'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Loader2, Trophy, TrendingUp, Info, Award, Medal } from 'lucide-react'
import type { IGuild } from '@/server/queries'
import { getRatingTier } from '@/lib/glicko2'
import { getRatingSummary } from '@/lib/glicko-match-predictor'
import { RatingLeaderboardCompact, RatingDistribution } from '@/components/rating-leaderboard-compact'

interface WorldData {
  id: number
  name: string
}

export function RatingsLeaderboard() {
  const [searchTerm, setSearchTerm] = useState('')
  const [worldFilter, setWorldFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'rating' | 'matches' | 'name'>('rating')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Fetch guilds
  const { data: guilds = [], isLoading: guildsLoading } = useQuery({
    queryKey: ['guilds'],
    queryFn: async () => {
      const response = await fetch('/api/guilds')
      if (!response.ok) throw new Error('Failed to fetch guilds')
      return response.json() as Promise<IGuild[]>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch worlds
  const { data: worlds = [], isLoading: worldsLoading } = useQuery({
    queryKey: ['worlds'],
    queryFn: async () => {
      const response = await fetch('/api/worlds')
      if (!response.ok) throw new Error('Failed to fetch worlds')
      return response.json() as Promise<WorldData[]>
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  const isLoading = guildsLoading || worldsLoading

  const worldMap = useMemo(() => {
    const map = new Map<number, string>()
    worlds.forEach(world => map.set(world.id, world.name))
    return map
  }, [worlds])

  // Filter guilds
  const filteredGuilds = useMemo(() => {
    // Only show alliance guilds with Glicko ratings
    const ratedAlliances = guilds.filter(
      guild =>
        guild.classification === 'alliance' &&
        guild.glickoRating &&
        typeof guild.glickoRating.matchCount === 'number'
    )

    const filtered = ratedAlliances.filter(guild => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        guild.name.toLowerCase().includes(searchLower) ||
        guild.tag.toLowerCase().includes(searchLower) ||
        worldMap.get(guild.worldId)?.toLowerCase().includes(searchLower)

      // World filter
      const matchesWorld = worldFilter === 'all' || guild.worldId === parseInt(worldFilter)

      // Tier filter
      let matchesTier = true
      if (tierFilter !== 'all' && guild.glickoRating) {
        const tier = getRatingTier(guild.glickoRating.rating)
        matchesTier = tier.tier === tierFilter
      }

      return matchesSearch && matchesWorld && matchesTier
    })

    // Sort guilds
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0

      if (sortBy === 'rating') {
        const aRating = a.glickoRating?.rating || 0
        const bRating = b.glickoRating?.rating || 0
        compareValue = bRating - aRating // Higher first
      } else if (sortBy === 'matches') {
        const aMatches = a.glickoRating?.matchCount || 0
        const bMatches = b.glickoRating?.matchCount || 0
        compareValue = bMatches - aMatches // More first
      } else {
        compareValue = a.name.localeCompare(b.name)
      }

      return compareValue
    })

    return sorted
  }, [guilds, searchTerm, worldFilter, tierFilter, sortBy, worldMap])

  // Pagination
  const paginatedGuilds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredGuilds.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredGuilds, currentPage])

  const totalPages = Math.ceil(filteredGuilds.length / itemsPerPage)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, worldFilter, tierFilter, sortBy])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-orange-500" />
      default:
        return null
    }
  }

  // Calculate overall rank for each guild
  const guildRanks = useMemo(() => {
    const allRated = guilds.filter(
      g => g.classification === 'alliance' && g.glickoRating && typeof g.glickoRating.matchCount === 'number'
    )
    const sorted = [...allRated].sort((a, b) => (b.glickoRating?.rating || 0) - (a.glickoRating?.rating || 0))
    const ranks = new Map<string, number>()
    sorted.forEach((guild, index) => ranks.set(guild.id, index + 1))
    return ranks
  }, [guilds])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                About Glicko-2 Rankings
              </p>
              <p className="text-blue-600 dark:text-blue-400">
                Alliance guilds are ranked using the Glicko-2 rating system, which accounts for match performance and opponent strength.
                Higher ratings indicate stronger competitive performance. Rating Deviation (RD) shows uncertainty - lower values mean higher confidence in the rating.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="leaderboard">
            <TrendingUp className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="distribution">
            <Trophy className="h-4 w-4 mr-2" />
            Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-6">
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
                    placeholder="Search guilds or worlds..."
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
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'rating' | 'matches' | 'name')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Rating (Highest)</SelectItem>
                    <SelectItem value="matches">Matches Played</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>Rankings</CardTitle>
              <CardDescription>
                Showing {paginatedGuilds.length} of {filteredGuilds.length} alliance guilds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredGuilds.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm || worldFilter !== 'all' || tierFilter !== 'all'
                    ? 'No guilds found matching your filters'
                    : 'No rated alliance guilds found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedGuilds.map((guild) => {
                    const tier = getRatingTier(guild.glickoRating!.rating)
                    const summary = getRatingSummary(guild.glickoRating!)
                    const worldName = worldMap.get(guild.worldId) || `World ${guild.worldId}`
                    const globalRank = guildRanks.get(guild.id) || 0
                    const currentPageRank = (currentPage - 1) * itemsPerPage + paginatedGuilds.indexOf(guild) + 1

                    return (
                      <div
                        key={guild.id}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        {/* Rank */}
                        <div className="flex items-center justify-center w-16 flex-shrink-0">
                          {globalRank <= 3 && sortBy === 'rating' && worldFilter === 'all' && tierFilter === 'all' && !searchTerm ? (
                            getRankIcon(globalRank)
                          ) : (
                            <div className="text-center">
                              <div className="text-2xl font-bold text-muted-foreground">
                                #{globalRank}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Guild Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg truncate">
                              {guild.name}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              [{guild.tag}]
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{worldName}</span>
                            <span>•</span>
                            <span>{summary.matchCount} matches</span>
                            <span>•</span>
                            <span>{summary.confidence} confidence</span>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono text-2xl font-bold mb-1" style={{ color: tier.color }}>
                            {summary.rating}
                          </div>
                          <Badge
                            variant="outline"
                            style={{
                              color: tier.color,
                              borderColor: tier.color + '50',
                              backgroundColor: tier.color + '10'
                            }}
                          >
                            {tier.tier}
                          </Badge>
                        </div>

                        {/* RD */}
                        <div className="text-right w-20 flex-shrink-0">
                          <div className="text-xs text-muted-foreground">RD</div>
                          <div className="font-mono text-sm">
                            ±{Math.round(guild.glickoRating!.ratingDeviation)}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-6 border-t border-border">
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
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rating Distribution */}
            <RatingDistribution guilds={guilds} />

            {/* Top 10 */}
            <RatingLeaderboardCompact
              guilds={guilds}
              limit={10}
              title="Top 10 Alliance Guilds"
              description="Highest rated guilds globally"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
