/**
 * Victory Points tier calculation utility
 *
 * Based on GW2 Wiki: https://wiki.guildwars2.com/wiki/World_versus_World
 * Effective as of March 28, 2025
 */

export interface VPTier {
  first: number;
  second: number;
  third: number;
  tier: 'low' | 'medium' | 'high' | 'peak';
}

/**
 * VP schedules for each region
 * Time slots are in UTC (2-hour blocks)
 */
const VP_SCHEDULES = {
  // Europe region (region code '2')
  eu: [
    { start: 0, end: 2, vp: { first: 15, second: 14, third: 12 }, tier: 'low' as const },
    { start: 2, end: 4, vp: { first: 15, second: 14, third: 12 }, tier: 'low' as const },
    { start: 4, end: 6, vp: { first: 15, second: 14, third: 12 }, tier: 'low' as const },
    { start: 6, end: 8, vp: { first: 15, second: 14, third: 12 }, tier: 'low' as const },
    { start: 8, end: 10, vp: { first: 22, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 10, end: 12, vp: { first: 22, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 12, end: 14, vp: { first: 22, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 14, end: 16, vp: { first: 31, second: 24, third: 17 }, tier: 'high' as const },
    { start: 16, end: 18, vp: { first: 31, second: 24, third: 17 }, tier: 'high' as const },
    { start: 18, end: 20, vp: { first: 51, second: 37, third: 24 }, tier: 'peak' as const },
    { start: 20, end: 22, vp: { first: 51, second: 37, third: 24 }, tier: 'peak' as const },
    { start: 22, end: 24, vp: { first: 31, second: 24, third: 17 }, tier: 'high' as const },
  ],
  // North America region (region code '1')
  na: [
    { start: 0, end: 2, vp: { first: 43, second: 32, third: 21 }, tier: 'peak' as const },
    { start: 2, end: 4, vp: { first: 43, second: 32, third: 21 }, tier: 'peak' as const },
    { start: 4, end: 6, vp: { first: 31, second: 24, third: 17 }, tier: 'high' as const },
    { start: 6, end: 8, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 8, end: 10, vp: { first: 19, second: 16, third: 13 }, tier: 'low' as const },
    { start: 10, end: 12, vp: { first: 19, second: 16, third: 13 }, tier: 'low' as const },
    { start: 12, end: 14, vp: { first: 19, second: 16, third: 13 }, tier: 'low' as const },
    { start: 14, end: 16, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 16, end: 18, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 18, end: 20, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 20, end: 22, vp: { first: 23, second: 18, third: 14 }, tier: 'medium' as const },
    { start: 22, end: 24, vp: { first: 31, second: 24, third: 17 }, tier: 'high' as const },
  ],
};

/**
 * Calculate VP tier for a given skirmish
 * @param skirmishId - The skirmish number (1-84 for a full week)
 * @param matchStartTime - ISO timestamp of match start
 * @param region - 'na' or 'eu'
 * @returns VP tier information
 */
export function getVPTierForSkirmish(
  skirmishId: number,
  matchStartTime: string,
  region: 'na' | 'eu'
): VPTier {
  const matchStart = new Date(matchStartTime);

  // Each skirmish is 2 hours
  const skirmishStartTime = new Date(
    matchStart.getTime() + ((skirmishId - 1) * 2 * 60 * 60 * 1000)
  );

  // Get UTC hour
  const utcHour = skirmishStartTime.getUTCHours();

  // Find matching time slot
  const schedule = VP_SCHEDULES[region];
  const slot = schedule.find(s => utcHour >= s.start && utcHour < s.end);

  if (!slot) {
    // Fallback to lowest tier if not found
    console.warn(`No VP tier found for hour ${utcHour} in ${region}`);
    return {
      first: region === 'na' ? 19 : 15,
      second: region === 'na' ? 16 : 14,
      third: region === 'na' ? 13 : 12,
      tier: 'low',
    };
  }

  return {
    first: slot.vp.first,
    second: slot.vp.second,
    third: slot.vp.third,
    tier: slot.tier,
  };
}

/**
 * Get region code from match ID
 * @param matchId - Match ID (e.g., "1-5" or "2-3")
 * @returns 'na' or 'eu'
 */
export function getRegionFromMatchId(matchId: string): 'na' | 'eu' {
  const regionCode = matchId.split('-')[0];
  return regionCode === '1' ? 'na' : 'eu';
}

/**
 * Calculate VP earned for a placement
 * @param placement - 1, 2, or 3
 * @param vpTier - VP tier information
 * @returns VP earned
 */
export function getVPForPlacement(placement: 1 | 2 | 3, vpTier: VPTier): number {
  switch (placement) {
    case 1:
      return vpTier.first;
    case 2:
      return vpTier.second;
    case 3:
      return vpTier.third;
    default:
      return 0;
  }
}

/**
 * Get color class for VP tier
 * @param tier - VP tier
 * @returns Tailwind color class
 */
export function getVPTierColorClass(tier: 'low' | 'medium' | 'high' | 'peak'): string {
  switch (tier) {
    case 'low':
      return 'text-gray-500 dark:text-gray-400';
    case 'medium':
      return 'text-blue-600 dark:text-blue-400';
    case 'high':
      return 'text-orange-600 dark:text-orange-400';
    case 'peak':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get badge variant for VP tier
 * @param tier - VP tier
 * @returns Badge variant
 */
export function getVPTierBadgeVariant(tier: 'low' | 'medium' | 'high' | 'peak'): 'secondary' | 'default' | 'outline' {
  switch (tier) {
    case 'low':
      return 'secondary';
    case 'medium':
    case 'high':
      return 'default';
    case 'peak':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get display label for VP tier
 * @param tier - VP tier
 * @returns Human-readable label
 */
export function getVPTierLabel(tier: 'low' | 'medium' | 'high' | 'peak'): string {
  switch (tier) {
    case 'low':
      return 'Low Activity';
    case 'medium':
      return 'Medium Activity';
    case 'high':
      return 'High Activity';
    case 'peak':
      return 'Peak Hours';
    default:
      return 'Unknown';
  }
}
