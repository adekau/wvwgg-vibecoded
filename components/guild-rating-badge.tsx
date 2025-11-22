import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getRatingTier, type GlickoRating } from '@/lib/glicko2'
import { getRatingSummary } from '@/lib/glicko-match-predictor'

interface GuildRatingBadgeProps {
  rating: GlickoRating
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function GuildRatingBadge({
  rating,
  showDetails = false,
  size = 'md',
  className = ''
}: GuildRatingBadgeProps) {
  const tier = getRatingTier(rating.rating)
  const summary = getRatingSummary(rating)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  if (!showDetails) {
    return (
      <Badge
        variant="outline"
        className={`${sizeClasses[size]} ${className}`}
        style={{
          color: tier.color,
          borderColor: tier.color + '50',
          backgroundColor: tier.color + '10'
        }}
      >
        <TrendingUp className="h-3 w-3 mr-1" />
        {summary.rating}
      </Badge>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Badge
        variant="outline"
        style={{
          color: tier.color,
          borderColor: tier.color + '50',
          backgroundColor: tier.color + '10'
        }}
      >
        {tier.tier}
      </Badge>
      <div className="flex flex-col">
        <span className="font-mono font-bold" style={{ color: tier.color }}>
          {summary.displayRating}
        </span>
        <span className="text-xs text-muted-foreground">
          {summary.matchCount} matches • {summary.confidence} confidence
        </span>
      </div>
    </div>
  )
}

interface TeamRatingComparisonProps {
  teamName: string
  teamColor: 'red' | 'blue' | 'green'
  rating: GlickoRating
  opponentRating?: GlickoRating
  className?: string
}

const colorClasses = {
  red: {
    text: 'text-chart-1',
    bg: 'bg-chart-1/10',
    border: 'border-chart-1/30',
  },
  blue: {
    text: 'text-chart-2',
    bg: 'bg-chart-2/10',
    border: 'border-chart-2/30',
  },
  green: {
    text: 'text-chart-3',
    bg: 'bg-chart-3/10',
    border: 'border-chart-3/30',
  },
}

export function TeamRatingComparison({
  teamName,
  teamColor,
  rating,
  opponentRating,
  className = ''
}: TeamRatingComparisonProps) {
  const tier = getRatingTier(rating.rating)
  const summary = getRatingSummary(rating)

  // Calculate rating advantage if opponent rating provided
  let advantage: 'higher' | 'lower' | 'equal' | null = null
  let ratingDiff = 0

  if (opponentRating) {
    ratingDiff = rating.rating - opponentRating.rating
    if (Math.abs(ratingDiff) < 50) {
      advantage = 'equal'
    } else if (ratingDiff > 0) {
      advantage = 'higher'
    } else {
      advantage = 'lower'
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[teamColor].bg} ${colorClasses[teamColor].border} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className={`font-bold text-lg ${colorClasses[teamColor].text}`}>
            {teamName}
          </h3>
          <Badge
            variant="outline"
            className="mt-1"
            style={{
              color: tier.color,
              borderColor: tier.color + '50',
              backgroundColor: tier.color + '10'
            }}
          >
            {tier.tier}
          </Badge>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold" style={{ color: tier.color }}>
            {summary.rating}
          </div>
          <div className="text-xs text-muted-foreground">
            ± {Math.round(rating.ratingDeviation)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Confidence</div>
          <div className="font-medium">{summary.confidence}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Matches</div>
          <div className="font-medium">{summary.matchCount}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Volatility</div>
          <div className="font-medium">{rating.volatility.toFixed(3)}</div>
        </div>
      </div>

      {advantage && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            {advantage === 'higher' && (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">
                  +{Math.round(ratingDiff)} rating advantage
                </span>
              </>
            )}
            {advantage === 'lower' && (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {Math.round(ratingDiff)} rating disadvantage
                </span>
              </>
            )}
            {advantage === 'equal' && (
              <>
                <Minus className="h-4 w-4 text-yellow-500" />
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  Evenly matched ({Math.abs(Math.round(ratingDiff))})
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
