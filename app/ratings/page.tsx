import { Metadata } from 'next'
import { MatchesHeader } from '@/components/matches-header'
import { RatingsLeaderboard } from '@/components/ratings-leaderboard'

export const metadata: Metadata = {
  title: 'Alliance Guild Rankings | WvW.gg',
  description: 'View Glicko-2 ratings and rankings for Guild Wars 2 WvW alliance guilds',
}

export default function RatingsPage() {
  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Alliance Guild Rankings</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Glicko-2 skill ratings for WvW alliance guilds based on competitive performance
          </p>
        </div>

        <RatingsLeaderboard />
      </main>
    </div>
  )
}
