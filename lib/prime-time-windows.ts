/**
 * Prime Time Analysis utility
 * Defines coverage windows and provides functions to categorize timestamps
 */

export type PrimeTimeWindow = 'na-prime' | 'eu-prime' | 'ocx' | 'sea' | 'off-hours';

export interface TimeWindow {
  id: PrimeTimeWindow;
  name: string;
  description: string;
  utcHourStart: number; // Inclusive
  utcHourEnd: number;   // Exclusive
  color: string;
}

/**
 * Convert UTC hours to local time string
 * @param utcHour - Hour in UTC (0-23)
 * @returns Local time string (e.g., "7:00 PM")
 */
function utcHourToLocalTime(utcHour: number): string {
  const date = new Date();
  date.setUTCHours(utcHour, 0, 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get localized time range string for a time window
 * @param window - Time window
 * @returns Localized time range (e.g., "7:00 PM - 12:00 AM")
 */
export function getLocalizedTimeRange(window: TimeWindow): string {
  const startTime = utcHourToLocalTime(window.utcHourStart);
  const endTime = utcHourToLocalTime(window.utcHourEnd);

  return `${startTime} - ${endTime}`;
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
    id: 'ocx',
    name: 'OCX Prime Time',
    description: '7 PM - 12 AM AEDT',
    utcHourStart: 8,  // 7 PM AEDT = 08:00 UTC (summer time, AEDT = UTC+11)
    utcHourEnd: 13,   // 12 AM AEDT = 13:00 UTC
    color: 'hsl(var(--chart-3))',
  },
  {
    id: 'sea',
    name: 'SEA Prime Time',
    description: '7 PM - 12 AM SGT',
    utcHourStart: 11, // 7 PM SGT = 11:00 UTC (SGT = UTC+8)
    utcHourEnd: 16,   // 12 AM SGT = 16:00 UTC
    color: 'hsl(var(--chart-4))',
  },
];

/**
 * Get the prime time window for a given timestamp
 * @param timestamp - ISO timestamp string, Date object, or numeric timestamp (ms since epoch)
 * @returns PrimeTimeWindow ID or 'off-hours'
 */
export function getPrimeTimeWindow(timestamp: string | Date | number): PrimeTimeWindow {
  let date: Date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = timestamp;
  }

  const utcHour = date.getUTCHours();

  for (const window of PRIME_TIME_WINDOWS) {
    if (utcHour >= window.utcHourStart && utcHour < window.utcHourEnd) {
      return window.id;
    }
  }

  return 'off-hours';
}

/**
 * Get the currently active prime time window
 * @returns PrimeTimeWindow ID for the current time
 */
export function getCurrentActiveWindow(): PrimeTimeWindow {
  return getPrimeTimeWindow(new Date());
}

/**
 * Calculate the actual off-hours periods (hours not covered by any prime time window)
 * @returns Array of UTC hour ranges that constitute off-hours
 */
export function getOffHoursPeriods(): Array<{ start: number; end: number }> {
  // Create a set of all hours covered by prime time windows
  const coveredHours = new Set<number>();

  for (const window of PRIME_TIME_WINDOWS) {
    for (let hour = window.utcHourStart; hour < window.utcHourEnd; hour++) {
      coveredHours.add(hour);
    }
  }

  // Find continuous ranges of uncovered hours
  const offHoursPeriods: Array<{ start: number; end: number }> = [];
  let rangeStart: number | null = null;

  for (let hour = 0; hour < 24; hour++) {
    if (!coveredHours.has(hour)) {
      if (rangeStart === null) {
        rangeStart = hour;
      }
    } else {
      if (rangeStart !== null) {
        offHoursPeriods.push({ start: rangeStart, end: hour });
        rangeStart = null;
      }
    }
  }

  // Handle case where off-hours extend to end of day
  if (rangeStart !== null) {
    offHoursPeriods.push({ start: rangeStart, end: 24 });
  }

  return offHoursPeriods;
}

/**
 * Get a human-readable description of off-hours periods
 * @returns Formatted string describing off-hours time ranges
 */
export function getOffHoursDescription(): string {
  const periods = getOffHoursPeriods();

  if (periods.length === 0) {
    return 'No off-hours (all hours covered)';
  }

  const ranges = periods.map(period => {
    const startTime = utcHourToLocalTime(period.start);
    const endTime = utcHourToLocalTime(period.end);
    return `${startTime}-${endTime}`;
  });

  return ranges.join(', ');
}

/**
 * Get time window metadata
 * @param windowId - Prime time window ID
 * @returns TimeWindow object or off-hours definition
 */
export function getTimeWindowInfo(windowId: PrimeTimeWindow): TimeWindow {
  if (windowId === 'off-hours') {
    const periods = getOffHoursPeriods();
    return {
      id: 'off-hours',
      name: 'Off Hours',
      description: 'Hours not covered by other prime time windows',
      // Use first period for start/end, or 0/0 if no periods
      utcHourStart: periods.length > 0 ? periods[0].start : 0,
      utcHourEnd: periods.length > 0 ? periods[0].end : 0,
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
 * Only includes the most recent occurrence of each window to avoid
 * inflated activity metrics from multiple days of data.
 * @param historyData - Array of historical snapshot data
 * @returns Map of window ID to array of timestamps that fall in that window
 */
export function groupByPrimeTimeWindow<T extends { timestamp: string | number }>(
  historyData: T[]
): Record<PrimeTimeWindow, T[]> {
  // First, group all data by window and day
  const groupedByWindowAndDay: Record<string, T[]> = {};

  for (const point of historyData) {
    const window = getPrimeTimeWindow(point.timestamp);
    const date = typeof point.timestamp === 'number'
      ? new Date(point.timestamp)
      : new Date(point.timestamp);

    // Use UTC date to group (format: YYYY-MM-DD)
    const dateKey = date.toISOString().split('T')[0];
    const key = `${window}_${dateKey}`;

    if (!groupedByWindowAndDay[key]) {
      groupedByWindowAndDay[key] = [];
    }
    groupedByWindowAndDay[key].push(point);
  }

  // Now, for each window, only keep the most recent day's data
  const grouped: Record<PrimeTimeWindow, T[]> = {
    'na-prime': [],
    'eu-prime': [],
    'ocx': [],
    'sea': [],
    'off-hours': [],
  };

  const allWindows: PrimeTimeWindow[] = ['na-prime', 'eu-prime', 'ocx', 'sea', 'off-hours'];

  for (const window of allWindows) {
    // Find all day keys for this window
    const windowKeys = Object.keys(groupedByWindowAndDay)
      .filter(key => key.startsWith(`${window}_`))
      .sort()
      .reverse(); // Most recent first

    // Use only the most recent day's data for this window
    if (windowKeys.length > 0) {
      grouped[window] = groupedByWindowAndDay[windowKeys[0]];
    }
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
    'ocx': total > 0 ? (grouped['ocx'].length / total) * 100 : 0,
    'sea': total > 0 ? (grouped['sea'].length / total) * 100 : 0,
    'off-hours': total > 0 ? (grouped['off-hours'].length / total) * 100 : 0,
  };
}
