import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'
import { getRatingTier } from '@/lib/glicko2'
import { getRatingSummary } from '@/lib/glicko-match-predictor'
import type { IGuild } from '@/server/queries'

interface RatingLeaderboardCompactProps {
  guilds: IGuild[]
  limit?: number
  title?: string
  description?: string
  showWorld?: boolean
}

export function RatingLeaderboardCompact({
  guilds,
  limit = 10,
  title = 'Top Rated Guilds',
  description = 'Highest Glicko-2 ratings',
  showWorld = true
}: RatingLeaderboardCompactProps) {
  // Filter and sort guilds by rating
  const rankedGuilds = guilds
    .filter(guild =>
      guild.classification === 'alliance' &&
      guild.glickoRating &&
      guild.glickoRating.matchCount &&
      guild.glickoRating.matchCount > 0
    )
    .sort((a, b) => (b.glickoRating?.rating || 0) - (a.glickoRating?.rating || 0))
    .slice(0, limit)

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Award className="h-5 w-5 text-orange-500" />
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rankedGuilds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No rated guilds found
            </div>
          ) : (
            rankedGuilds.map((guild, index) => {
              const rank = index + 1
              const tier = getRatingTier(guild.glickoRating!.rating)
              const summary = getRatingSummary(guild.glickoRating!)

              return (
                <div
                  key={guild.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8">
                    {rank <= 3 ? (
                      getRankIcon(rank)
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        #{rank}
                      </span>
                    )}
                  </div>

                  {/* Guild Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {guild.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        [{guild.tag}]
                      </span>
                    </div>
                    {showWorld && guild.worldId && (
                      <div className="text-xs text-muted-foreground">
                        World ID: {guild.worldId}
                      </div>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="text-right">
                    <div className="font-mono font-bold" style={{ color: tier.color }}>
                      {summary.rating}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5"
                      style={{
                        color: tier.color,
                        borderColor: tier.color + '50',
                        backgroundColor: tier.color + '10'
                      }}
                    >
                      {tier.tier}
                    </Badge>
                  </div>

                  {/* Match Count */}
                  <div className="text-right w-16">
                    <div className="text-xs text-muted-foreground">
                      {summary.matchCount} {summary.matchCount === 1 ? 'match' : 'matches'}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface RatingDistributionProps {
  guilds: IGuild[]
  className?: string
}

export function RatingDistribution({ guilds, className = '' }: RatingDistributionProps) {
  // Count guilds in each tier
  const ratedGuilds = guilds.filter(
    guild =>
      guild.classification === 'alliance' &&
      guild.glickoRating &&
      guild.glickoRating.matchCount &&
      guild.glickoRating.matchCount > 0
  )

  const tierCounts = {
    Legendary: 0,
    Diamond: 0,
    Platinum: 0,
    Gold: 0,
    Silver: 0,
    Bronze: 0,
    Iron: 0,
  }

  const tierColors = {
    Legendary: '#FF9500',
    Diamond: '#B9F2FF',
    Platinum: '#00D4AA',
    Gold: '#FFD700',
    Silver: '#C0C0C0',
    Bronze: '#CD7F32',
    Iron: '#808080',
  }

  ratedGuilds.forEach(guild => {
    if (guild.glickoRating) {
      const tier = getRatingTier(guild.glickoRating.rating)
      tierCounts[tier.tier as keyof typeof tierCounts]++
    }
  })

  const total = ratedGuilds.length
  const tiers = Object.keys(tierCounts) as (keyof typeof tierCounts)[]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
        <CardDescription>
          {total} rated alliance guilds
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tiers.map(tier => {
            const count = tierCounts[tier]
            const percentage = total > 0 ? (count / total) * 100 : 0

            return (
              <div key={tier}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      style={{
                        color: tierColors[tier],
                        borderColor: tierColors[tier] + '50',
                        backgroundColor: tierColors[tier] + '10'
                      }}
                    >
                      {tier}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: tierColors[tier]
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
