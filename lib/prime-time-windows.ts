/**
 * Prime Time Analysis utility
 * Defines coverage windows and provides functions to categorize timestamps
 */

export type PrimeTimeWindow = 'na-prime' | 'eu-prime' | 'ocx-sea' | 'off-hours';

export interface TimeWindow {
  id: PrimeTimeWindow;
  name: string;
  description: string;
  utcHourStart: number; // Inclusive
  utcHourEnd: number;   // Exclusive
  color: string;
}

/**
 * Prime time windows definition
 * Times are in UTC (24-hour format)
 */
export const PRIME_TIME_WINDOWS: TimeWindow[] = [
  {
    id: 'na-prime',
    name: 'NA Prime Time',
    description: '7 PM - 12 AM ET',
    utcHourStart: 0,  // 7 PM ET = 00:00 UTC (next day)
    utcHourEnd: 5,    // 12 AM ET = 05:00 UTC (next day)
    color: 'hsl(var(--chart-1))',
  },
  {
    id: 'eu-prime',
    name: 'EU Prime Time',
    description: '7 PM - 12 AM CET',
    utcHourStart: 18, // 7 PM CET = 18:00 UTC (winter time, CET = UTC+1)
    utcHourEnd: 23,   // 12 AM CET = 23:00 UTC
    color: 'hsl(var(--chart-2))',
  },
  {
    id: 'ocx-sea',
    name: 'OCX/SEA Coverage',
    description: '7 PM - 12 AM AEDT',
    utcHourStart: 8,  // 7 PM AEDT = 08:00 UTC (summer time, AEDT = UTC+11)
    utcHourEnd: 13,   // 12 AM AEDT = 13:00 UTC
    color: 'hsl(var(--chart-3))',
  },
];

/**
 * Get the prime time window for a given timestamp
 * @param timestamp - ISO timestamp or Date object
 * @returns PrimeTimeWindow ID or 'off-hours'
 */
export function getPrimeTimeWindow(timestamp: string | Date): PrimeTimeWindow {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const utcHour = date.getUTCHours();

  for (const window of PRIME_TIME_WINDOWS) {
    if (utcHour >= window.utcHourStart && utcHour < window.utcHourEnd) {
      return window.id;
    }
  }

  return 'off-hours';
}

/**
 * Get time window metadata
 * @param windowId - Prime time window ID
 * @returns TimeWindow object or off-hours definition
 */
export function getTimeWindowInfo(windowId: PrimeTimeWindow): TimeWindow {
  if (windowId === 'off-hours') {
    return {
      id: 'off-hours',
      name: 'Off Hours',
      description: 'All other times',
      utcHourStart: 0,
      utcHourEnd: 24,
      color: 'hsl(var(--muted))',
    };
  }

  const window = PRIME_TIME_WINDOWS.find(w => w.id === windowId);
  if (!window) {
    throw new Error(`Unknown window ID: ${windowId}`);
  }

  return window;
}

/**
 * Get all time windows including off-hours
 * @returns Array of all time windows
 */
export function getAllTimeWindows(): TimeWindow[] {
  return [
    ...PRIME_TIME_WINDOWS,
    getTimeWindowInfo('off-hours'),
  ];
}

/**
 * Group historical data points by prime time window
 * @param historyData - Array of historical snapshot data
 * @returns Map of window ID to array of timestamps that fall in that window
 */
export function groupByPrimeTimeWindow<T extends { timestamp: string | number }>(
  historyData: T[]
): Record<PrimeTimeWindow, T[]> {
  const grouped: Record<PrimeTimeWindow, T[]> = {
    'na-prime': [],
    'eu-prime': [],
    'ocx-sea': [],
    'off-hours': [],
  };

  for (const point of historyData) {
    const timestamp = typeof point.timestamp === 'number'
      ? new Date(point.timestamp)
      : new Date(point.timestamp);

    const window = getPrimeTimeWindow(timestamp);
    grouped[window].push(point);
  }

  return grouped;
}

/**
 * Calculate percentage of time spent in each window
 * @param historyData - Array of historical snapshot data
 * @returns Map of window ID to percentage (0-100)
 */
export function calculateWindowCoverage<T extends { timestamp: string | number }>(
  historyData: T[]
): Record<PrimeTimeWindow, number> {
  const grouped = groupByPrimeTimeWindow(historyData);
  const total = historyData.length;

  return {
    'na-prime': total > 0 ? (grouped['na-prime'].length / total) * 100 : 0,
    'eu-prime': total > 0 ? (grouped['eu-prime'].length / total) * 100 : 0,
    'ocx-sea': total > 0 ? (grouped['ocx-sea'].length / total) * 100 : 0,
    'off-hours': total > 0 ? (grouped['off-hours'].length / total) * 100 : 0,
  };
}
