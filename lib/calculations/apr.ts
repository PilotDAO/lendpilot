import { BigNumber } from "@/lib/utils/big-number";

/**
 * Calculate APR from index-based formula
 * Formula: dailyGrowth = (indexNow / indexStart)^(1/N), APR = (dailyGrowth - 1) * 365
 */
export function calculateAPRFromIndices(
  indexStart: string,
  indexEnd: string,
  days: number
): number {
  const start = new BigNumber(indexStart);
  const end = new BigNumber(indexEnd);

  if (start.eq(0) || days === 0) {
    return 0;
  }

  // Calculate daily growth: (indexEnd / indexStart)^(1/days)
  const ratio = end.div(start);
  const dailyGrowth = ratio.pow(1 / days);

  // Calculate APR: (dailyGrowth - 1) * 365
  const apr = dailyGrowth.minus(1).times(365);

  return apr.toNumber();
}

/**
 * Calculate average APR over a period from multiple snapshots
 */
export function calculateAverageAPR(
  snapshots: Array<{ index: string; timestamp: number }>,
  periodDays: number
): number | null {
  if (snapshots.length < 2) {
    return null;
  }

  // Sort by timestamp
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const daysDiff = (last.timestamp - first.timestamp) / 86400; // Convert to days

  if (daysDiff < periodDays * 0.8) {
    // Require at least 80% of the period to have data
    return null;
  }

  return calculateAPRFromIndices(first.index, last.index, daysDiff);
}

/**
 * Calculate average lending rates for multiple periods (1d, 7d, 30d, 6m, 1y)
 */
export function calculateAverageLendingRates(snapshots: Array<{
  liquidityIndex: string;
  variableBorrowIndex: string;
  timestamp: number;
}>) {
  const now = Date.now() / 1000;
  const periods = [
    { name: "1d", days: 1 },
    { name: "7d", days: 7 },
    { name: "30d", days: 30 },
    { name: "6m", days: 180 },
    { name: "1y", days: 365 },
  ];

  const results: Record<string, { supplyAPR: number | null; borrowAPR: number | null }> = {};

  for (const period of periods) {
    const cutoffTime = now - period.days * 86400;
    const periodSnapshots = snapshots.filter((s) => s.timestamp >= cutoffTime);

    if (periodSnapshots.length < 2) {
      results[period.name] = { supplyAPR: null, borrowAPR: null };
      continue;
    }

    const supplyAPR = calculateAverageAPR(
      periodSnapshots.map((s) => ({ index: s.liquidityIndex, timestamp: s.timestamp })),
      period.days
    );
    const borrowAPR = calculateAverageAPR(
      periodSnapshots.map((s) => ({ index: s.variableBorrowIndex, timestamp: s.timestamp })),
      period.days
    );

    results[period.name] = { supplyAPR, borrowAPR };
  }

  return results;
}

/**
 * Calculate 30-day APR series from daily snapshots
 * Returns array of { date: string, borrowAPR: number } for the last 30 days
 * Performs linear interpolation for missing dates
 */
export function calculate30DayAPRSeries(snapshots: Array<{
  date: string;
  borrowAPR: number;
  timestamp: number;
}>): Array<{ date: string; borrowAPR: number }> {
  if (!snapshots || snapshots.length === 0) {
    // No data at all
    return [];
  }

  // Sort by date
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  
  // Get last 30 days
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 86400;
  const relevantSnapshots = sorted.filter((s) => s.timestamp >= thirtyDaysAgo);

  // Require at least 2 snapshots for interpolation (reduced from 7)
  if (relevantSnapshots.length < 2) {
    return [];
  }

  // Create array for 30 days
  const result: Array<{ date: string; borrowAPR: number }> = [];
  const dateMap = new Map<string, number>();
  
  // Map existing snapshots (filter out zero APR values from first snapshot)
  for (const snapshot of relevantSnapshots) {
    // Skip zero APR values (they indicate first snapshot without previous data)
    if (snapshot.borrowAPR > 0) {
      dateMap.set(snapshot.date, snapshot.borrowAPR);
    }
  }
  
  // If we don't have enough valid snapshots after filtering zeros, return empty
  if (dateMap.size < 2) {
    return [];
  }

  // Generate 30 days with interpolation
  const nowMs = Date.now(); // Use milliseconds for Date constructor
  for (let i = 29; i >= 0; i--) {
    const date = new Date(nowMs - i * 86400 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    
    if (dateMap.has(dateStr)) {
      // Use existing value
      result.push({ date: dateStr, borrowAPR: dateMap.get(dateStr)! });
    } else {
      // Linear interpolation: find nearest points before and after (only with valid APR)
      const dateTimestamp = date.getTime() / 1000;
      let before: { date: string; borrowAPR: number; timestamp: number } | null = null;
      let after: { date: string; borrowAPR: number; timestamp: number } | null = null;

      for (const snapshot of relevantSnapshots) {
        // Only use snapshots with valid APR for interpolation
        if (snapshot.borrowAPR <= 0) {
          continue;
        }
        
        if (snapshot.timestamp < dateTimestamp) {
          if (!before || snapshot.timestamp > before.timestamp) {
            before = snapshot;
          }
        } else if (snapshot.timestamp > dateTimestamp) {
          if (!after || snapshot.timestamp < after.timestamp) {
            after = snapshot;
          }
        }
      }

      if (before && after) {
        // Linear interpolation
        const timeDiff = after.timestamp - before.timestamp;
        const weight = (dateTimestamp - before.timestamp) / timeDiff;
        const interpolatedAPR = before.borrowAPR + (after.borrowAPR - before.borrowAPR) * weight;
        result.push({ date: dateStr, borrowAPR: interpolatedAPR });
      } else if (before) {
        // Use last known value
        result.push({ date: dateStr, borrowAPR: before.borrowAPR });
      } else if (after) {
        // Use first known value
        result.push({ date: dateStr, borrowAPR: after.borrowAPR });
      } else {
        // No data available
        result.push({ date: dateStr, borrowAPR: 0 });
      }
    }
  }

  return result;
}

/**
 * Calculate statistics for 30-day APR series
 */
export function calculate30DayAPRStats(series: Array<{ date: string; borrowAPR: number }>): {
  last: number;
  min: number;
  max: number;
  delta30d: number;
  firstDate: string;
  lastDate: string;
} | null {
  // Require at least 2 data points (reduced from 7 for better UX)
  if (!series || series.length < 2) {
    return null;
  }

  const values = series.map((s) => s.borrowAPR);
  const last = values[values.length - 1];
  const first = values[0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const delta30d = last - first;

  return {
    last,
    min,
    max,
    delta30d,
    firstDate: series[0].date,
    lastDate: series[series.length - 1].date,
  };
}
