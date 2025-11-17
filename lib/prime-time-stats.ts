/**
 * Prime Time Statistics Calculator
 * Calculates aggregate stats for each coverage window
 */

import {
  type PrimeTimeWindow,
  groupByPrimeTimeWindow,
  getAllTimeWindows,
} from './prime-time-windows';

export interface TeamStats {
  kills: number;
  deaths: number;
  kdRatio: number;
  victoryPoints: number;
  score: number;
  skirmishesWon: number;    // 1st place finishes
  skirmishesPlayed: number;
  winRate: number;          // Percentage of 1st place finishes
}

export interface WindowStats {
  windowId: PrimeTimeWindow;
  windowName: string;
  red: TeamStats;
  blue: TeamStats;
  green: TeamStats;
  dataPoints: number; // Number of snapshots in this window
  duration: number;   // Approximate duration in hours
}

interface HistoricalDataPoint {
  timestamp: string | number;
  red: { score: number; kills: number; deaths: number; victoryPoints: number };
  blue: { score: number; kills: number; deaths: number; victoryPoints: number };
  green: { score: number; kills: number; deaths: number; victoryPoints: number };
}

/**
 * Calculate stats for a prime time window
 * @param windowData - Historical data points for this window
 * @returns Aggregate stats for the window
 */
function calculateWindowStats(
  windowData: HistoricalDataPoint[]
): Pick<WindowStats, 'red' | 'blue' | 'green' | 'dataPoints' | 'duration'> {
  if (windowData.length === 0) {
    const emptyStats: TeamStats = {
      kills: 0,
      deaths: 0,
      kdRatio: 0,
      victoryPoints: 0,
      score: 0,
      skirmishesWon: 0,
      skirmishesPlayed: 0,
      winRate: 0,
    };

    return {
      red: emptyStats,
      blue: emptyStats,
      green: emptyStats,
      dataPoints: 0,
      duration: 0,
    };
  }

  // Sort by timestamp to get first and last points
  const sorted = [...windowData].sort((a, b) => {
    const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
    const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  const firstPoint = sorted[0];
  const lastPoint = sorted[sorted.length - 1];

  // Calculate deltas (difference between last and first snapshot)
  const calculateTeamStats = (
    color: 'red' | 'blue' | 'green'
  ): TeamStats => {
    const killsDelta = lastPoint[color].kills - firstPoint[color].kills;
    const deathsDelta = lastPoint[color].deaths - firstPoint[color].deaths;
    const vpDelta = lastPoint[color].victoryPoints - firstPoint[color].victoryPoints;
    const scoreDelta = lastPoint[color].score - firstPoint[color].score;

    const kdRatio = deathsDelta > 0 ? killsDelta / deathsDelta : killsDelta;

    // Count skirmish wins (approximate based on score deltas)
    // This is a rough estimate - we'd need per-skirmish data for accuracy
    let skirmishesWon = 0;
    let skirmishesPlayed = 0;

    // Compare deltas with other teams to estimate wins
    for (let i = 1; i < sorted.length; i++) {
      const prevScore = sorted[i - 1][color].score;
      const currScore = sorted[i][color].score;
      const scoreDiff = currScore - prevScore;

      if (scoreDiff > 0) {
        skirmishesPlayed++;

        // Check if this team had the highest score gain
        const redDiff = sorted[i].red.score - sorted[i - 1].red.score;
        const blueDiff = sorted[i].blue.score - sorted[i - 1].blue.score;
        const greenDiff = sorted[i].green.score - sorted[i - 1].green.score;

        if (
          scoreDiff >= redDiff &&
          scoreDiff >= blueDiff &&
          scoreDiff >= greenDiff
        ) {
          skirmishesWon++;
        }
      }
    }

    const winRate = skirmishesPlayed > 0 ? (skirmishesWon / skirmishesPlayed) * 100 : 0;

    return {
      kills: Math.max(0, killsDelta),
      deaths: Math.max(0, deathsDelta),
      kdRatio: Math.round(kdRatio * 100) / 100,
      victoryPoints: Math.max(0, vpDelta),
      score: Math.max(0, scoreDelta),
      skirmishesWon,
      skirmishesPlayed,
      winRate: Math.round(winRate * 10) / 10,
    };
  };

  // Calculate duration in hours (15-minute snapshots)
  const durationMs = typeof lastPoint.timestamp === 'number'
    ? lastPoint.timestamp - (typeof firstPoint.timestamp === 'number' ? firstPoint.timestamp : new Date(firstPoint.timestamp).getTime())
    : new Date(lastPoint.timestamp).getTime() - new Date(firstPoint.timestamp).getTime();
  const duration = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;

  return {
    red: calculateTeamStats('red'),
    blue: calculateTeamStats('blue'),
    green: calculateTeamStats('green'),
    dataPoints: windowData.length,
    duration,
  };
}

/**
 * Calculate prime time statistics from historical data
 * @param historyData - Array of historical snapshots
 * @returns Array of statistics for each time window
 */
export function calculatePrimeTimeStats(
  historyData: HistoricalDataPoint[]
): WindowStats[] {
  // Group data by prime time window
  const grouped = groupByPrimeTimeWindow(historyData);

  console.log('Prime Time Stats - Grouped data counts:')
  for (const [windowId, data] of Object.entries(grouped)) {
    console.log(`  ${windowId}: ${data.length} points`)
    if (data.length > 0) {
      console.log(`    First:`, data[0].timestamp)
      console.log(`    Last:`, data[data.length - 1].timestamp)
    }
  }

  // Get all windows
  const windows = getAllTimeWindows();

  // Calculate stats for each window
  return windows.map(window => {
    const windowData = grouped[window.id];
    const stats = calculateWindowStats(windowData);

    if (windowData.length > 0) {
      console.log(`Stats for ${window.id}:`, {
        dataPoints: stats.dataPoints,
        redScore: stats.red.score,
        blueScore: stats.blue.score,
        greenScore: stats.green.score,
      })
    }

    return {
      windowId: window.id,
      windowName: window.name,
      ...stats,
    };
  });
}

/**
 * Find the dominant team for a window
 * @param windowStats - Statistics for a time window
 * @returns Color of the dominant team based on score
 */
export function getDominantTeam(
  windowStats: WindowStats
): 'red' | 'blue' | 'green' | null {
  const scores = {
    red: windowStats.red.score,
    blue: windowStats.blue.score,
    green: windowStats.green.score,
  };

  if (scores.red === 0 && scores.blue === 0 && scores.green === 0) {
    return null;
  }

  if (scores.red >= scores.blue && scores.red >= scores.green) {
    return 'red';
  } else if (scores.blue >= scores.red && scores.blue >= scores.green) {
    return 'blue';
  } else {
    return 'green';
  }
}

/**
 * Calculate percentage of total score earned in each window
 * @param allWindowStats - Statistics for all time windows
 * @param color - Team color
 * @returns Map of window ID to percentage of total score
 */
export function calculateScoreDistribution(
  allWindowStats: WindowStats[],
  color: 'red' | 'blue' | 'green'
): Record<PrimeTimeWindow, number> {
  const totalScore = allWindowStats.reduce((sum, window) => sum + window[color].score, 0);

  if (totalScore === 0) {
    return {
      'na-prime': 0,
      'eu-prime': 0,
      'ocx': 0,
      'sea': 0,
      'off-hours': 0,
    };
  }

  const distribution: Record<PrimeTimeWindow, number> = {} as any;

  for (const window of allWindowStats) {
    const percentage = (window[color].score / totalScore) * 100;
    distribution[window.windowId] = Math.round(percentage * 10) / 10;
  }

  return distribution;
}
