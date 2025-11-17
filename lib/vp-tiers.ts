/**
 * Victory Points tier calculation utility (client-side)
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
 * Calculate VP tier for a given skirmish time
 * @param skirmishStartTime - Date object for skirmish start
 * @param region - 'na' or 'eu'
 * @returns VP tier information
 */
export function getVPTierForTime(
  skirmishStartTime: Date,
  region: 'na' | 'eu'
): VPTier {
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
