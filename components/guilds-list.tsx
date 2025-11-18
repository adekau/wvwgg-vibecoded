'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Shield, Search } from 'lucide-react'
import { IGuild } from '@/server/queries'

interface GuildsListProps {
  guilds: IGuild[]
  worldMap: Map<number, string>
}

export function GuildsList({ guilds, worldMap }: GuildsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorld, setSelectedWorld] = useState<string>('all')

  // Get unique worlds from guilds
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

  // Filter and search guilds
  const filteredGuilds = useMemo(() => {
    let filtered = [...guilds]

    // Filter by world
    if (selectedWorld !== 'all') {
      filtered = filtered.filter(guild => guild.worldId === parseInt(selectedWorld))
    }

    // Search by name or tag
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        guild =>
          guild.name.toLowerCase().includes(query) ||
          guild.tag.toLowerCase().includes(query)
      )
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [guilds, selectedWorld, searchQuery])

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
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

        <Select value={selectedWorld} onValueChange={setSelectedWorld}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by world" />
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

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredGuilds.length.toLocaleString()} of {guilds.length.toLocaleString()} guilds
      </div>

      {/* Guilds Grid */}
      {filteredGuilds.length === 0 ? (
        <Card className="panel-border inset-card p-12 text-center">
          <p className="text-muted-foreground">
            No guilds found matching your search criteria.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredGuilds.map((guild, idx) => (
            <Card
              key={guild.id}
              className="panel-border inset-card hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
              style={{ animationDelay: `${Math.min(idx * 0.01, 0.5)}s` }}
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {guild.tag}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-base truncate" title={guild.name}>
                      {guild.name}
                    </h3>
                  </div>
                  <Shield className="h-5 w-5 text-accent shrink-0 ml-2" />
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">World</div>
                    <div className="text-sm font-medium truncate" title={worldMap.get(guild.worldId)}>
                      {worldMap.get(guild.worldId) || `Unknown (${guild.worldId})`}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
