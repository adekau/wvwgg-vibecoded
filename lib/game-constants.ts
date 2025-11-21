/**
 * Guild Wars 2 World vs World Game Constants
 *
 * Single source of truth for all GW2 WvW game mechanics values.
 * These values are not available in the API and represent core game mechanics.
 */

// ============================================================================
// OBJECTIVE TYPES
// ============================================================================

export const OBJECTIVE_TYPES = {
  CAMP: 'camp',
  TOWER: 'tower',
  KEEP: 'keep',
  CASTLE: 'castle',
} as const;

export type ObjectiveType = typeof OBJECTIVE_TYPES[keyof typeof OBJECTIVE_TYPES];

export const OBJECTIVE_TYPE_LABELS = {
  [OBJECTIVE_TYPES.CAMP]: 'Camps',
  [OBJECTIVE_TYPES.TOWER]: 'Towers',
  [OBJECTIVE_TYPES.KEEP]: 'Keeps',
  [OBJECTIVE_TYPES.CASTLE]: 'Castles',
} as const;

// API string mapping to internal types
export const API_TYPE_MAPPING = {
  'Camp': OBJECTIVE_TYPES.CAMP,
  'Tower': OBJECTIVE_TYPES.TOWER,
  'Keep': OBJECTIVE_TYPES.KEEP,
  'Castle': OBJECTIVE_TYPES.CASTLE,
} as const;

// ============================================================================
// OBJECTIVE TIERS
// ============================================================================

export const OBJECTIVE_TIERS = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
} as const;

export type ObjectiveTier = typeof OBJECTIVE_TIERS[keyof typeof OBJECTIVE_TIERS];

export const TIER_LABELS = ['T0', 'T1', 'T2', 'T3'] as const;

// ============================================================================
// POINTS PER TICK (PPT) VALUES
// ============================================================================

/**
 * PPT values for each objective type at each tier level
 * Format: [T0, T1, T2, T3]
 */
export const PPT_VALUES = {
  [OBJECTIVE_TYPES.CAMP]: [2, 3, 4, 5],
  [OBJECTIVE_TYPES.TOWER]: [4, 6, 8, 10],
  [OBJECTIVE_TYPES.KEEP]: [8, 12, 16, 20],
  [OBJECTIVE_TYPES.CASTLE]: [12, 18, 24, 30],
} as const;

/**
 * Total number of each objective type available on the map
 */
export const OBJECTIVE_COUNTS = {
  [OBJECTIVE_TYPES.CAMP]: 12,
  [OBJECTIVE_TYPES.TOWER]: 12,
  [OBJECTIVE_TYPES.KEEP]: 9,
  [OBJECTIVE_TYPES.CASTLE]: 1,
} as const;

/**
 * Maximum possible PPT (all objectives at T0)
 * = (12 camps × 2) + (12 towers × 4) + (9 keeps × 8) + (1 castle × 12)
 * = 24 + 48 + 72 + 12 = 156
 */
export const MAX_PPT = 156;

// ============================================================================
// TEAM COLORS
// ============================================================================

export const TEAM_COLORS = {
  RED: 'red',
  BLUE: 'blue',
  GREEN: 'green',
} as const;

export type TeamColor = typeof TEAM_COLORS[keyof typeof TEAM_COLORS];

// ============================================================================
// MATCH & SKIRMISH TIMING
// ============================================================================

/**
 * Duration of one skirmish in minutes
 */
export const SKIRMISH_DURATION_MINUTES = 120;

/**
 * Duration of one skirmish in milliseconds
 */
export const SKIRMISH_DURATION_MS = SKIRMISH_DURATION_MINUTES * 60 * 1000;

/**
 * Number of skirmishes per day
 */
export const SKIRMISHES_PER_DAY = 12;

/**
 * Number of days in a match
 */
export const MATCH_DURATION_DAYS = 7;

/**
 * Total number of skirmishes in a complete match
 */
export const TOTAL_SKIRMISHES_PER_MATCH = MATCH_DURATION_DAYS * SKIRMISHES_PER_DAY; // 84

/**
 * Interval between PPT ticks in minutes
 */
export const PPT_TICK_INTERVAL_MINUTES = 5;

/**
 * Interval between history snapshots in minutes
 */
export const HISTORY_SNAPSHOT_INTERVAL_MINUTES = 15;

/**
 * Interval between history snapshots in milliseconds
 */
export const HISTORY_SNAPSHOT_INTERVAL_MS = HISTORY_SNAPSHOT_INTERVAL_MINUTES * 60 * 1000;

/**
 * Number of snapshot intervals per hour
 */
export const SNAPSHOT_INTERVALS_PER_HOUR = 60 / HISTORY_SNAPSHOT_INTERVAL_MINUTES; // 4

// ============================================================================
// REGIONS
// ============================================================================

export const REGIONS = {
  NORTH_AMERICA: '1',
  EUROPE: '2',
} as const;

