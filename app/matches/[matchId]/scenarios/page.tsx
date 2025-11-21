import { MatchesHeader } from '@/components/matches-header'
import { MatchSubNav } from '@/components/match-sub-nav'
import { notFound } from 'next/navigation'
import { getMatches, getWorlds } from '@/server/queries'
import { VPScenarioPlanner } from '@/components/vp-scenario-planner'
import { InteractiveVPPlanner } from '@/components/interactive-vp-planner'
import { VPProbabilityAnalysis } from '@/components/vp-probability-analysis'
import { getVPTierForTime } from '@/lib/vp-tiers'
import { TOTAL_SKIRMISHES_PER_MATCH } from '@/lib/game-constants'

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default async function MatchScenariosPage({ params }: PageProps) {
  const { matchId } = await params

  // Fetch real data from DynamoDB
  const [matchesData, worldsData] = await Promise.all([
    getMatches(),
    getWorlds(),
  ]);

  if (!matchesData || !worldsData) {
    notFound()
  }

  const matchData = matchesData[matchId] as any

  if (!matchData) {
    notFound()
  }

  const match = {
    tier: matchId,
    region: matchId.startsWith('1') ? 'North America' : 'Europe',
    startDate: matchData.start_time || new Date().toISOString(),
    endDate: matchData.end_time || new Date().toISOString(),
    skirmishes: matchData.skirmishes || [],
    worlds: [
      {
        id: matchData.red?.world?.id || 0,
        name: matchData.red?.world?.name || 'Unknown',
        color: 'red' as const,
        victoryPoints: matchData.red?.victoryPoints || 0,
      },
      {
        id: matchData.blue?.world?.id || 0,
        name: matchData.blue?.world?.name || 'Unknown',
        color: 'blue' as const,
        victoryPoints: matchData.blue?.victoryPoints || 0,
      },
      {
        id: matchData.green?.world?.id || 0,
        name: matchData.green?.world?.name || 'Unknown',
        color: 'green' as const,
        victoryPoints: matchData.green?.victoryPoints || 0,
      },
    ],
  };

  // Calculate remaining skirmishes
  const completedSkirmishes = match.skirmishes?.length || 0
  const totalSkirmishes = TOTAL_SKIRMISHES_PER_MATCH
  const remainingCount = totalSkirmishes - completedSkirmishes
  const currentSkirmishId = completedSkirmishes - 1
  const matchStartDate = new Date(match.startDate)
  const region = matchId.startsWith('1') ? 'na' : 'eu'
  const remainingSkirmishes = []

  for (let i = 1; i <= remainingCount; i++) {
    const skirmishId = currentSkirmishId + i
    const hoursFromStart = skirmishId * 2
    const startTime = new Date(matchStartDate.getTime() + hoursFromStart * 60 * 60 * 1000)
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
    const vpTier = getVPTierForTime(startTime, region)

    remainingSkirmishes.push({
      id: skirmishId,
      startTime,
      endTime,
      vpAwards: {
        first: vpTier.first,
        second: vpTier.second,
        third: vpTier.third,
      },
    })
  }

  return (
    <div className="min-h-screen">
      <MatchesHeader />
      <MatchSubNav matchId={matchId} currentTab="scenarios" />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">Victory Point Scenarios</h1>
          <p className="text-muted-foreground text-sm">
            Explore different match outcome scenarios and probability predictions
          </p>
        </div>

        {/* VP Scenario Planner */}
        <VPScenarioPlanner matchId={matchId} match={match} />

        {/* Interactive VP Planner */}
        <InteractiveVPPlanner matchId={matchId} match={match} />

        {/* VP Probability Analysis */}
        <VPProbabilityAnalysis
          matchId={matchId}
          match={match}
          remainingSkirmishes={remainingSkirmishes}
        />
      </main>
    </div>
  )
}
