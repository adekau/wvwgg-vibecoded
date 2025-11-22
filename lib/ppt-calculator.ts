/**
 * Points Per Tick (PPT) Calculator
 * Calculates PPT based on objectives held and their upgrade tiers
 */

import {
  OBJECTIVE_TYPES,
  OBJECTIVE_TIERS,
  TEAM_COLORS,
  PPT_VALUES,
  PPT_TICK_INTERVAL_MINUTES,
  SKIRMISH_DURATION_MINUTES,
  MAX_PPT,
  API_TYPE_MAPPING,
  type ObjectiveType,
  type ObjectiveTier,
  type TeamColor,
} from './game-constants';

/**
 * PPT values for each objective type by tier
 * Tier 0 = Base, Tier 1 = Fortified, Tier 2 = Reinforced, Tier 3 = Secured
 */
const PPT_TABLE = PPT_VALUES;

/**
 * Objectives count for a team
 */
export interface ObjectivesCount {
  camps: number;
  towers: number;
  keeps: number;
  castles: number;
}

/**
 * PPT calculation result for a single team
 */
export interface TeamPPT {
  total: number;
  breakdown: {
    camps: number;
    towers: number;
    keeps: number;
    castles: number;
  };
}

/**
 * PPT calculation for all teams
 */
export interface MatchPPT {
  red: TeamPPT;
  blue: TeamPPT;
  green: TeamPPT;
}

/**
 * Get PPT value for a specific objective type and tier
 */
export function getPPTForObjective(type: ObjectiveType, tier: ObjectiveTier = 0): number {
  return PPT_TABLE[type][tier];
}

/**
 * Calculate total PPT for a team's objectives
 * @param objectives - Count of objectives held by the team
 * @param tier - Assumed tier for all objectives (default: 0 for MVP)
 * @returns PPT breakdown and total
 */
export function calculateTeamPPT(
  objectives: ObjectivesCount,
  tier: ObjectiveTier = 0
): TeamPPT {
  const breakdown = {
    camps: objectives.camps * getPPTForObjective('camp', tier),
    towers: objectives.towers * getPPTForObjective('tower', tier),
    keeps: objectives.keeps * getPPTForObjective('keep', tier),
    castles: objectives.castles * getPPTForObjective('castle', tier),
  };

  const total = breakdown.camps + breakdown.towers + breakdown.keeps + breakdown.castles;

  return {
    total,
    breakdown,
  };
}

/**
 * Calculate PPT for all teams in a match
 * @param objectives - Objectives for all teams
 * @param tier - Assumed tier for all objectives (default: 0 for MVP)
 * @returns PPT for all teams
 */
export function calculateMatchPPT(
  objectives: {
    red: ObjectivesCount;
    blue: ObjectivesCount;
    green: ObjectivesCount;
  },
  tier: ObjectiveTier = 0
): MatchPPT {
  return {
    red: calculateTeamPPT(objectives.red, tier),
    blue: calculateTeamPPT(objectives.blue, tier),
    green: calculateTeamPPT(objectives.green, tier),
  };
}

/**
 * Calculate PPT differential (higher PPT means team is gaining more points per tick)
 * Positive value means team is ahead in PPT, negative means behind
 */
export function calculatePPTDifferential(
  teamPPT: number,
  highestPPT: number
): number {
  return teamPPT - highestPPT;
}

/**
 * Get PPT trend indicator
 * @returns 'up' if team has highest PPT, 'down' if below highest, 'neutral' if tied
 */
export function getPPTTrend(
  teamPPT: number,
  highestPPT: number
): 'up' | 'down' | 'neutral' {
  if (teamPPT === highestPPT && highestPPT > 0) {
    return 'up';
  } else if (teamPPT < highestPPT) {
    return 'down';
  }
  return 'neutral';
}

/**
 * Calculate how many ticks until a team catches up based on score deficit and PPT differential
 * @param scoreDeficit - How many points behind the team is (positive number)
 * @param pptDifferential - teamPPT - leaderPPT (positive if team has higher PPT)
 * @returns Number of ticks to catch up (null if team won't catch up)
 */
export function calculateTicksBehind(
  scoreDeficit: number,
  pptDifferential: number
): number | null {
  // Only calculate if team has HIGHER PPT (catching up)
  if (pptDifferential <= 0) {
    return null; // Team has equal or lower PPT, will never catch up
  }

  // Team is catching up - calculate how many ticks until they overtake
  return Math.ceil(scoreDeficit / pptDifferential);
}