export type Region = typeof REGIONS[keyof typeof REGIONS];

export const REGION_LABELS = {
  [REGIONS.NORTH_AMERICA]: 'North America',
  [REGIONS.EUROPE]: 'Europe',
} as const;

// ============================================================================
// VICTORY POINTS (VP) BY REGION AND TIME
// ============================================================================

/**
 * Victory points awarded for 1st, 2nd, 3rd place finishes in a skirmish
 * Organized by region and 2-hour UTC time blocks
 */
export const VP_TIERS = {
  [REGIONS.NORTH_AMERICA]: {
    '00:00': { first: 43, second: 32, third: 21 }, // Peak
    '02:00': { first: 43, second: 32, third: 21 }, // Peak
    '04:00': { first: 31, second: 24, third: 17 }, // High
    '06:00': { first: 23, second: 18, third: 14 }, // Medium
    '08:00': { first: 19, second: 16, third: 13 }, // Low
    '10:00': { first: 19, second: 16, third: 13 }, // Low
    '12:00': { first: 19, second: 16, third: 13 }, // Low
    '14:00': { first: 23, second: 18, third: 14 }, // Medium
    '16:00': { first: 23, second: 18, third: 14 }, // Medium
    '18:00': { first: 23, second: 18, third: 14 }, // Medium
    '20:00': { first: 23, second: 18, third: 14 }, // Medium
    '22:00': { first: 31, second: 24, third: 17 }, // High
  },
  [REGIONS.EUROPE]: {
    '00:00': { first: 15, second: 14, third: 12 }, // Low
    '02:00': { first: 15, second: 14, third: 12 }, // Low
    '04:00': { first: 15, second: 14, third: 12 }, // Low
    '06:00': { first: 15, second: 14, third: 12 }, // Low
    '08:00': { first: 22, second: 18, third: 14 }, // Medium
    '10:00': { first: 22, second: 18, third: 14 }, // Medium
    '12:00': { first: 22, second: 18, third: 14 }, // Medium
    '14:00': { first: 31, second: 24, third: 17 }, // High
    '16:00': { first: 31, second: 24, third: 17 }, // High
    '18:00': { first: 51, second: 37, third: 24 }, // Peak
    '20:00': { first: 51, second: 37, third: 24 }, // Peak
    '22:00': { first: 31, second: 24, third: 17 }, // High
  },
} as const;

// ============================================================================
// PRIME TIME WINDOWS (UTC Hours)
// ============================================================================

export const PRIME_TIME_WINDOWS = {
  NA: {
    label: 'NA Prime Time',
    startHour: 0,
    endHour: 5,
    description: '7 PM - 12 AM ET',
  },
  EU: {
    label: 'EU Prime Time',
    startHour: 18,
    endHour: 23,
    description: '7 PM - 12 AM CET',
  },
  OCX: {
    label: 'OCX Prime Time',
    startHour: 8,
    endHour: 13,
    description: '7 PM - 12 AM AEDT',
  },
  SEA: {
    label: 'SEA Prime Time',
    startHour: 11,
    endHour: 16,
    description: '7 PM - 12 AM SGT',
  },
} as const;

// ============================================================================
// REFRESH & POLL INTERVALS (in seconds unless specified)
// ============================================================================

export const CACHE_DURATIONS = {
  /** Guild data cache duration (1 day) */
  GUILDS: 86400,
  /** Match data cache duration (1 minute) */
  MATCHES: 60,
  /** World data cache duration (1 day) */
  WORLDS: 86400,
  /** Match history cache duration (2 minutes) */
  MATCH_HISTORY: 120,
} as const;

export const POLL_INTERVALS_MS = {
  /** Objectives fetch interval (30 seconds) */
  OBJECTIVES: 30000,
  /** Dashboard auto-refresh interval (1 minute) */
  DASHBOARD: 60000,
  /** Chart update interval (1 minute) */
  CHART_UPDATE: 60000,
} as const;

// ============================================================================
// ACTIVITY THRESHOLDS
// ============================================================================

export const ACTIVITY_THRESHOLDS = {
  VERY_HIGH: 30000,
} as const;

// ============================================================================
// SOLVER PARAMETERS
// ============================================================================

export const SOLVER_LIMITS = {
  /** Maximum iterations for DFS solver (tuned for 50 skirmishes max) */
  MAX_ITERATIONS: 500000,
} as const;

// ============================================================================
// DATABASE CONSTANTS
// ============================================================================

export const DB_CONSTANTS = {
  INDEX_NAME: 'type-interval-index',
  QUERY_TYPES: {
    MATCHES: 'matches',
    WORLDS: 'worlds',
    GUILD: 'guild',
    MATCH_HISTORY: 'match-history',
    PRIME_TIME_STATS: 'prime-time-stats',
  },
  /** Safety limit for query iterations */
  MAX_QUERY_ITERATIONS: 100,
} as const;
