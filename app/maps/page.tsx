import { MatchesHeader } from '@/components/matches-header'
import { MapsPageClient } from '@/components/maps-page-client'
import { getMatches } from '@/server/queries'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MapsPage() {
  // Fetch all matches
  const matchesData = await getMatches();

  // Get all match IDs and find a default match (first NA match)
  // Validate that matchesData is an object and not an array or null
  let allMatches: Array<{
    id: string;
    label: string;
    region: string;
    tier: string;
    worlds: {
      red: string;
      blue: string;
      green: string;
    };
  }> = [];

  try {
    if (matchesData && typeof matchesData === 'object' && !Array.isArray(matchesData)) {
      const matchesArray = Object.values(matchesData);

      allMatches = matchesArray
        .filter((match: any) => match?.red && match?.blue && match?.green)
        .sort((a: any, b: any) => {
          const [aRegion, aTier] = a.id.split('-');
          const [bRegion, bTier] = b.id.split('-');
          if (aRegion !== bRegion) {
            return parseInt(aRegion) - parseInt(bRegion);
          }
          return parseInt(aTier) - parseInt(bTier);
        })
        .map((match: any) => ({
          id: match.id,
          label: `${match.id.startsWith('1-') ? 'NA' : 'EU'} Tier ${match.id.split('-')[1]} - ${match.red.world.name} vs ${match.blue.world.name} vs ${match.green.world.name}`,
          region: match.id.startsWith('1-') ? 'NA' : 'EU',
          tier: match.id.split('-')[1],
          worlds: {
            red: match.red.world.name,
            blue: match.blue.world.name,
            green: match.green.world.name,
          },
        }));
    } else {
      console.error('[MapsPage] Invalid matchesData:', {
        isNull: matchesData === null,
        isUndefined: matchesData === undefined,
        type: typeof matchesData,
        isArray: Array.isArray(matchesData),
      });
    }
  } catch (error) {
    console.error('[MapsPage] Error processing matches data:', error);
    allMatches = [];
  }

  const defaultMatchId = allMatches[0]?.id || '1-1';

  return (
    <div className="min-h-screen flex flex-col">
      <MatchesHeader />
      <MapsPageClient matches={allMatches} defaultMatchId={defaultMatchId} />
    </div>
  );
}
