'use client'

import { useState, useMemo } from 'react'
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
import { Search } from 'lucide-react'
import { IGuild } from '@/server/queries'
import Link from 'next/link'

interface GuildsListProps {
  guilds: IGuild[]
  worldMap: Map<number, string>
}

export function GuildsList({ guilds, worldMap }: GuildsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorld, setSelectedWorld] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

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
    const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name))

    // Reset to page 1 when filters change
    setCurrentPage(1)
    return sorted
  }, [guilds, selectedWorld, searchQuery])

  const paginatedGuilds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredGuilds.slice(startIndex, endIndex)
  }, [filteredGuilds, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredGuilds.length / itemsPerPage)

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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredGuilds.length === guilds.length ? (
            <>Showing all {guilds.length.toLocaleString()} guilds</>
          ) : (
            <>Showing {filteredGuilds.length.toLocaleString()} of {guilds.length.toLocaleString()} guilds</>
          )}
        </div>
        {totalPages > 1 && (
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>

      {/* Guilds Table */}
      <Card className="panel-border inset-card">
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Guild Name</TableHead>
                  <TableHead>World</TableHead>
                  {guilds[0]?.member_count !== undefined && (
                    <TableHead className="text-right">Members</TableHead>
                  )}
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
                  paginatedGuilds.map((guild) => (
                    <TableRow key={guild.id} className="hover:bg-accent/50 cursor-pointer">
                      <TableCell>
                        <Link href={`/guilds/${guild.id}`} className="block">
                          <Badge variant="outline" className="font-mono">
                            {guild.tag}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/guilds/${guild.id}`} className="block">
                          {guild.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/guilds/${guild.id}`} className="block">
                          {worldMap.get(guild.worldId) || `Unknown (${guild.worldId})`}
                        </Link>
                      </TableCell>
                      {guild.member_count !== undefined && (
                        <TableCell className="text-right">
                          <Link href={`/guilds/${guild.id}`} className="block">
                            {guild.member_count}
                          </Link>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentPage(p => Math.max(1, p - 1))
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (currentPage <= 4) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = currentPage - 3 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setCurrentPage(pageNum)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentPage(p => Math.min(totalPages, p + 1))
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
