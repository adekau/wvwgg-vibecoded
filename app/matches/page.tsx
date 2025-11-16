import { MatchesHeader } from '@/components/matches-header'
import { RegionTabs } from '@/components/region-tabs'
import { MatchesGrid } from '@/components/matches-grid'
import { getMatches, getWorlds } from '@/server/queries'

export default async function MatchesPage() {
  // Fetch real data from DynamoDB
  const [matchesData, worldsData] = await Promise.all([
    getMatches(),
    getWorlds(),
  ]);

  // Transform data for display
  const matches = matchesData && worldsData
    ? Object.values(matchesData)
        .filter((match) => match.all_worlds && match.all_worlds.length > 0) // Filter out matches without world data
        .sort((a, b) => {
          // Sort by region (NA first, then EU) and tier
          if (a.region !== b.region) {
            return a.region === 'NA' ? -1 : 1;
          }
          return a.tier - b.tier;
        })
        .map((match) => {
          // Group worlds by color and get their names
          const worldsByColor = match.all_worlds.reduce((acc, world) => {
            if (!acc[world.color]) {
              acc[world.color] = [];
            }
            acc[world.color].push(world);
            return acc;
          }, {} as Record<string, typeof match.all_worlds>);

          // Get primary world for each color (first in the list)
          const redWorld = worldsByColor.red?.[0];
          const blueWorld = worldsByColor.blue?.[0];
          const greenWorld = worldsByColor.green?.[0];

          // Find world names from worlds data
          const getWorldName = (worldId: number) => {
            const world = worldsData.find((w) => w.id === worldId);
            return world?.name || `World ${worldId}`;
          };

          return {
            tier: `${match.region}-${match.tier}`,
            worlds: [
              redWorld && {
                name: getWorldName(redWorld.id),
                kills: redWorld.kills,
                deaths: redWorld.deaths,
                color: 'red' as const,
              },
              blueWorld && {
                name: getWorldName(blueWorld.id),
                kills: blueWorld.kills,
                deaths: blueWorld.deaths,
                color: 'blue' as const,
              },
              greenWorld && {
                name: getWorldName(greenWorld.id),
                kills: greenWorld.kills,
                deaths: greenWorld.deaths,
                color: 'green' as const,
              },
            ].filter(Boolean) as Array<{
              name: string;
              kills: number;
              deaths: number;
              color: 'red' | 'blue' | 'green';
            }>,
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
