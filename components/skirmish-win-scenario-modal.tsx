'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface SkirmishWinScenarioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamColor: 'red' | 'blue' | 'green'
  teamName: string
  requiredPPT: number
  currentPPT: number
  maxAchievablePPT: number
  pointsBehind: number
  ticksRemaining: number
  maxAchievableData: {
    maxPPT: number
    currentPPT: number
    potentialGain: number
    breakdown: {
      current: { camps: number; towers: number; keeps: number; castles: number }
      capturable: { camps: number; towers: number; keeps: number; castles: number }
    }
  }
}

const colorClasses = {
  red: {
    text: 'text-chart-1',
    bg: 'bg-chart-1/10',
    border: 'border-chart-1',
  },
  blue: {
    text: 'text-chart-2',
    bg: 'bg-chart-2/10',
    border: 'border-chart-2',
  },
  green: {
    text: 'text-chart-3',
    bg: 'bg-chart-3/10',
    border: 'border-chart-3',
  },
}

export function SkirmishWinScenarioModal({
  open,
  onOpenChange,
  teamColor,
  teamName,
  requiredPPT,
  currentPPT,
  maxAchievablePPT,
  pointsBehind,
  ticksRemaining,
  maxAchievableData,
}: SkirmishWinScenarioModalProps) {
  const classes = colorClasses[teamColor]
  const pptNeeded = requiredPPT - currentPPT
  const canWin = requiredPPT <= maxAchievablePPT
  const pptGap = requiredPPT - maxAchievablePPT

  const timeRemaining = ticksRemaining * 5 // minutes

  // Calculate immediate points available from capturing objectives (flip points)
  const flipPoints = maxAchievableData.potentialGain

  // Calculate leader's PPT (derived from requiredPPT calculation)
  // requiredPPT = leaderPPT + ceil((pointsBehind + 1) / ticksRemaining)
  // Therefore: leaderPPT = requiredPPT - ceil((pointsBehind + 1) / ticksRemaining)
  const pptDifferentialNeeded = Math.ceil((pointsBehind + 1) / ticksRemaining)
  const leaderPPT = requiredPPT - pptDifferentialNeeded

  // Calculate NET points from ticks remaining (relative to leader)
  // This accounts for both our gains AND the leader's gains
  const pointsFromTicks = (maxAchievablePPT - leaderPPT) * ticksRemaining

  // Calculate gap that needs to be filled beyond objectives
  const totalObjectivePoints = flipPoints + pointsFromTicks
  const pointsGap = pointsBehind - totalObjectivePoints

  // Calculate how many kills/dolyaks needed to bridge the gap
  const killsNeeded = pointsGap > 0 ? Math.ceil(pointsGap / 3) : 0
  const dolyakKillsNeeded = pointsGap > 0 ? Math.ceil(pointsGap / 1) : 0
  const dolyakEscortsNeeded = pointsGap > 0 ? Math.ceil(pointsGap / 1) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={classes.text}>Path to Victory: {teamName}</span>
          </DialogTitle>
          <DialogDescription>
            Analysis of {teamName}'s options to win this skirmish through objective control
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <Card className={`${classes.bg} border ${classes.border}`}>
            <CardHeader>
              <CardTitle className="text-base">Scenario Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Points Behind</div>
                  <div className="text-2xl font-bold font-mono">{pointsBehind}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time Remaining</div>
                  <div className="text-2xl font-bold font-mono">
                    {Math.floor(timeRemaining / 60)}h {timeRemaining % 60}m
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Current PPT</div>
                  <div className="text-2xl font-bold font-mono">{currentPPT}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Required PPT</div>
                  <div className="text-2xl font-bold font-mono">{requiredPPT}</div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>PPT Gap to Close</span>
                  <span className="font-mono font-semibold">{pptNeeded} PPT</span>
                </div>
                <Progress
                  value={canWin ? 100 : (maxAchievablePPT / requiredPPT) * 100}
                  className={`h-2 progress-${teamColor}`}
                />
              </div>

              {canWin ? (
                <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <div className="text-sm font-medium text-green-600 dark:text-green-400">
                    ✓ Required PPT achievable - Can gain up to {maxAchievableData.potentialGain} PPT by capturing objectives
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                    ✗ Required PPT not achievable - Short by {Math.abs(pptGap)} PPT even if all objectives captured
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    However, victory may still be possible through flip points and/or kills (see below)
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current PPT Breakdown */}
          <Card className="panel-border inset-card">
            <CardHeader>
              <CardTitle className="text-base">Current PPT from Held Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(maxAchievableData.breakdown.current).map(([type, ppt]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{type}</span>
                    <Badge variant="outline" className="font-mono">
                      {ppt} PPT
                    </Badge>
                  </div>
                ))}
                <div className="pt-2 border-t flex items-center justify-between font-semibold">
                  <span>Total Current</span>
                  <Badge variant="outline" className={`${classes.text} ${classes.border} font-mono`}>
                    {maxAchievableData.currentPPT} PPT
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capturable PPT */}
          <Card className="panel-border inset-card">
            <CardHeader>
              <CardTitle className="text-base">Potential PPT from Capturable Objectives</CardTitle>
              <DialogDescription>
                PPT values shown are for newly captured objectives (Tier 0). Note: Capturing objectives also awards immediate flip points equal to the PPT value shown.
              </DialogDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(maxAchievableData.breakdown.capturable).map(([type, ppt]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{type}</span>
                    <Badge variant="outline" className="font-mono">
                      +{ppt} PPT
                    </Badge>
                  </div>
                ))}
                <div className="pt-2 border-t flex items-center justify-between font-semibold">
                  <span>Total Capturable</span>
                  <Badge variant="secondary" className="font-mono">
                    +{maxAchievableData.potentialGain} PPT
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Scoring Avenues */}
          <Card className="panel-border inset-card">
            <CardHeader>
              <CardTitle className="text-base">All Available Scoring Avenues</CardTitle>
              <DialogDescription>
                Breakdown of all point-scoring opportunities within the remaining time
              </DialogDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Flip Points (Capturing Objectives)</div>
                    <div className="text-xs text-muted-foreground">One-time points awarded when capturing enemy objectives</div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    +{flipPoints} pts
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Per-Tick Points (Sustained)</div>
                    <div className="text-xs text-muted-foreground">Net points gained relative to leader over {ticksRemaining} ticks</div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    +{pointsFromTicks} pts
                  </Badge>
                </div>

                {pointsGap > 0 && (
                  <>
                    <div className="pt-2 border-t">
                      <div className="text-sm font-medium mb-2">Additional Points Needed: {pointsGap}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Player Kills</div>
                        <div className="text-xs text-muted-foreground">3 points per kill</div>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {killsNeeded} kills needed
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Dolyak Kills</div>
                        <div className="text-xs text-muted-foreground">1 point per kill</div>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {dolyakKillsNeeded} kills needed
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Dolyak Escorts</div>
                        <div className="text-xs text-muted-foreground">1 point per escort</div>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {dolyakEscortsNeeded} escorts needed
                      </Badge>
                    </div>
                  </>
                )}

                <div className="pt-3 border-t flex items-center justify-between font-semibold">
                  <span>Total Available (Objective-based)</span>
                  <Badge variant="secondary" className="font-mono">
                    {flipPoints + pointsFromTicks} pts
                  </Badge>
                </div>

                <div className="pt-2">
                  <div className={`p-3 rounded-md ${pointsGap <= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                    <div className={`text-sm font-medium ${pointsGap <= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {pointsGap <= 0 ? (
                        <>✓ Victory achievable through objectives alone ({totalObjectivePoints} pts available vs {pointsBehind} needed)</>
                      ) : (
                        <>⚠ Need {killsNeeded} kills OR {dolyakKillsNeeded} dolyak kills OR {dolyakEscortsNeeded} escorts (or combination) beyond objectives</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maximum Achievable PPT */}
          <Card className={`${classes.bg} border ${classes.border}`}>
            <CardHeader>
              <CardTitle className="text-base">Maximum Achievable PPT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Current ({maxAchievableData.currentPPT}) + Capturable ({maxAchievableData.potentialGain})
                  </div>
                </div>
                <div className="text-3xl font-bold font-mono">
                  {maxAchievablePPT} PPT
                </div>
              </div>

              {canWin && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>
                    <strong>Strategy:</strong> Capture enough objectives to gain {pptNeeded} PPT and hold them for the remaining {ticksRemaining} ticks ({timeRemaining} minutes)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
