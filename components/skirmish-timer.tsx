'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface SkirmishTimerProps {
  matchStartDate: string
}

export function SkirmishTimer({ matchStartDate }: SkirmishTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [skirmishNumber, setSkirmishNumber] = useState<number>(0)

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const matchStart = new Date(matchStartDate)

      // Calculate elapsed time since match start
      const elapsedMs = now.getTime() - matchStart.getTime()
      const elapsedHours = elapsedMs / (1000 * 60 * 60)

      // Each skirmish is 2 hours
      const currentSkirmish = Math.floor(elapsedHours / 2) + 1

      // Calculate time until next skirmish
      const nextSkirmishTime = new Date(matchStart.getTime() + (currentSkirmish * 2 * 60 * 60 * 1000))
      const timeUntilNext = nextSkirmishTime.getTime() - now.getTime()

      if (timeUntilNext <= 0) {
        setTimeLeft('Calculating...')
        setSkirmishNumber(currentSkirmish)
        return
      }

      // Format time left
      const hours = Math.floor(timeUntilNext / (1000 * 60 * 60))
      const minutes = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeUntilNext % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`)
      setSkirmishNumber(currentSkirmish)
    }

    // Update immediately
    updateTimer()

    // Update every second
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [matchStartDate])

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Current Skirmish</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              #{skirmishNumber}
            </Badge>
            <span className="text-sm font-medium tabular-nums">{timeLeft}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
