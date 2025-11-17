import { MatchesHeader } from '@/components/matches-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Trophy, Clock, Swords, Skull, TrendingUp, Activity } from 'lucide-react'

export default function LegendPage() {
  return (
    <div className="min-h-screen">
      <MatchesHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Legend &amp; Glossary</h1>
              <p className="text-muted-foreground">
                Understanding the symbols, terms, and visual indicators used throughout WvW.gg
              </p>
            </div>
          </div>

          {/* Visual Indicators */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Visual Indicators
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0">
                  <span className="bg-yellow-500/20 px-2 py-1 rounded font-mono text-sm">1,234</span>
                </div>
                <div>
                  <div className="font-semibold">Gold Highlight</div>
                  <div className="text-sm text-muted-foreground">
                    Indicates the highest value in that category among all servers. Used for stats like kills, deaths, K/D ratio, scores, and victory points.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0">
                  <div className="h-8 rounded border-2 border-red-500/30 bg-red-500/5 px-2 py-1 text-xs">Red</div>
                </div>
                <div>
                  <div className="font-semibold">Server Colors</div>
                  <div className="text-sm text-muted-foreground">
                    Each server is assigned a color: <span className="text-chart-1">Red</span>, <span className="text-chart-2">Blue</span>, or <span className="text-chart-3">Green</span>. Colors remain consistent throughout the match and are used in all visualizations.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0">
                  <Trophy className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <div className="font-semibold">Trophy Icon</div>
                  <div className="text-sm text-muted-foreground">
                    Marks the current leader in a match or category.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Live Indicator</div>
                  <div className="text-sm text-muted-foreground">
                    Green pulsing dot indicates real-time, actively updating match data.
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Medal Emojis */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4">Medal Emojis</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 text-2xl text-center">🥇</div>
                <div>
                  <div className="font-semibold">Gold Medal</div>
                  <div className="text-sm text-muted-foreground">First place by Victory Points</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 text-2xl text-center">🥈</div>
                <div>
                  <div className="font-semibold">Silver Medal</div>
                  <div className="text-sm text-muted-foreground">Second place by Victory Points</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 text-2xl text-center">🥉</div>
                <div>
                  <div className="font-semibold">Bronze Medal</div>
                  <div className="text-sm text-muted-foreground">Third place by Victory Points</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Activity Tier Indicators */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Activity Tier Indicators
            </h2>
            <div className="text-sm text-muted-foreground mb-4">
              Shown in skirmish lists and Prime Time Performance tables to indicate the expected activity level and Victory Point rewards. VP values vary by region and time of day.
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 text-xl text-center text-gray-500 flex-shrink-0">○</div>
                <div>
                  <div className="font-semibold">Low Activity</div>
                  <div className="text-sm text-muted-foreground">
                    NA: 19/16/13 VP • EU: 15/14/12 VP (1st/2nd/3rd place)
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-12 text-xl text-center text-blue-500 flex-shrink-0">◐</div>
                <div>
                  <div className="font-semibold">Medium Activity</div>
                  <div className="text-sm text-muted-foreground">
                    NA: 23/18/14 VP • EU: 22/18/14 VP
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-12 text-xl text-center text-orange-500 flex-shrink-0">◉</div>
                <div>
                  <div className="font-semibold">High Activity</div>
                  <div className="text-sm text-muted-foreground">
                    NA: 31/24/17 VP • EU: 31/24/17 VP
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-12 text-xl text-center text-purple-500 flex-shrink-0">⦿</div>
                <div>
                  <div className="font-semibold">Peak Hours</div>
                  <div className="text-sm text-muted-foreground">
                    NA: 43/32/21 VP • EU: 51/37/24 VP (highest activity periods)
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Icons Guide */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4">Stat Icons</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Swords className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-sm">Kills</div>
                  <div className="text-xs text-muted-foreground">Enemy players defeated</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skull className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-sm">Deaths</div>
                  <div className="text-xs text-muted-foreground">Times your team was defeated</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-sm">K/D Ratio</div>
                  <div className="text-xs text-muted-foreground">Kills divided by deaths</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-sm">Activity</div>
                  <div className="text-xs text-muted-foreground">Total combat engagement (kills + deaths)</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-sm">Victory Points</div>
                  <div className="text-xs text-muted-foreground">Points earned from skirmish placements</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-sm">Skirmish Timer</div>
                  <div className="text-xs text-muted-foreground">Time remaining in current skirmish</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Terms & Abbreviations */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4">Terms &amp; Abbreviations</h2>
            <div className="space-y-4">
              <div>
                <div className="font-semibold">WvW (World vs World)</div>
                <div className="text-sm text-muted-foreground">
                  Guild Wars 2&apos;s large-scale PvP game mode where three servers compete across multiple maps for a week.
                </div>
              </div>

              <div>
                <div className="font-semibold">VP (Victory Points)</div>
                <div className="text-sm text-muted-foreground">
                  Points awarded at the end of each 2-hour skirmish based on placement (1st, 2nd, or 3rd). The server with the most VP at the end of the week wins the match.
                </div>
              </div>

              <div>
                <div className="font-semibold">Skirmish</div>
                <div className="text-sm text-muted-foreground">
                  A 2-hour competitive period within a match. There are 84 skirmishes per week-long match. Placement in each skirmish awards Victory Points.
                </div>
              </div>

              <div>
                <div className="font-semibold">K/D (Kill/Death Ratio)</div>
                <div className="text-sm text-muted-foreground">
                  The ratio of kills to deaths. A K/D above 1.0 means more kills than deaths. Higher is better.
                </div>
              </div>

              <div>
                <div className="font-semibold">Prime Time</div>
                <div className="text-sm text-muted-foreground">
                  Peak activity hours for specific regions/time zones. The app tracks NA Prime Time, EU Prime Time, OCX Prime Time, SEA Prime Time, and Off-Hours.
                </div>
              </div>

              <div>
                <div className="font-semibold">Coverage Window</div>
                <div className="text-sm text-muted-foreground">
                  Specific time periods during the day categorized by expected player activity levels (NA, EU, OCX, SEA, Off-Hours).
                </div>
              </div>

              <div>
                <div className="font-semibold">Tier</div>
                <div className="text-sm text-muted-foreground">
                  Competitive bracket grouping servers of similar strength. Tier 1 contains the strongest servers.
                </div>
              </div>

              <div>
                <div className="font-semibold">Map Types</div>
                <div className="text-sm text-muted-foreground">
                  <strong>Eternal Battlegrounds (EB)</strong>: The central, largest map.
                  <strong> Borderlands</strong>: Three maps, one for each server color (Red/Blue/Green Borderlands).
                </div>
              </div>

              <div>
                <div className="font-semibold">Objectives</div>
                <div className="text-sm text-muted-foreground">
                  Capturable structures on maps: <strong>Castles</strong> (Stonemist Castle on EB), <strong>Keeps</strong> (large fortifications), <strong>Towers</strong> (medium fortifications), and <strong>Camps</strong> (supply depots).
                </div>
              </div>

              <div>
                <div className="font-semibold">Activity Score</div>
                <div className="text-sm text-muted-foreground">
                  A measure of combat engagement calculated as total kills plus deaths. Higher activity indicates more active participation.
                </div>
              </div>

              <div>
                <div className="font-semibold">Dominant Team</div>
                <div className="text-sm text-muted-foreground">
                  The server with the highest score during a specific time window or skirmish.
                </div>
              </div>

              <div>
                <div className="font-semibold">VP Scenario Planner</div>
                <div className="text-sm text-muted-foreground">
                  Tool for simulating different skirmish outcomes to predict final Victory Point standings and determine what results are needed to win.
                </div>
              </div>
            </div>
          </Card>

          {/* Score Placement Colors */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4">Skirmish Placement Colors</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-yellow-600 text-white hover:bg-yellow-600">1st</Badge>
                <div>
                  <div className="font-semibold">First Place</div>
                  <div className="text-sm text-muted-foreground">Gold/yellow color for skirmish winners</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-gray-400 text-white hover:bg-gray-400">2nd</Badge>
                <div>
                  <div className="font-semibold">Second Place</div>
                  <div className="text-sm text-muted-foreground">Silver/gray color for second place</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-orange-600 text-white hover:bg-orange-600">3rd</Badge>
                <div>
                  <div className="font-semibold">Third Place</div>
                  <div className="text-sm text-muted-foreground">Bronze/orange color for third place</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Data Updates */}
          <Card className="panel-border inset-card frosted-panel p-6">
            <h2 className="text-xl font-bold mb-4">Data Updates</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold">Real-time Match Data</div>
                <div className="text-muted-foreground">
                  Current match stats, scores, and objectives update every 60 seconds from the Guild Wars 2 API.
                </div>
              </div>
              <div>
                <div className="font-semibold">Historical Snapshots</div>
                <div className="text-muted-foreground">
                  Match history is captured every 15 minutes for trend analysis, prime time performance, and per-skirmish statistics.
                </div>
              </div>
              <div>
                <div className="font-semibold">Auto-Refresh</div>
                <div className="text-muted-foreground">
                  Match pages automatically refresh data periodically. You can also manually refresh using the refresh button in the header.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
