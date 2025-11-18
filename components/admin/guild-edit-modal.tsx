'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, X, Search } from 'lucide-react'
import { IGuild } from '@/server/queries'

interface AdminGuild extends IGuild {
  classification?: 'alliance' | 'member' | 'independent'
  allianceGuildId?: string
  memberGuildIds?: string[]
  notes?: string
  reviewed?: boolean
  reviewedAt?: number
  reviewedBy?: string
}

interface GuildEditModalProps {
  guild: AdminGuild | null
  allGuilds: AdminGuild[]
  open: boolean
  onClose: () => void
  onSave: (updatedGuild: AdminGuild) => Promise<void>
}

export function GuildEditModal({ guild, allGuilds, open, onClose, onSave }: GuildEditModalProps) {
  const [classification, setClassification] = useState<string>(guild?.classification || 'unclassified')
  const [allianceGuildId, setAllianceGuildId] = useState<string>(guild?.allianceGuildId || '')
  const [memberGuildIds, setMemberGuildIds] = useState<string[]>(guild?.memberGuildIds || [])
  const [notes, setNotes] = useState(guild?.notes || '')
  const [allianceSearch, setAllianceSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (guild) {
      setClassification(guild.classification || 'unclassified')
      setAllianceGuildId(guild.allianceGuildId || '')
      setMemberGuildIds(guild.memberGuildIds || [])
      setNotes(guild.notes || '')
      setAllianceSearch('')
      setMemberSearch('')
    }
  }, [guild])

  const allianceGuilds = useMemo(() => {
    return allGuilds.filter(g =>
      g.classification === 'alliance' &&
      g.id !== guild?.id &&
      (g.name.toLowerCase().includes(allianceSearch.toLowerCase()) ||
       g.tag.toLowerCase().includes(allianceSearch.toLowerCase()))
    ).slice(0, 10)
  }, [allGuilds, guild, allianceSearch])

  const memberCandidates = useMemo(() => {
    return allGuilds.filter(g =>
      g.id !== guild?.id &&
      !memberGuildIds.includes(g.id) &&
      (g.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
       g.tag.toLowerCase().includes(memberSearch.toLowerCase()))
    ).slice(0, 10)
  }, [allGuilds, guild, memberGuildIds, memberSearch])

  const selectedAlliance = allGuilds.find(g => g.id === allianceGuildId)
  const selectedMembers = allGuilds.filter(g => memberGuildIds.includes(g.id))

  const handleSave = async () => {
    if (!guild) return

    setSaving(true)
    try {
      const updatedGuild: AdminGuild = {
        ...guild,
        classification: classification === 'unclassified' ? undefined : classification as any,
        allianceGuildId: classification === 'member' ? allianceGuildId || undefined : undefined,
        memberGuildIds: classification === 'alliance' ? memberGuildIds : undefined,
        notes: notes || undefined,
      }

      await onSave(updatedGuild)
      onClose()
    } catch (error) {
      console.error('Error saving guild:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!guild) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Guild: {guild.name}</DialogTitle>
          <DialogDescription>
            [{guild.tag}] - Update classification and relationships
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Classification */}
          <div className="space-y-2">
            <Label htmlFor="classification">Classification</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger id="classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unclassified">Unclassified</SelectItem>
                <SelectItem value="alliance">Alliance</SelectItem>
                <SelectItem value="member">Member Guild</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {classification === 'alliance' && 'This guild is an alliance (e.g., [IRON])'}
              {classification === 'member' && 'This guild is a member of an alliance'}
              {classification === 'independent' && 'This guild operates independently'}
              {classification === 'unclassified' && 'Classification not yet determined'}
            </p>
          </div>

          {/* Alliance Link (for member guilds) */}
          {classification === 'member' && (
            <div className="space-y-2">
              <Label>Alliance</Label>
              {selectedAlliance ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <div className="flex-1">
                    <div className="font-medium">{selectedAlliance.name}</div>
                    <div className="text-sm text-muted-foreground">[{selectedAlliance.tag}]</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllianceGuildId('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search for alliance guild..."
                      value={allianceSearch}
                      onChange={(e) => setAllianceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {allianceSearch && allianceGuilds.length > 0 && (
                    <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                      {allianceGuilds.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            setAllianceGuildId(g.id)
                            setAllianceSearch('')
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{g.name}</div>
                            <div className="text-sm text-muted-foreground">[{g.tag}]</div>
                          </div>
                          {g.classification === 'alliance' && (
                            <Badge variant="default" className="text-xs">Alliance</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Member Guilds (for alliance guilds) */}
          {classification === 'alliance' && (
            <div className="space-y-2">
              <Label>Member Guilds</Label>
              {selectedMembers.length > 0 && (
                <div className="space-y-2 mb-2">
                  {selectedMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 p-2 border rounded-md">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-muted-foreground">[{member.tag}]</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMemberGuildIds(memberGuildIds.filter(id => id !== member.id))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search to add member guilds..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {memberSearch && memberCandidates.length > 0 && (
                  <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                    {memberCandidates.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setMemberGuildIds([...memberGuildIds, g.id])
                          setMemberSearch('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-accent"
                      >
                        <div className="font-medium">{g.name}</div>
                        <div className="text-sm text-muted-foreground">[{g.tag}]</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this guild..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
