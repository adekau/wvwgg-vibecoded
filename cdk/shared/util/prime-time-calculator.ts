/**
 * Prime Time Statistics Calculator for Lambda
 * Calculates aggregate stats for each coverage window to be stored in DynamoDB
 */

export type PrimeTimeWindow = 'na-prime' | 'eu-prime' | 'ocx' | 'sea' | 'off-hours';

interface TimeRange {
  startHour: number; // UTC hour (0-23)
  endHour: number;   // UTC hour (0-23)
}

export interface PrimeTimeWindowConfig {
  id: PrimeTimeWindow;
  name: string;
  ranges: TimeRange[];
}

// Prime Time Window Definitions (UTC)
const PRIME_TIME_WINDOWS: PrimeTimeWindowConfig[] = [
  {
    id: 'na-prime',
    name: 'NA Prime Time',
    ranges: [{ startHour: 1, endHour: 6 }], // 1:00 AM - 6:00 AM UTC (5 PM - 10 PM PST / 8 PM - 1 AM EST)
  },
  {
    id: 'eu-prime',
    name: 'EU Prime Time',
    ranges: [{ startHour: 18, endHour: 22 }], // 6:00 PM - 10:00 PM UTC
  },
  {
    id: 'ocx',
    name: 'OCX Prime Time',
    ranges: [{ startHour: 7, endHour: 12 }], // 7:00 AM - 12:00 PM UTC (5 PM - 10 PM AEST)
  },
  {
    id: 'sea',
    name: 'SEA Prime Time',
    ranges: [{ startHour: 13, endHour: 18 }], // 1:00 PM - 6:00 PM UTC (9 PM - 2 AM SGT)
  },
];

/**
 * Determine which prime time window a timestamp falls into
 */
function getPrimeTimeWindow(timestamp: number): PrimeTimeWindow {
  const date = new Date(timestamp);
  const hour = date.getUTCHours();

  for (const window of PRIME_TIME_WINDOWS) {
    for (const range of window.ranges) {
      if (hour >= range.startHour && hour < range.endHour) {
        return window.id;
      }
    }
  }

  return 'off-hours';
}

/**
 * Group historical data points by prime time window
 */
export function groupByPrimeTimeWindow(
  historyData: any[]
): Record<PrimeTimeWindow, any[]> {
  const grouped: Record<PrimeTimeWindow, any[]> = {
    'na-prime': [],
    'eu-prime': [],
    'ocx': [],
    'sea': [],
    'off-hours': [],
  };

  for (const point of historyData) {
    const timestamp = typeof point.timestamp === 'number'
      ? point.timestamp
      : new Date(point.timestamp).getTime();
    const window = getPrimeTimeWindow(timestamp);
    grouped[window].push(point);
  }

  return grouped;
}

export interface TeamStats {
  kills: number;
  deaths: number;
  kdRatio: string;
  victoryPoints: number;
  score: number;
}

export interface WindowStats {
  windowId: PrimeTimeWindow;
  windowName: string;
  red: TeamStats;
  blue: TeamStats;
  green: TeamStats;
  dataPoints: number;
  duration: number;
}

/**
 * Calculate stats for a prime time window
 *
 * IMPORTANT: We need to calculate deltas between consecutive snapshots within the window,
 * not just first-to-last, because:
 * 1. Off-hours spans multiple disconnected time ranges (0:00, 6:00-6:59, 12:00, etc.)
 * 2. Match data is cumulative from match start
 * 3. Using first-to-last would incorrectly include all intervening prime time activity
 */
