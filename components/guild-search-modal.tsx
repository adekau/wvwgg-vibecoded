'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GuildSearchResult {
  id: string
  name: string
  tag: string
  level?: number
}

interface GuildSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuildSelected: (guildId: string) => void
}

export function GuildSearchModal({ open, onOpenChange, onGuildSelected }: GuildSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<GuildSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a guild name')
      return
    }

    setSearching(true)
    setError(null)
    setResults([])

    try {
      // Step 1: Search for guild IDs by name
      const searchResponse = await fetch(
        `https://api.guildwars2.com/v2/guild/search?name=${encodeURIComponent(searchTerm)}`
      )

      if (!searchResponse.ok) {
        throw new Error('Failed to search for guilds')
      }

      const guildIds: string[] = await searchResponse.json()

      if (guildIds.length === 0) {
        setError('No guilds found with that name')
        setSearching(false)
        return
      }

      // Step 2: Fetch details for each guild ID
      const detailsPromises = guildIds.map(async (id) => {
        try {
          const detailsResponse = await fetch(`https://api.guildwars2.com/v2/guild/${id}`)
          if (detailsResponse.ok) {
            return await detailsResponse.json()
          }
          return null
        } catch {
          return null
        }
      })

      const guildDetails = (await Promise.all(detailsPromises)).filter(Boolean)

      if (guildDetails.length === 0) {
        setError('Failed to fetch guild details')
        setSearching(false)
        return
      }

      setResults(guildDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while searching')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectGuild = (guildId: string) => {
    onGuildSelected(guildId)
    onOpenChange(false)
    // Reset state
    setSearchTerm('')
    setResults([])
    setError(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !searching) {
      handleSearch()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Your Guild</DialogTitle>
          <DialogDescription>
            Search for your guild by name. You'll need to verify your leadership with an API key in the next step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="guild-search">Guild Name</Label>
            <div className="flex gap-2">
              <Input
                id="guild-search"
                placeholder="Enter guild name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={searching}
              />
              <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <Label>Search Results ({results.length})</Label>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {results.map((guild) => (
                  <Card
                    key={guild.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleSelectGuild(guild.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {guild.tag}
                          </Badge>
                          <div>
                            <div className="font-medium">{guild.name}</div>
                            {guild.level && (
                              <div className="text-xs text-muted-foreground">
                                Level {guild.level}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          Select →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Note:</strong> After selecting your guild, you'll need to provide a Guild Wars 2 API key with "guilds" permission to verify your leadership.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
