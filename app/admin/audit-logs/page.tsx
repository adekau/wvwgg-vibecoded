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
import { Search, Loader2, History, Filter } from 'lucide-react'

interface AuditLogEntry {
  timestamp: number
  actor: string
  action: string
  changes: Record<string, { from: any; to: any }>
}

interface GuildWithAudit {
  id: string
  name: string
  tag: string
  auditLog?: AuditLogEntry[]
}

interface FlattenedAuditEntry extends AuditLogEntry {
  guildId: string
  guildName: string
  guildTag: string
}

export default function AuditLogsPage() {
  const [guilds, setGuilds] = useState<GuildWithAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actorFilter, setActorFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const fetchAuditLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/guilds')
      if (response.ok) {
        const data = await response.json()
        setGuilds(data.guilds || [])
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Flatten all audit logs with guild info
  const allAuditLogs = useMemo(() => {
    const logs: FlattenedAuditEntry[] = []
    guilds.forEach(guild => {
      if (guild.auditLog && guild.auditLog.length > 0) {
        guild.auditLog.forEach(entry => {
          logs.push({
            ...entry,
            guildId: guild.id,
            guildName: guild.name,
            guildTag: guild.tag,
          })
        })
      }
    })
    // Sort by timestamp descending (newest first)
    return logs.sort((a, b) => b.timestamp - a.timestamp)
  }, [guilds])

  // Get unique actors for filter
  const uniqueActors = useMemo(() => {
    const actors = new Set<string>()
    allAuditLogs.forEach(log => actors.add(log.actor))
    return Array.from(actors).sort()
  }, [allAuditLogs])

  // Get unique actions for filter
  const uniqueActions = useMemo(() => {
    const actions = new Set<string>()
    allAuditLogs.forEach(log => actions.add(log.action))
    return Array.from(actions).sort()
  }, [allAuditLogs])

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return allAuditLogs.filter(log => {
      // Search filter (guild name, tag, or actor)
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        log.guildName.toLowerCase().includes(searchLower) ||
        log.guildTag.toLowerCase().includes(searchLower) ||
        log.actor.toLowerCase().includes(searchLower)

      // Actor filter
      const matchesActor = actorFilter === 'all' || log.actor === actorFilter

      // Action filter
      const matchesAction = actionFilter === 'all' || log.action === actionFilter

      return matchesSearch && matchesActor && matchesAction
    })
  }, [allAuditLogs, searchTerm, actorFilter, actionFilter])

  // Paginate
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredLogs.slice(startIndex, endIndex)
  }, [filteredLogs, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)

  const formatChanges = (changes: Record<string, { from: any; to: any }>) => {
    return Object.entries(changes).map(([field, change]) => (
      <div key={field} className="text-xs">
        <span className="font-medium">{field}:</span>{' '}
        <span className="text-muted-foreground line-through">
          {JSON.stringify(change.from) === 'null' ? 'none' : JSON.stringify(change.from)}
        </span>{' '}
        → <span>{JSON.stringify(change.to) === 'null' ? 'none' : JSON.stringify(change.to)}</span>
      </div>
    ))
  }

  const getActionBadge = (action: string) => {
    const variants: Record<string, any> = {
      'update': 'default',
      'public-update': 'secondary',
      'create': 'outline',
      'guild-created': 'default',
      'admin-created': 'default',
      'delete': 'destructive',
    }
    return <Badge variant={variants[action] || 'outline'}>{action}</Badge>
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            View all guild changes and modifications
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allAuditLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Actors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueActors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Action Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueActions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Guilds Modified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {guilds.filter(g => g.auditLog && g.auditLog.length > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Search and filter audit log entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by guild name, tag, or actor..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>
            <Select value={actorFilter} onValueChange={(value) => {
              setActorFilter(value)
              setCurrentPage(1)
            }}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Actors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actors</SelectItem>
                {uniqueActors.map(actor => (
                  <SelectItem key={actor} value={actor}>{actor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(value) => {
              setActionFilter(value)
              setCurrentPage(1)
            }}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Audit Log Entries ({filteredLogs.length})
          </CardTitle>
          <CardDescription>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Guild</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log, idx) => (
                    <TableRow key={`${log.guildId}-${log.timestamp}-${idx}`}>
                      <TableCell className="text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.guildTag}
                          </Badge>
                          <span className="text-sm">{log.guildName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.actor}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {formatChanges(log.changes)}
                        </div>
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
                Page {currentPage} of {totalPages}
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
    </div>
  )
}
