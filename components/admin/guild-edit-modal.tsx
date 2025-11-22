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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, X, Search, History } from 'lucide-react'
import { IGuild } from '@/server/queries'
import { normalizeForSearch } from '@/lib/utils'

// Common WvW primetime timezones
const PRIMETIME_TIMEZONES = [
  { value: 'America/New_York', label: 'NA East (ET)' },
  { value: 'America/Chicago', label: 'NA Central (CT)' },
  { value: 'America/Denver', label: 'NA Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'NA West (PT)' },
  { value: 'Europe/London', label: 'EU West (GMT/BST)' },
  { value: 'Europe/Paris', label: 'EU Central (CET)' },
  { value: 'Europe/Helsinki', label: 'EU East (EET)' },
  { value: 'Australia/Sydney', label: 'OCX East (AEDT)' },
  { value: 'Australia/Perth', label: 'OCX West (AWST)' },
  { value: 'Asia/Singapore', label: 'SEA (SGT)' },
]

interface AuditLogEntry {
  timestamp: number
  actor: string
  action: string
  changes: Record<string, { from: any; to: any }>
}

interface AdminGuild extends IGuild {
  classification?: 'alliance' | 'solo-alliance' | 'member' | 'independent' | null
  allianceGuildId?: string | null
  memberGuildIds?: string[] | null
  description?: string | null
  contact_info?: string | null
  recruitment_status?: 'open' | 'closed' | 'by_application' | null
  primetimeTimezones?: string[] | null
  notes?: string | null
  reviewed?: boolean
  reviewedAt?: number
  reviewedBy?: string
  auditLog?: AuditLogEntry[]
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
  const [description, setDescription] = useState(guild?.description || '')
  const [contactInfo, setContactInfo] = useState(guild?.contact_info || '')
  const [recruitmentStatus, setRecruitmentStatus] = useState<'open' | 'closed' | 'by_application'>(guild?.recruitment_status || 'closed')
  const [primetimeTimezones, setPrimetimeTimezones] = useState<string[]>(guild?.primetimeTimezones || [])
  const [notes, setNotes] = useState(guild?.notes || '')
  const [allianceSearch, setAllianceSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (guild) {
      setClassification(guild.classification || 'unclassified')
      setAllianceGuildId(guild.allianceGuildId || '')
      setMemberGuildIds(guild.memberGuildIds || [])
      setDescription(guild.description || '')
      setContactInfo(guild.contact_info || '')
      setRecruitmentStatus(guild.recruitment_status || 'closed')
      setPrimetimeTimezones(guild.primetimeTimezones || [])
      setNotes(guild.notes || '')
      setAllianceSearch('')
      setMemberSearch('')
    }
  }, [guild])

  const allianceGuilds = useMemo(() => {
    const normalizedSearch = normalizeForSearch(allianceSearch)
    return allGuilds.filter(g =>
      g.classification === 'alliance' &&
      g.id !== guild?.id &&
      (normalizeForSearch(g.name).includes(normalizedSearch) ||
       normalizeForSearch(g.tag).includes(normalizedSearch))
    ).slice(0, 10)
  }, [allGuilds, guild, allianceSearch])

  const memberCandidates = useMemo(() => {
    const normalizedSearch = normalizeForSearch(memberSearch)
    return allGuilds.filter(g =>
      g.id !== guild?.id &&
      !memberGuildIds.includes(g.id) &&
      (normalizeForSearch(g.name).includes(normalizedSearch) ||
       normalizeForSearch(g.tag).includes(normalizedSearch))
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
        classification: classification === 'unclassified' ? null as any : classification as any,
        allianceGuildId: classification === 'member' ? (allianceGuildId || null) : null,
        memberGuildIds: classification === 'alliance' ? memberGuildIds : null as any,
        description: description || null as any,
        contact_info: contactInfo || null as any,
        recruitment_status: recruitmentStatus || null as any,
        primetimeTimezones: primetimeTimezones.length > 0 ? primetimeTimezones : null as any,
        notes: notes || null as any,
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
                <SelectItem value="solo-alliance">Solo Alliance</SelectItem>
                <SelectItem value="member">Member Guild</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {classification === 'alliance' && 'This guild is an alliance with member guilds (e.g., [IRON])'}
              {classification === 'solo-alliance' && 'This guild operates as a solo alliance (no member guilds)'}
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
                          className="w-full px-3 py-2 text-left hover:bg-primary/10 hover:text-foreground transition-colors flex items-center justify-between"
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
                        className="w-full px-3 py-2 text-left hover:bg-primary/10 hover:text-foreground transition-colors"
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

          {/* Guild Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Guild Description</Label>
            <Textarea
              id="description"
              placeholder="Enter a description for the guild..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <Label htmlFor="contactInfo">Contact Information</Label>
            <Input
              id="contactInfo"
              type="text"
              placeholder="Discord server, website, or other contact info..."
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              e.g., Discord invite link, website URL, or in-game contact name
            </p>
          </div>

          {/* Recruitment Status */}
          <div className="space-y-2">
            <Label htmlFor="recruitmentStatus">Recruitment Status</Label>
            <Select value={recruitmentStatus} onValueChange={(value: 'open' | 'closed' | 'by_application') => setRecruitmentStatus(value)}>
              <SelectTrigger id="recruitmentStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open - Accepting all new members</SelectItem>
                <SelectItem value="by_application">By Application - Reviewing applications</SelectItem>
                <SelectItem value="closed">Closed - Not recruiting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Primetime Timezones */}
          <div className="space-y-2">
            <Label>Primetime Timezones</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select one or more timezones when this guild is most active
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-md">
              {PRIMETIME_TIMEZONES.map((tz) => (
                <div key={tz.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tz-${tz.value}`}
                    checked={primetimeTimezones.includes(tz.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPrimetimeTimezones([...primetimeTimezones, tz.value])
                      } else {
                        setPrimetimeTimezones(primetimeTimezones.filter(t => t !== tz.value))
                      }
                    }}
                  />
                  <label
                    htmlFor={`tz-${tz.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {tz.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Admin Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any admin notes about this guild..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Audit Log */}
          {guild.auditLog && guild.auditLog.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                Audit Log
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {[...guild.auditLog].reverse().map((entry, idx) => (
                  <div key={idx} className="text-sm p-3 rounded-md bg-muted/50 border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{entry.actor}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <div key={field} className="text-xs text-muted-foreground">
                        <span className="font-medium">{field}:</span>{' '}
                        <span className="line-through">{JSON.stringify(change.from)}</span>{' '}
                        → <span className="text-foreground">{JSON.stringify(change.to)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
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