/**
 * Convert ticks to time string (HH:MM format)
 * Each tick is 5 minutes
 */
export function ticksToTimeString(ticks: number): string {
  const totalMinutes = ticks * PPT_TICK_INTERVAL_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get a descriptive status for a team's position
 * @param scoreDeficit - Points behind (0 if leading)
 * @param pptDifferential - teamPPT - leaderPPT (positive if team has higher PPT)
 */
export function getTeamStatus(
  scoreDeficit: number,
  pptDifferential: number
): {
  status: 'leading' | 'catching-up' | 'maintaining-gap' | 'falling-behind';
  description: string;
} {
  if (scoreDeficit === 0) {
    // Team is in the lead
    if (pptDifferential > 0) {
      return {
        status: 'leading',
        description: 'In the lead and pulling ahead',
      };
    } else if (pptDifferential === 0) {
      return {
        status: 'leading',
        description: 'In the lead',
      };
    } else {
      return {
        status: 'leading',
        description: 'In the lead but losing ground',
      };
    }
  }

  // Team is behind in score
  if (pptDifferential > 0) {
    // Higher PPT than leader - catching up!
    return {
      status: 'catching-up',
      description: 'Behind but catching up',
    };
  } else if (pptDifferential === 0) {
    // Equal PPT to leader - gap stays the same
    return {
      status: 'maintaining-gap',
      description: 'Gap will remain constant',
    };
  } else {
    // Lower PPT than leader - falling further behind
    return {
      status: 'falling-behind',
      description: 'Gap is increasing',
    };
  }
}

/**
 * Calculate PPT range (min/max) based on possible tier variations
 * Useful for showing estimated PPT when exact tiers are unknown
 */
export function calculatePPTRange(objectives: ObjectivesCount): {
  min: number;
  max: number;
  estimated: number;
} {
  const min = calculateTeamPPT(objectives, 0).total; // All tier 0
  const max = calculateTeamPPT(objectives, 3).total; // All tier 3

  // For estimated, assume average of tier 0 and 1 (most objectives are tier 0 or 1)
  const tier0 = calculateTeamPPT(objectives, 0).total;
  const tier1 = calculateTeamPPT(objectives, 1).total;
  const estimated = Math.round((tier0 + tier1) / 2);

  return { min, max, estimated };
}

/**
 * Calculate time remaining in current skirmish (in minutes with decimal precision)
 * Skirmishes are 2 hours (120 minutes) long
 */
export function getTimeRemainingInSkirmish(skirmishStartTime: Date): number {
  const now = new Date();
  const elapsedMs = now.getTime() - skirmishStartTime.getTime();
  const remainingMs = Math.max(0, (SKIRMISH_DURATION_MINUTES * 60 * 1000) - elapsedMs);
  const remainingMinutes = remainingMs / (1000 * 60);
  return remainingMinutes;
}

/**
 * Get comprehensive information about the current skirmish
 * @param matchStartDate - Match start date (string or Date)
 * @returns Current skirmish info including number, start time, and time remaining
 */
export function getCurrentSkirmishInfo(matchStartDate: string | Date): {
  skirmishNumber: number;
  skirmishStartTime: Date;
  minutesRemaining: number;
  ticksRemaining: number;
} {
  const matchStart = new Date(matchStartDate);
  const now = new Date();

  // Calculate which skirmish we're in (0-indexed internally, but can be converted to 1-indexed for display)
  const elapsedMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));
  const skirmishNumber = Math.floor(elapsedMinutes / SKIRMISH_DURATION_MINUTES);

  // Calculate when current skirmish started
  const skirmishStartTime = new Date(matchStart.getTime() + (skirmishNumber * SKIRMISH_DURATION_MINUTES * 60 * 1000));

  // Calculate time remaining with millisecond precision
  const skirmishElapsedMs = now.getTime() - skirmishStartTime.getTime();
  const skirmishRemainingMs = Math.max(0, (SKIRMISH_DURATION_MINUTES * 60 * 1000) - skirmishElapsedMs);
  const minutesRemaining = skirmishRemainingMs / (1000 * 60);

  // Calculate ticks remaining (always round up - even 1 second = 1 tick)
  const ticksRemaining = Math.ceil(minutesRemaining / PPT_TICK_INTERVAL_MINUTES);

  return {
    skirmishNumber,
    skirmishStartTime,
    minutesRemaining,
    ticksRemaining,
  };
}

