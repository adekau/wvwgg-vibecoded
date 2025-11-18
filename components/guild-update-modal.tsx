'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, AlertTriangle, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { IGuild } from '@/server/queries'

interface GuildUpdateModalProps {
  guild?: IGuild | { id: string; name: string; tag: string }
  allGuilds: IGuild[]
  open: boolean
  onClose: () => void
  onSuccess: () => void
  addNew?: boolean
}

export function GuildUpdateModal({ guild, allGuilds, open, onClose, onSuccess, addNew = false }: GuildUpdateModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [allianceGuildId, setAllianceGuildId] = useState('')
  const [allianceSearch, setAllianceSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

  const allianceGuilds = useMemo(() => {
    return allGuilds.filter(g =>
      ((g as any).classification === 'alliance' || !g.id.includes(guild?.id || '')) &&
      g.id !== guild?.id &&
      (g.name.toLowerCase().includes(allianceSearch.toLowerCase()) ||
       g.tag.toLowerCase().includes(allianceSearch.toLowerCase()))
    ).slice(0, 10)
  }, [allGuilds, guild?.id, allianceSearch])

  const selectedAlliance = allGuilds.find(g => g.id === allianceGuildId)

  const handleSubmit = async () => {
    setError('')

    if (!apiKey) {
      setError('API key is required')
      return
    }

    if (!accepted) {
      setError('You must accept the terms to continue')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/guilds/verify-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: guild?.id,
          apiKey,
          allianceGuildId: allianceGuildId || undefined,
          addNew,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to verify ownership')
        return
      }

      // Clear API key immediately
      setApiKey('')
      setShowApiKey(false)

      onSuccess()
      onClose()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setApiKey('')
    setShowApiKey(false)
    setAllianceGuildId('')
    setAllianceSearch('')
    setError('')
    setAccepted(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {addNew ? 'Add Your Guild' : 'Update Guild Information'}
          </DialogTitle>
          <DialogDescription>
            {addNew
              ? 'Verify your guild leadership to add your guild to the database'
              : 'Verify your guild leadership to update guild information'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Security Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">Important Security Information</div>
              <ul className="space-y-1 text-xs">
                <li>• Your API key is used only for verification and is <strong>never stored</strong></li>
                <li>• Your API key is <strong>never logged</strong> on our servers</li>
                <li>• You must be the <strong>guild leader</strong> to update information</li>
                <li>• Your API key must have the <strong>"guilds" permission</strong></li>
                <li>• We will fetch and update your guild's member count</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* How to get API key */}
          <Alert>
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">How to get an API key</div>
              <ol className="space-y-1 text-xs list-decimal list-inside">
                <li>Visit the <a
                  href="https://account.arena.net/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  ArenaNet Application Management page
                  <ExternalLink className="h-3 w-3" />
                </a></li>
                <li>Create a new API key with at least the <strong>"guilds"</strong> permission</li>
                <li>Copy the key and paste it below</li>
                <li>After verification, you can delete the API key if desired</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">GuildWars 2 API Key *</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXXXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={submitting}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required permissions: guilds
            </p>
          </div>

          {/* Alliance Selection */}
          <div className="space-y-2">
            <Label>Alliance (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select which alliance your guild belongs to, or leave blank if independent
            </p>
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
                  disabled={submitting}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <Select value={allianceSearch} onValueChange={(value) => {
                const guild = allGuilds.find(g => g.id === value)
                if (guild) {
                  setAllianceGuildId(guild.id)
                  setAllianceSearch('')
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Search for alliance guild..." />
                </SelectTrigger>
                <SelectContent>
                  <Input
                    placeholder="Type to search..."
                    value={allianceSearch}
                    onChange={(e) => setAllianceSearch(e.target.value)}
                    className="mb-2"
                  />
                  {allianceGuilds.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {g.tag}
                        </Badge>
                        <span>{g.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Acceptance Checkbox */}
          <div className="flex items-start gap-3 p-4 rounded-md bg-muted/50 border">
            <input
              type="checkbox"
              id="accept"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={submitting}
              className="mt-1"
            />
            <label htmlFor="accept" className="text-sm cursor-pointer">
              I understand that my API key will be used to verify my guild leadership and fetch member count.
              I confirm that my API key has the required "guilds" permission and that I am the guild leader of {guild?.name} [{guild?.tag}].
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !accepted}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
