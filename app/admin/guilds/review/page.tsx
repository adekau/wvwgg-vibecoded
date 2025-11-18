'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Users,
} from 'lucide-react'

interface Guild {
  id: string
  name: string
  tag: string
  worldId: number
  classification: string | null
  isReviewed: boolean
}

export default function ReviewQueuePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [classification, setClassification] = useState<string>('independent')
  const [notes, setNotes] = useState('')
  const [reviewedCount, setReviewedCount] = useState(0)

  const currentGuild = guilds[currentIndex]

  useEffect(() => {
    fetchGuilds()
  }, [])

  const fetchGuilds = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/guilds?filter=unreviewed&limit=1000')
      const data = await response.json()
      setGuilds(data.guilds || [])
    } catch (error) {
      console.error('Failed to fetch guilds:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClassify = async () => {
    if (!currentGuild || !user) return

    try {
      setIsSaving(true)
      const response = await fetch(`/api/admin/guilds/${currentGuild.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification,
          notes: notes || undefined,
          reviewedBy: user.getUsername(),
        }),
      })

      if (response.ok) {
        setReviewedCount((prev) => prev + 1)
        // Move to next guild
        if (currentIndex < guilds.length - 1) {
          setCurrentIndex((prev) => prev + 1)
          setClassification('independent')
          setNotes('')
        } else {
          // All guilds reviewed!
          router.push('/admin/dashboard')
        }
      }
    } catch (error) {
      console.error('Failed to classify guild:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSkip = () => {
    if (currentIndex < guilds.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setClassification('independent')
      setNotes('')
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setClassification('independent')
      setNotes('')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
          <p className="text-muted-foreground">Loading guilds...</p>
        </div>
      </div>
    )
  }

  if (guilds.length === 0) {
    return (
      <div className="min-h-screen">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => router.push('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto panel-border text-center p-12">
            <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
            <p className="text-muted-foreground mb-6">
              There are no guilds pending review at this time.
            </p>
            <Button onClick={() => router.push('/admin/dashboard')}>
              Return to Dashboard
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/admin/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="font-mono">
              {currentIndex + 1} / {guilds.length}
            </Badge>
            <Badge variant="secondary">
              {reviewedCount} reviewed this session
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Current Guild Card */}
          <Card className="panel-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Shield className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{currentGuild.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono">
                        {currentGuild.tag}
                      </Badge>
                      <span className="text-sm">World ID: {currentGuild.worldId}</span>
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Classification */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Classification</Label>
                <RadioGroup value={classification} onValueChange={setClassification}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alliance" id="alliance" />
                    <Label htmlFor="alliance" className="font-normal cursor-pointer">
                      Alliance Guild
                      <span className="text-sm text-muted-foreground ml-2">
                        (Main guild that has member guilds)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="member" id="member" />
                    <Label htmlFor="member" className="font-normal cursor-pointer">
                      Member Guild
                      <span className="text-sm text-muted-foreground ml-2">
                        (Belongs to an alliance)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="independent" id="independent" />
                    <Label htmlFor="independent" className="font-normal cursor-pointer">
                      Independent Guild
                      <span className="text-sm text-muted-foreground ml-2">
                        (Not part of an alliance)
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this guild..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleClassify}
                  disabled={isSaving}
                  className="flex-1"
                  size="lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save & Next
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="outline"
                  disabled={isSaving}
                  size="lg"
                >
                  <X className="mr-2 h-4 w-4" />
                  Skip
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  onClick={handlePrevious}
                  variant="ghost"
                  disabled={currentIndex === 0 || isSaving}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="ghost"
                  disabled={currentIndex >= guilds.length - 1 || isSaving}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              {guilds.length - currentIndex - 1} guilds remaining in queue
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