/**
 * Calculate ticks remaining in current skirmish from match start date
 * @param matchStartDate - Match start date (string or Date)
 * @returns Number of ticks remaining (0 if skirmish ended)
 */
export function getTicksRemainingInSkirmish(matchStartDate: string | Date): number {
  const { ticksRemaining } = getCurrentSkirmishInfo(matchStartDate);
  return ticksRemaining;
}

/**
 * Calculate required PPT to overtake leader by end of current skirmish
 * @param scoreDeficit - Points behind the leader (positive number)
 * @param currentPPT - Team's current PPT
 * @param leaderPPT - Leader's current PPT
 * @param minutesRemaining - Minutes left in skirmish
 * @returns Required PPT to overtake by skirmish end (null if impossible)
 */
export function calculateRequiredPPTToOvertake(
  scoreDeficit: number,
  currentPPT: number,
  leaderPPT: number,
  minutesRemaining: number
): number | null {
  if (minutesRemaining <= 0) return null;

  const ticksRemaining = Math.ceil(minutesRemaining / PPT_TICK_INTERVAL_MINUTES);

  // To overtake, we need to gain more points than the leader
  // If leader gains L points and we gain W points, we need: W - L >= scoreDeficit + 1
  // W = requiredPPT * ticks, L = leaderPPT * ticks
  // So: requiredPPT * ticks - leaderPPT * ticks >= scoreDeficit + 1
  // requiredPPT >= leaderPPT + (scoreDeficit + 1) / ticks

  const pptDifferentialNeeded = Math.ceil((scoreDeficit + 1) / ticksRemaining);
  const requiredPPT = leaderPPT + pptDifferentialNeeded;

  return requiredPPT;
}

/**
 * Get maximum possible PPT (all objectives at tier 0)
 * Total available: 12 camps (24), 12 towers (48), 9 keeps (72), 1 castle (12) = 156 PPT
 */
export function getMaximumPossiblePPT(): number {
  return MAX_PPT;
}

/**
 * Calculate maximum achievable PPT for a team given current objective distribution
 * This calculates: PPT from current objectives at their current tiers + PPT from capturable objectives (at T0)
 *
 * @param teamColor - The team color (red, blue, or green)
 * @param detailedObjectives - Array of detailed objective data from GW2 API with tier info
 * @returns Maximum PPT the team could achieve and a breakdown of current vs potential
 */
export function calculateMaxAchievablePPT(
  teamColor: 'red' | 'blue' | 'green',
  detailedObjectives: any[]
): {
  maxPPT: number;
  currentPPT: number;
  potentialGain: number;
  breakdown: {
    current: { camps: number; towers: number; keeps: number; castles: number };
    capturable: { camps: number; towers: number; keeps: number; castles: number };
  };
} {
  let currentPPT = 0;
  let capturablePPT = 0;

  const currentBreakdown = { camps: 0, towers: 0, keeps: 0, castles: 0 };
  const capturableBreakdown = { camps: 0, towers: 0, keeps: 0, castles: 0 };

  // Map objective types from API to our types
  const typeMap = API_TYPE_MAPPING;

  for (const obj of detailedObjectives) {
    const objType = typeMap[obj.type];
    if (!objType) continue; // Skip spawns, etc.

    // Normalize owner to lowercase for comparison
    const owner = obj.owner?.toLowerCase();
    if (!owner || !['red', 'blue', 'green'].includes(owner)) continue;

    // Use points_tick directly from the API - this is the actual PPT value for the objective
    const pointsTick = obj.points_tick || 0;

    if (owner === teamColor) {
      // This team owns it - count at current PPT value
      currentPPT += pointsTick;
      currentBreakdown[`${objType}s` as keyof typeof currentBreakdown] += pointsTick;
    } else {
      // Another team owns it - we could capture it (at T0)
      const t0Value = getPPTForObjective(objType, 0);
      capturablePPT += t0Value;
      capturableBreakdown[`${objType}s` as keyof typeof capturableBreakdown] += t0Value;
    }
  }

  return {
    maxPPT: currentPPT + capturablePPT,
    currentPPT,
    potentialGain: capturablePPT,
    breakdown: {
      current: currentBreakdown,
      capturable: capturableBreakdown,
    },
  };
}
