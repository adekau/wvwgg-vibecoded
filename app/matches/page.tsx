import { MatchesHeader } from '@/components/matches-header'
import { MatchesGrid } from '@/components/matches-grid'
import { AutoRefresh } from '@/components/auto-refresh'
import { getMatches, getWorlds } from '@/server/queries'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchesPage() {
  // Fetch real data from DynamoDB
  const [matchesData, worldsData] = await Promise.all([
    getMatches(),
    getWorlds(),
  ]);

  // Helper to format match info with time until reset and skirmishes remaining
  const formatMatchInfo = (match: any, timezone: string) => {
    if (!match) return null;

    const now = new Date();
    const endTime = new Date(match.end_time);
    const startTime = new Date(match.start_time);

    // Calculate time remaining
    const timeRemaining = endTime.getTime() - now.getTime();
    const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Calculate skirmishes remaining (assuming 2-hour skirmishes)
    const totalSkirmishes = 84; // 7 days * 12 skirmishes per day
    const elapsedTime = now.getTime() - startTime.getTime();
    const elapsedSkirmishes = Math.floor(elapsedTime / (1000 * 60 * 60 * 2));
    const skirmishesRemaining = Math.max(0, totalSkirmishes - elapsedSkirmishes);

    // Format for tooltip
    const startStr = startTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const endStr = endTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short'
    });

    return {
      tooltip: `${startStr} - ${endStr}`,
      display: `${daysRemaining}d ${hoursRemaining}h until reset • ${skirmishesRemaining} skirmishes remaining`
    };
  };

  // Transform data for display
  const allMatches = matchesData && worldsData
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
          region: match.id.startsWith('1-') ? 'NA' : 'EU',
          worlds: [
            {
              name: match.red.world.name,
              kills: match.red.kills,
              deaths: match.red.deaths,
              color: 'red' as const,
              score: match.red.skirmishScore,
              victoryPoints: match.red.victoryPoints,
              ratio: match.red.ratio,
              activity: match.red.activity,
              population: match.red.world.population,
            },
            {
              name: match.blue.world.name,
              kills: match.blue.kills,
              deaths: match.blue.deaths,
              color: 'blue' as const,
              score: match.blue.skirmishScore,
              victoryPoints: match.blue.victoryPoints,
              ratio: match.blue.ratio,
              activity: match.blue.activity,
              population: match.blue.world.population,
            },
            {
              name: match.green.world.name,
              kills: match.green.kills,
              deaths: match.green.deaths,
              color: 'green' as const,
              score: match.green.skirmishScore,
              victoryPoints: match.green.victoryPoints,
              ratio: match.green.ratio,
              activity: match.green.activity,
              population: match.green.world.population,
            },
          ],
        };
      })
    : [];

  // Separate matches by region
  const naMatches = allMatches.filter((m: any) => m.region === 'NA');
  const euMatches = allMatches.filter((m: any) => m.region === 'EU');

  // Get first match from each region for timing info
  const naMatch = matchesData && naMatches.length > 0 ? matchesData[naMatches[0].tier] : null;
  const euMatch = matchesData && euMatches.length > 0 ? matchesData[euMatches[0].tier] : null;

  const naMatchInfo = formatMatchInfo(naMatch, 'America/Los_Angeles');
  const euMatchInfo = formatMatchInfo(euMatch, 'Europe/Berlin');

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {allMatches.length > 0 ? (
          <div className="space-y-12">
            {/* North America */}
            {naMatches.length > 0 && (
              <div className="space-y-4">
                <div className="panel-border rounded-lg px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">North America</h2>
                    <div className="flex items-center">
                      {naMatchInfo && (
                        <span className="text-sm text-muted-foreground" title={naMatchInfo.tooltip}>
                          {naMatchInfo.display}
                        </span>
                      )}
                      <AutoRefresh interval={60000} />
                    </div>
                  </div>
                </div>
                <MatchesGrid matches={naMatches} />
              </div>
            )}

            {/* Europe */}
            {euMatches.length > 0 && (
              <div className="space-y-4">
                <div className="panel-border rounded-lg px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Europe</h2>
                    {euMatchInfo && (
                      <span className="text-sm text-muted-foreground" title={euMatchInfo.tooltip}>
                        {euMatchInfo.display}
                      </span>
                    )}
                  </div>
                </div>
                <MatchesGrid matches={euMatches} />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No matches data available.</p>
            <p className="text-sm">Match data is automatically updated every 60 seconds.</p>
          </div>
        )}
      </main>
    </div>
  )
}
