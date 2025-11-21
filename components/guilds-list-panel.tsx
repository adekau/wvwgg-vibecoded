'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Plus, SlidersHorizontal } from 'lucide-react'
import { IGuild } from '@/server/queries'
import Link from 'next/link'
import { GuildSearchModal } from './guild-search-modal'
import { GuildUpdateModal } from './guild-update-modal'
import { useRouter, usePathname } from 'next/navigation'

interface GuildsListPanelProps {
  guilds: IGuild[]
  worldMap: Map<number, string>
}

type SortOption = 'name' | 'tag' | 'members' | 'world'

export function GuildsListPanel({ guilds, worldMap }: GuildsListPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorld, setSelectedWorld] = useState<string>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedClassification, setSelectedClassification] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [selectedGuildForAdd, setSelectedGuildForAdd] = useState<{ id: string; name: string; tag: string } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Extract selected guild ID from pathname
  const selectedGuildId = pathname.match(/\/guilds\/([^/]+)/)?.[1]

  // Helper function to get region from world name
  const getRegion = useCallback((worldId: number): string => {
    const worldName = worldMap.get(worldId) || ''
    if (worldName.includes('[DE]') || worldName.includes('[FR]') || worldName.includes('[ES]')) {
      return 'EU'
    }
    return 'NA'
  }, [worldMap])

  // Create a Map for O(1) guild lookups by ID
  const guildsById = useMemo(() => {
    const map = new Map<string, IGuild>()
    guilds.forEach(guild => {
      map.set(guild.id, guild)
    })
    return map
  }, [guilds])

  // Get unique worlds and regions
  const availableWorlds = useMemo(() => {
    const worlds = new Map<number, string>()
    guilds.forEach(guild => {
      const worldName = worldMap.get(guild.worldId)
      if (worldName) {
        worlds.set(guild.worldId, worldName)
      }
    })
    return Array.from(worlds.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [guilds, worldMap])

  const availableRegions = useMemo(() => {
    const regions = new Set<string>()
    guilds.forEach(guild => {
      regions.add(getRegion(guild.worldId))
    })
    return Array.from(regions).sort()
  }, [guilds, getRegion])

  // Filter and search guilds
  const filteredGuilds = useMemo(() => {
    let filtered = [...guilds]

    if (selectedRegion !== 'all') {
      filtered = filtered.filter(guild => getRegion(guild.worldId) === selectedRegion)
    }

    if (selectedWorld !== 'all') {
      filtered = filtered.filter(guild => guild.worldId === parseInt(selectedWorld))
    }

    if (selectedClassification !== 'all') {
      filtered = filtered.filter(guild => guild.classification === selectedClassification)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        guild =>
          guild.name.toLowerCase().includes(query) ||
          guild.tag.toLowerCase().includes(query)
      )
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'tag':
          return a.tag.localeCompare(b.tag)
        case 'members':
          return (b.member_count || 0) - (a.member_count || 0)
        case 'world':
          const worldA = worldMap.get(a.worldId) || ''
          const worldB = worldMap.get(b.worldId) || ''
          return worldA.localeCompare(worldB)
        default:
          return 0
      }
    })
  }, [guilds, selectedWorld, selectedRegion, selectedClassification, searchQuery, sortBy, worldMap, getRegion])

  // Reset to page 1 when filters change - moved outside useMemo to fix click issues
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedWorld, selectedRegion, selectedClassification, searchQuery, sortBy])

  // Paginate results
  const totalPages = Math.ceil(filteredGuilds.length / itemsPerPage)
  const paginatedGuilds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredGuilds.slice(startIndex, endIndex)
  }, [filteredGuilds, currentPage, itemsPerPage])

  const handleGuildSelected = useCallback(async (guildId: string) => {
    try {
      const response = await fetch(`https://api.guildwars2.com/v2/guild/${guildId}`)
      if (response.ok) {
        const guildData = await response.json()
        setSelectedGuildForAdd({
          id: guildId,
          name: guildData.name,
          tag: guildData.tag,
        })
        setUpdateModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to fetch guild details:', error)
    }
  }, [])

  const handleUpdateSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <>
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by guild name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-accent' : ''}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button onClick={() => setSearchModalOpen(true)} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Guild
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card className="panel-border inset-card">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Region</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {availableRegions.map(region => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">World</label>
                <Select value={selectedWorld} onValueChange={setSelectedWorld}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Worlds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Worlds</SelectItem>
                    {availableWorlds.map(([worldId, worldName]) => (
                      <SelectItem key={worldId} value={worldId.toString()}>
                        {worldName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={selectedClassification} onValueChange={setSelectedClassification}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="alliance">Alliance</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="independent">Independent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="members">Members</SelectItem>
                    <SelectItem value="world">World</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(selectedRegion !== 'all' || selectedWorld !== 'all' || selectedClassification !== 'all' || sortBy !== 'name') && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRegion('all')
                    setSelectedWorld('all')
                    setSelectedClassification('all')
                    setSortBy('name')
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Guild Table */}
      <Card className="panel-border inset-card flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-2 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Tag</TableHead>
                <TableHead>Guild Name</TableHead>
                <TableHead className="hidden md:table-cell">World</TableHead>
                <TableHead className="hidden sm:table-cell">Region</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedGuilds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No guilds found matching your search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedGuilds.map((guild) => {
                  // Use Map for O(1) lookup instead of O(n) find
                  const allianceGuild = guild.allianceGuildId
                    ? guildsById.get(guild.allianceGuildId)
                    : null
                  const displayWorldId = allianceGuild ? allianceGuild.worldId : guild.worldId
                  const region = getRegion(displayWorldId)
                  const isSelected = selectedGuildId === guild.id

                  return (
                    <TableRow
                      key={guild.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/8 hover:bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}
                    >
                      <TableCell>
                        <Link href={`/guilds/${guild.id}`} className="block">
                          <Badge variant="outline" className="font-mono text-xs">
                            {guild.tag}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/guilds/${guild.id}`} className="block">
                          <div className="flex flex-col">
                            <span>{guild.name}</span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                              {region} • {worldMap.get(displayWorldId)?.split(' ')[0]}
                            </span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Link href={`/guilds/${guild.id}`} className="block">
                          {worldMap.get(displayWorldId) || `Unknown (${displayWorldId})`}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Link href={`/guilds/${guild.id}`} className="block">
                          <Badge variant="secondary" className="text-xs">
                            {region}
                          </Badge>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedGuilds.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredGuilds.length)} of {filteredGuilds.length.toLocaleString()} guilds
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <GuildSearchModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        onGuildSelected={handleGuildSelected}
      />

      {selectedGuildForAdd && (
        <GuildUpdateModal
          guild={selectedGuildForAdd}
          allGuilds={guilds}
          open={updateModalOpen}
          onClose={() => {
            setUpdateModalOpen(false)
            setSelectedGuildForAdd(null)
          }}
          onSuccess={handleUpdateSuccess}
          addNew={true}
        />
      )}
    </>
  )
}
