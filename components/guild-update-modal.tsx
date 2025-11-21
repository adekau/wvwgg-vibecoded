'use client'

import { useState } from 'react'
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
  const [description, setDescription] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [recruitmentStatus, setRecruitmentStatus] = useState<'open' | 'closed' | 'by_application'>('closed')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

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
          description: description || undefined,
          contact_info: contactInfo || undefined,
          recruitment_status: recruitmentStatus,
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
    setDescription('')
    setContactInfo('')
    setRecruitmentStatus('closed')
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

          {/* Guild Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Guild Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter a description for your guild..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <Label htmlFor="contactInfo">Contact Information (Optional)</Label>
            <Input
              id="contactInfo"
              type="text"
              placeholder="Discord server, website, or other contact info..."
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              disabled={submitting}
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
