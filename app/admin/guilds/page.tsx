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
import { Search, Edit, Loader2, Users, Plus } from 'lucide-react'
import { IGuild } from '@/server/queries'
import { GuildEditModal } from '@/components/admin/guild-edit-modal'
import { GuildSearchModal } from '@/components/guild-search-modal'
import { useAuth } from '@/lib/auth-context'
import { AdminSubNav } from '@/components/admin-sub-nav'

interface AdminGuild extends IGuild {
  classification?: 'alliance' | 'solo-alliance' | 'member' | 'independent'
  allianceGuildId?: string
  memberGuildIds?: string[]
  description?: string
  contact_info?: string
  recruitment_status?: 'open' | 'closed' | 'by_application'
  primetimeTimezones?: string[]
  notes?: string
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
  const [selectedGuild, setSelectedGuild] = useState<AdminGuild | null>(null)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [addingGuild, setAddingGuild] = useState(false)
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

      return matchesSearch && matchesWorld && matchesClassification
    })

    return filtered
  }, [guilds, searchTerm, worldFilter, classificationFilter])

  // Reset to page 1 when filters change - moved outside useMemo to fix performance
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, worldFilter, classificationFilter])

  const paginatedGuilds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredGuilds.slice(startIndex, endIndex)
  }, [filteredGuilds, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredGuilds.length / itemsPerPage)

  const handleEditGuild = useCallback((guild: AdminGuild) => {
    setSelectedGuild(guild)
  }, [])

  const handleAddGuild = async (guildId: string) => {
    setAddingGuild(true)
    try {
      const response = await fetch('/api/admin/guilds/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId,
          addedBy: user?.getUsername() || 'unknown',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add guild')
      }

      // Refresh guild list
      await fetchData()
      setSearchModalOpen(false)
    } catch (error) {
      console.error('Error adding guild:', error)
      alert(error instanceof Error ? error.message : 'Failed to add guild')
    } finally {
      setAddingGuild(false)
    }
  }

  const stats = useMemo(() => {
    return {
      total: guilds.length,
      alliances: guilds.filter(g => g.classification === 'alliance').length,
      soloAlliances: guilds.filter(g => g.classification === 'solo-alliance').length,
      members: guilds.filter(g => g.classification === 'member').length,
      independent: guilds.filter(g => g.classification === 'independent').length,
      unclassified: guilds.filter(g => !g.classification).length,
    }
  }, [guilds])

  const getClassificationBadge = (classification?: string) => {
    if (!classification) {
      return <Badge variant="outline">Unclassified</Badge>
    }
    const variants: Record<string, any> = {
      alliance: 'default',
      'solo-alliance': 'default',
      member: 'secondary',
      independent: 'outline',
    }
    const labels: Record<string, string> = {
      'solo-alliance': 'Solo Alliance',
      alliance: 'Alliance',
      member: 'Member',
      independent: 'Independent',
    }
    return <Badge variant={variants[classification]}>{labels[classification] || classification}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <>
      <AdminSubNav />
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Guild Management</h1>
          <p className="text-muted-foreground mt-1">
            Search and edit guild classifications and relationships
          </p>
        </div>
        <Button onClick={() => setSearchModalOpen(true)} disabled={addingGuild}>
          <Plus className="h-4 w-4 mr-2" />
          Add Guild
        </Button>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Solo Alliances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.soloAlliances}</div>
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
                <SelectItem value="solo-alliance">Solo Alliance</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
                <SelectItem value="unclassified">Unclassified</SelectItem>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGuilds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                description: updatedGuild.description,
                contact_info: updatedGuild.contact_info,
                recruitment_status: updatedGuild.recruitment_status,
                primetimeTimezones: updatedGuild.primetimeTimezones,
                notes: updatedGuild.notes,
                updatedBy: user?.getUsername() || 'admin',
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

      {/* Guild Search Modal for adding guilds */}
      <GuildSearchModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        onGuildSelected={handleAddGuild}
      />
    </div>
    </>
  )
}
