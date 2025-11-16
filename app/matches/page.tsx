import { MatchesHeader } from '@/components/matches-header'
import { RegionTabs } from '@/components/region-tabs'
import { MatchesGrid } from '@/components/matches-grid'
import { getMatches, getWorlds } from '@/server/queries'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchesPage() {
  // Fetch real data from DynamoDB
  const [matchesData, worldsData] = await Promise.all([
    getMatches(),
    getWorlds(),
  ]);

  // Transform data for display
  const matches = matchesData && worldsData
    ? Object.values(matchesData)
        .filter((match: any) => match.red && match.blue && match.green) // Filter out incomplete matches
        .sort((a: any, b: any) => {
          // Extract region and tier from match ID (e.g., "1-1" = NA tier 1, "2-1" = EU tier 1)
          const [aRegion, aTier] = a.id.split('-');
          const [bRegion, bTier] = b.id.split('-');

          // Sort by region (NA=1 first, then EU=2) and tier
          if (aRegion !== bRegion) {
            return parseInt(aRegion) - parseInt(bRegion);
          }
          return parseInt(aTier) - parseInt(bTier);
        })
        .map((match: any) => {
          return {
            tier: match.id, // Use the match ID as tier (e.g., "1-1")
            worlds: [
              {
                name: match.red.world.name,
                kills: match.red.kills,
                deaths: match.red.deaths,
                color: 'red' as const,
              },
              {
                name: match.blue.world.name,
                kills: match.blue.kills,
                deaths: match.blue.deaths,
                color: 'blue' as const,
              },
              {
                name: match.green.world.name,
                kills: match.green.kills,
                deaths: match.green.deaths,
                color: 'green' as const,
              },
            ],
          };
        })
    : [];

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="brushstroke-accent rounded-lg">
          <RegionTabs />
        </div>

        {matches.length > 0 ? (
          <MatchesGrid matches={matches} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No matches data available. Data will be updated daily at 12:00 UTC.
          </div>
        )}
      </main>
    </div>
  )
}
