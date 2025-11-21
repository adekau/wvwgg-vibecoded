'use client'

import { useState } from 'react'
import type {
  Build,
  ItemStat,
  OptimizationGoal,
  OptimizationOptions,
  BaseStats,
  GearSelection,
} from '@/lib/gw2/types'
import { optimizeGear, getOptimizationPresets } from '@/lib/gw2/gear-optimizer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Sparkles, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GearOptimizerProps {
  open: boolean
  onClose: () => void
  build: Build
  itemStats: ItemStat[]
  onApplyGear: (gear: GearSelection) => void
}

type OptimizationState = 'idle' | 'optimizing' | 'success' | 'error'

/**
 * GearOptimizer - Modal for optimizing gear selection
 */
export function GearOptimizer({
  open,
  onClose,
  build,
  itemStats,
  onApplyGear,
}: GearOptimizerProps) {
  const [state, setState] = useState<OptimizationState>('idle')
  const [selectedPreset, setSelectedPreset] = useState('maximize-ep')
  const [result, setResult] = useState<any>(null)

  const presets = getOptimizationPresets()

  const handleOptimize = async () => {
    // Update UI state immediately to prevent INP issues
    setState('optimizing')
    setResult(null)

    // Defer expensive computation to next frame to allow UI to paint
    await new Promise(resolve => setTimeout(resolve, 0))

    // Get the selected goal
    const preset = presets.find(p => p.goal.type === selectedPreset)
    if (!preset) {
      setState('error')
      setResult({ message: 'Invalid optimization goal' })
      return
    }

    // Run optimization
    const options: OptimizationOptions = {
      allowedRarities: ['Ascended'], // Only ascended for now
      useInfusions: false,
      includeFood: false,
      includeUtility: false,
    }

    try {
      const optimizationResult = await optimizeGear(
        build,
        itemStats,
        preset.goal,
        options
      )

      setResult(optimizationResult)

      if (optimizationResult.success) {
        setState('success')
      } else {
        setState('error')
      }
    } catch (error) {
      setState('error')
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Optimization failed',
      })
    }
  }

  const handleApply = () => {
    if (result?.gear) {
      onApplyGear(result.gear)
      onClose()
    }
  }

  const handleReset = () => {
    setState('idle')
    setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gear Optimizer
          </DialogTitle>
          <DialogDescription>
            Automatically find the best stat combinations for your build
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Optimization Goal Selection */}
          {state === 'idle' && (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Optimization Goal</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose what you want to maximize
                  </p>
                </div>

                <RadioGroup value={selectedPreset} onValueChange={setSelectedPreset}>
                  <div className="space-y-2">
                    {presets.map((preset) => (
                      <Label
                        key={preset.goal.type}
                        htmlFor={preset.goal.type}
                        className={cn(
                          'flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                          selectedPreset === preset.goal.type
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <RadioGroupItem
                          value={preset.goal.type}
                          id={preset.goal.type}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-semibold">{preset.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {preset.description}
                          </div>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleOptimize} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Optimize
                </Button>
              </div>
            </>
          )}

          {/* Optimizing State */}
          {state === 'optimizing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <div className="font-semibold">Optimizing...</div>
                <div className="text-sm text-muted-foreground">
                  Finding the best gear combination
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && result && (
            <>
              <Alert className="border-primary bg-primary/5">
                <Sparkles className="w-4 h-4" />
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>

              {/* Stats Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>Improvement</CardTitle>
                  <CardDescription>
                    Comparison with your current gear
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatComparison
                    label="Effective Power (EP)"
                    change={result.improvements.effectivePower}
                    format="number"
                  />
                  <StatComparison
                    label="Effective Health (EH)"
                    change={result.improvements.effectiveHealth}
                    format="number"
                  />
                  <StatComparison
                    label="Bruiser Score (EP × EH)"
                    change={result.improvements.effectiveHealthPower}
                    format="million"
                  />
                </CardContent>
              </Card>

              {/* Optimized Gear Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Optimized Gear</CardTitle>
                  <CardDescription>
                    Stat combinations selected by optimizer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GearPreview gear={result.gear} itemStats={itemStats} />
                </CardContent>
              </Card>

              {result.solveTime && (
                <div className="text-xs text-center text-muted-foreground">
                  Solved in {result.solveTime}ms using MILP optimization
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Try Different Goal
                </Button>
                <Button onClick={handleApply} className="flex-1">
                  Apply to Build
                </Button>
              </div>
            </>
          )}

          {/* Error State */}
          {state === 'error' && result && (
            <>
              <Alert variant="destructive">
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Stat comparison display
 */
function StatComparison({
  label,
  change,
  format = 'number',
}: {
  label: string
  change: number
  format?: 'number' | 'percent' | 'million'
}) {
  const isPositive = change > 0
  const isZero = Math.abs(change) < 0.01

  let displayValue = ''
  if (format === 'number') {
    displayValue = change.toLocaleString(undefined, { maximumFractionDigits: 0 })
  } else if (format === 'percent') {
    displayValue = `${change.toFixed(1)}%`
  } else if (format === 'million') {
    displayValue = `${(change / 1_000_000).toFixed(2)}M`
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {!isZero && (
          <>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span
              className={cn(
                'text-sm font-mono font-semibold',
                isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {isPositive ? '+' : ''}
              {displayValue}
            </span>
          </>
        )}
        {isZero && <span className="text-sm text-muted-foreground">No change</span>}
      </div>
    </div>
  )
}

/**
 * Gear preview showing selected stat combinations
 */
function GearPreview({ gear, itemStats }: { gear: GearSelection; itemStats: ItemStat[] }) {
  const getStatName = (statId: number) => {
    return itemStats.find(s => s.id === statId)?.name || 'Unknown'
  }

  // Count stat occurrences
  const statCounts = new Map<number, number>()
  const gearPieces = Object.values(gear).filter(
    piece => piece && typeof piece === 'object' && 'statId' in piece
  )

  for (const piece of gearPieces) {
    if ('statId' in piece) {
      const count = statCounts.get(piece.statId) || 0
      statCounts.set(piece.statId, count + 1)
    }
  }

  // Sort by count (descending)
  const sortedStats = Array.from(statCounts.entries())
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-2">
      {sortedStats.map(([statId, count]) => (
        <div key={statId} className="flex items-center justify-between text-sm">
          <span className="font-medium">{getStatName(statId)}</span>
          <span className="text-muted-foreground">{count} pieces</span>
        </div>
      ))}
      {sortedStats.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No gear optimized
        </div>
      )}
    </div>
  )
}
