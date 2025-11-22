'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { OptimizedBuild, TargetStats } from '@/lib/gw2/gear-optimizer'

export default function SimpleOptimizerPage() {
  const [targetStats, setTargetStats] = useState<TargetStats>({
    power: 3000,
    precision: 2100,
    ferocity: 1500,
    vitality: 1200,
    toughness: 1000
  })

  const [optimizedBuild, setOptimizedBuild] = useState<OptimizedBuild | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOptimize = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/optimize-gear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetStats)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to optimize gear')
      }

      const build: OptimizedBuild = await response.json()
      setOptimizedBuild(build)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleStatChange = (stat: keyof TargetStats, value: string) => {
    const numValue = parseInt(value) || undefined
    setTargetStats(prev => ({ ...prev, [stat]: numValue }))
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Simple Gear Optimizer</h1>
        <p className="text-muted-foreground">
          Enter your target stats and we'll find the best gear combination to match them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target Stats</CardTitle>
          <CardDescription>
            Enter the stats you want to achieve. Leave blank to ignore a stat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="power">Power</Label>
              <Input
                id="power"
                type="number"
                value={targetStats.power || ''}
                onChange={(e) => handleStatChange('power', e.target.value)}
                placeholder="e.g., 3000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precision">Precision</Label>
              <Input
                id="precision"
                type="number"
                value={targetStats.precision || ''}
                onChange={(e) => handleStatChange('precision', e.target.value)}
                placeholder="e.g., 2100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ferocity">Ferocity</Label>
              <Input
                id="ferocity"
                type="number"
                value={targetStats.ferocity || ''}
                onChange={(e) => handleStatChange('ferocity', e.target.value)}
                placeholder="e.g., 1500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vitality">Vitality</Label>
              <Input
                id="vitality"
                type="number"
                value={targetStats.vitality || ''}
                onChange={(e) => handleStatChange('vitality', e.target.value)}
                placeholder="e.g., 1200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="toughness">Toughness</Label>
              <Input
                id="toughness"
                type="number"
                value={targetStats.toughness || ''}
                onChange={(e) => handleStatChange('toughness', e.target.value)}
                placeholder="e.g., 1000"
              />
            </div>
          </div>

          <Button onClick={handleOptimize} disabled={loading} className="w-full">
            {loading ? 'Optimizing...' : 'Find Best Gear'}
          </Button>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {optimizedBuild && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Total Stats</CardTitle>
              <CardDescription>
                Distance from target: {optimizedBuild.distance.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(optimizedBuild.totalStats).map(([stat, value]) => (
                  <div key={stat} className="space-y-1">
                    <div className="text-sm text-muted-foreground capitalize">{stat}</div>
                    <div className="text-2xl font-bold">{Math.round(value)}</div>
                    {optimizedBuild.targetStats[stat as keyof TargetStats] && (
                      <div className="text-xs text-muted-foreground">
                        Target: {optimizedBuild.targetStats[stat as keyof TargetStats]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended Gear</CardTitle>
              <CardDescription>
                All slots use Ascended quality gear with these stat combinations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {optimizedBuild.slots.map((slot, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                  >
                    <div className="font-medium">{slot.slot}</div>
                    <div className="text-lg font-bold">{slot.statName}</div>
                    <div className="text-sm text-muted-foreground">
                      {Object.entries(slot.stats)
                        .map(([stat, value]) => `+${Math.round(value)} ${stat}`)
                        .join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
