'use client'

import { useState, useMemo, startTransition } from 'react'
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
import { Search, Plus, SlidersHorizontal, ChevronLeft } from 'lucide-react'
import { IGuild } from '@/server/queries'
import { GuildSearchModal } from './guild-search-modal'
import { GuildUpdateModal } from './guild-update-modal'
import { useRouter } from 'next/navigation'
import { GuildDetailPanel } from './guild-detail-panel'

interface GuildsInboxLayoutProps {
  guilds: IGuild[]
  worldMap: Map<number, string>
}

type SortOption = 'name' | 'tag' | 'members' | 'world'

export function GuildsInboxLayout({ guilds, worldMap }: GuildsInboxLayoutProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorld, setSelectedWorld] = useState<string>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedClassification, setSelectedClassification] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [selectedGuildForAdd, setSelectedGuildForAdd] = useState<{ id: string; name: string; tag: string } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null)

  // Helper function to get region from world name
  const getRegion = (worldId: number): string => {
    const worldName = worldMap.get(worldId) || ''
    if (worldName.includes('[DE]') || worldName.includes('[FR]') || worldName.includes('[ES]')) {
      return 'EU'
    }
    return 'NA'
  }

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
  }, [guilds, worldMap])

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
  }, [guilds, selectedWorld, selectedRegion, selectedClassification, searchQuery, sortBy, worldMap])

  const selectedGuild = selectedGuildId ? guilds.find(g => g.id === selectedGuildId) : null

  const handleGuildSelected = async (guildId: string) => {
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
  }

  const handleUpdateSuccess = () => {
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-24rem)]">
        {/* Left Panel - Guild List */}
        <div className={`flex flex-col gap-4 ${selectedGuildId ? 'hidden lg:flex lg:w-1/2' : 'w-full'}`}>
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
            <CardContent className="p-0 flex-1 overflow-auto">
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
                  {filteredGuilds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No guilds found matching your search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGuilds.map((guild) => {
                      const allianceGuild = guild.allianceGuildId
                        ? guilds.find(g => g.id === guild.allianceGuildId)
                        : null
                      const displayWorldId = allianceGuild ? allianceGuild.worldId : guild.worldId
                      const region = getRegion(displayWorldId)
                      const isSelected = selectedGuildId === guild.id

                      return (
                        <TableRow
                          key={guild.id}
                          className={`cursor-pointer ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}`}
                          onClick={() => {
                            startTransition(() => {
                              setSelectedGuildId(guild.id)
                            })
                          }}
                        >
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {guild.tag}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{guild.name}</span>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                {region} • {worldMap.get(displayWorldId)?.split(' ')[0]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {worldMap.get(displayWorldId) || `Unknown (${displayWorldId})`}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="secondary" className="text-xs">
                              {region}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">
            Showing {filteredGuilds.length.toLocaleString()} of {guilds.length.toLocaleString()} guilds
          </div>
        </div>

        {/* Right Panel - Guild Details */}
        {selectedGuild && (
          <div className={`flex flex-col ${selectedGuildId ? 'w-full lg:w-1/2' : 'hidden'}`}>
            <Card className="panel-border inset-card flex-1 overflow-auto">
              <CardContent className="p-6">
                {/* Mobile back button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4 lg:hidden"
                  onClick={() => setSelectedGuildId(null)}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to list
                </Button>

                <GuildDetailPanel
                  guild={selectedGuild}
                  allGuilds={guilds}
                  worldMap={worldMap}
                  isModal={false}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedGuild && (
          <div className="hidden lg:flex lg:w-1/2 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">No guild selected</p>
              <p className="text-sm">Select a guild from the list to view details</p>
            </div>
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