function calculateWindowStats(
  windowData: any[],
  windowId: PrimeTimeWindow,
  windowName: string,
  allHistoryData: any[] // Need full history to calculate consecutive deltas
): WindowStats {
  if (windowData.length === 0) {
    const emptyStats: TeamStats = {
      kills: 0,
      deaths: 0,
      kdRatio: '0.00',
      victoryPoints: 0,
      score: 0,
    };

    return {
      windowId,
      windowName,
      red: emptyStats,
      blue: emptyStats,
      green: emptyStats,
      dataPoints: 0,
      duration: 0,
    };
  }

  // Sort ALL history by timestamp to find consecutive snapshots
  const allSorted = [...allHistoryData].sort((a, b) => {
    const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
    const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  // Create a Set of timestamps in this window for quick lookup
  const windowTimestamps = new Set(
    windowData.map(d => typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp).getTime())
  );

  // Calculate team stats by summing deltas between consecutive snapshots in this window
  const calculateTeamStats = (color: 'red' | 'blue' | 'green'): TeamStats => {
    let totalKills = 0;
    let totalDeaths = 0;
    let totalVP = 0;
    let totalScore = 0;

    // Iterate through all sorted snapshots and calculate deltas
    // Start from index 1 to skip the first snapshot (we can't attribute its cumulative data)
    for (let i = 1; i < allSorted.length; i++) {
      const current = allSorted[i];
      const previous = allSorted[i - 1];

      const currentTime = typeof current.timestamp === 'number'
        ? current.timestamp
        : new Date(current.timestamp).getTime();

      // Only process snapshots in this window
      if (windowTimestamps.has(currentTime)) {
        // Calculate delta from previous snapshot (which may be in a different window)
        const killsDelta = current[color].kills - previous[color].kills;
        const deathsDelta = current[color].deaths - previous[color].deaths;
        const vpDelta = current[color].victoryPoints - previous[color].victoryPoints;
        const scoreDelta = current[color].score - previous[color].score;

        totalKills += Math.max(0, killsDelta);
        totalDeaths += Math.max(0, deathsDelta);
        totalVP += Math.max(0, vpDelta);
        totalScore += Math.max(0, scoreDelta);
      }
    }

    const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;

    return {
      kills: totalKills,
      deaths: totalDeaths,
      kdRatio: (Math.round(kdRatio * 100) / 100).toFixed(2),
      victoryPoints: totalVP,
      score: totalScore,
    };
  };

  // Calculate duration based on number of snapshots
  // Each snapshot represents a 15-minute interval
  // Since snapshots are taken every 15 min, count * 0.25 hours = total duration
  const duration = Math.round((windowData.length * 0.25) * 10) / 10;

  return {
    windowId,
    windowName,
    red: calculateTeamStats('red'),
    blue: calculateTeamStats('blue'),
    green: calculateTeamStats('green'),
    dataPoints: windowData.length,
    duration,
  };
}

/**
 * Calculate prime time statistics for a specific match from historical data
 */
export function calculateMatchPrimeTimeStats(
  matchId: string,
  allSnapshots: any[]
): WindowStats[] {
  // Extract history for this specific match
  const matchHistory = allSnapshots
    .map((snapshot) => {
      const matchData = snapshot.data[matchId];
      if (!matchData) return null;

      return {
        timestamp: snapshot.timestamp,
        red: {
          score: matchData.red?.totalScore || 0,
          kills: matchData.red?.kills || 0,
          deaths: matchData.red?.deaths || 0,
          victoryPoints: matchData.red?.victoryPoints || 0,
        },
        blue: {
          score: matchData.blue?.totalScore || 0,
          kills: matchData.blue?.kills || 0,
          deaths: matchData.blue?.deaths || 0,
          victoryPoints: matchData.blue?.victoryPoints || 0,
        },
        green: {
          score: matchData.green?.totalScore || 0,
          kills: matchData.green?.kills || 0,
          deaths: matchData.green?.deaths || 0,
          victoryPoints: matchData.green?.victoryPoints || 0,
        },
      };
    })
    .filter(Boolean);

  if (matchHistory.length === 0) {
    return [];
  }

  // Group by prime time window
  const grouped = groupByPrimeTimeWindow(matchHistory);

  // Calculate stats for each window
  const allWindows = [
    ...PRIME_TIME_WINDOWS,
    { id: 'off-hours' as PrimeTimeWindow, name: 'Off Hours', ranges: [] }
  ];

  return allWindows.map(window => {
    const windowData = grouped[window.id];
    return calculateWindowStats(windowData, window.id, window.name, matchHistory);
  });
}
