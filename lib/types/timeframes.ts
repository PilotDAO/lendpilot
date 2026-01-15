/**
 * Supported time windows for market timeseries data
 */
export type TimeWindow = '7d' | '30d' | '3m' | '6m' | '1y';

/**
 * Get number of days for a time window
 */
export function getDaysForWindow(window: TimeWindow): number {
  switch (window) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '3m':
      return 90; // ~3 months
    case '6m':
      return 180; // ~6 months
    case '1y':
      return 365; // 1 year
    default:
      return 30;
  }
}

/**
 * Get cutoff date for a time window
 */
export function getCutoffDate(window: TimeWindow): Date {
  const days = getDaysForWindow(window);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * Filter data points by time window
 */
export function filterDataByWindow<T extends { date: string }>(
  data: T[],
  window: TimeWindow
): T[] {
  const cutoff = getCutoffDate(window);
  return data.filter(point => {
    const pointDate = new Date(point.date);
    pointDate.setUTCHours(0, 0, 0, 0);
    return pointDate >= cutoff;
  });
}

/**
 * All available time windows
 */
export const ALL_TIME_WINDOWS: TimeWindow[] = ['7d', '30d', '3m', '6m', '1y'];
