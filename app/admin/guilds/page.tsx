'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { Search, Edit, Loader2, Users } from 'lucide-react'
import { IGuild } from '@/server/queries'
import { GuildEditModal } from '@/components/admin/guild-edit-modal'
import { useAuth } from '@/lib/auth-context'

interface AdminGuild extends IGuild {
  classification?: 'alliance' | 'member' | 'independent'
  allianceGuildId?: string
  memberGuildIds?: string[]
  notes?: string
  reviewed?: boolean
  reviewedAt?: number
  reviewedBy?: string
}

interface WorldData {
  id: number
  name: string
}

export default function AdminGuildsPage() {
  const { user } = useAuth()
  const [guilds, setGuilds] = useState<AdminGuild[]>([])
  const [worlds, setWorlds] = useState<WorldData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [worldFilter, setWorldFilter] = useState<string>('all')
  const [classificationFilter, setClassificationFilter] = useState<string>('all')
  const [reviewedFilter, setReviewedFilter] = useState<string>('all')
  const [selectedGuild, setSelectedGuild] = useState<AdminGuild | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [guildsRes, worldsRes] = await Promise.all([
        fetch('/api/admin/guilds'),
        fetch('/api/worlds'),
      ])

      if (guildsRes.ok) {
        const guildsData = await guildsRes.json()
        setGuilds(guildsData.guilds || [])
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

  const filteredGuilds = useMemo(() => {
    const filtered = guilds.filter(guild => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        guild.name.toLowerCase().includes(searchLower) ||
        guild.tag.toLowerCase().includes(searchLower)

      // World filter
      const matchesWorld = worldFilter === 'all' || guild.worldId === parseInt(worldFilter)

      // Classification filter
      const matchesClassification = classificationFilter === 'all' ||
        (classificationFilter === 'unclassified' && !guild.classification) ||
        guild.classification === classificationFilter

      // Reviewed filter
      const matchesReviewed = reviewedFilter === 'all' ||
        (reviewedFilter === 'reviewed' && guild.reviewed) ||
        (reviewedFilter === 'unreviewed' && !guild.reviewed)

      return matchesSearch && matchesWorld && matchesClassification && matchesReviewed
    })

    // Reset to page 1 when filters change
    setCurrentPage(1)
    return filtered
  }, [guilds, searchTerm, worldFilter, classificationFilter, reviewedFilter])

  const paginatedGuilds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredGuilds.slice(startIndex, endIndex)
  }, [filteredGuilds, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredGuilds.length / itemsPerPage)

  const handleEditGuild = useCallback((guild: AdminGuild) => {
    setSelectedGuild(guild)
  }, [])

  const stats = useMemo(() => {
    return {
      total: guilds.length,
      alliances: guilds.filter(g => g.classification === 'alliance').length,
      members: guilds.filter(g => g.classification === 'member').length,
      independent: guilds.filter(g => g.classification === 'independent').length,
      unclassified: guilds.filter(g => !g.classification).length,
      reviewed: guilds.filter(g => g.reviewed).length,
    }
  }, [guilds])

  const getClassificationBadge = (classification?: string) => {
    if (!classification) {
      return <Badge variant="outline">Unclassified</Badge>
    }
    const variants: Record<string, any> = {
      alliance: 'default',
      member: 'secondary',
      independent: 'outline',
    }
    return <Badge variant={variants[classification]}>{classification}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Guild Management</h1>
          <p className="text-muted-foreground mt-1">
            Search and edit guild classifications and relationships
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alliances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.alliances}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.members}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Independent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.independent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unclassified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unclassified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reviewed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find guilds by name, tag, or world</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={worldFilter} onValueChange={setWorldFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
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
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="alliance">Alliance</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
                <SelectItem value="unclassified">Unclassified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="unreviewed">Unreviewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Guilds ({filteredGuilds.length})
          </CardTitle>
          <CardDescription>Click a guild to edit its details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guild</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>World</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGuilds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No guilds found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGuilds.map((guild) => (
                    <TableRow key={guild.id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell className="font-medium">{guild.name}</TableCell>
                      <TableCell>[{guild.tag}]</TableCell>
                      <TableCell>{worldMap.get(guild.worldId) || 'Unknown'}</TableCell>
                      <TableCell>{getClassificationBadge(guild.classification)}</TableCell>
                      <TableCell>
                        {guild.reviewed ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            Reviewed
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unreviewed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditGuild(guild)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredGuilds.length)} of {filteredGuilds.length} guilds
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <GuildEditModal
        guild={selectedGuild}
        allGuilds={guilds}
        open={!!selectedGuild}
        onClose={() => setSelectedGuild(null)}
        onSave={async (updatedGuild) => {
          try {
            const response = await fetch(`/api/admin/guilds/${updatedGuild.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                classification: updatedGuild.classification,
                allianceGuildId: updatedGuild.allianceGuildId,
                memberGuildIds: updatedGuild.memberGuildIds,
                notes: updatedGuild.notes,
                reviewedBy: user?.getUsername() || 'unknown',
              }),
            })

            if (!response.ok) {
              throw new Error('Failed to update guild')
            }

            // Refresh guild list
            await fetchData()
          } catch (error) {
            console.error('Error updating guild:', error)
            throw error
          }
        }}
      />
    </div>
  )
}
