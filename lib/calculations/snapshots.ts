
export interface DailySnapshot {
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: number;
  blockNumber: number;
  supplyAPR: number;
  borrowAPR: number;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  utilizationRate: number;
  price: number;
  liquidityIndex: string;
  variableBorrowIndex: string;
}

export interface MonthlySnapshot {
  month: string; // YYYY-MM
  startDate: string;
  endDate: string;
  avgSupplyAPR: number;
  avgBorrowAPR: number;
  startTotalSuppliedUSD: number;
  endTotalSuppliedUSD: number;
  startTotalBorrowedUSD: number;
  endTotalBorrowedUSD: number;
  startUtilizationRate: number;
  endUtilizationRate: number;
  avgPrice: number;
}

/**
 * Aggregate daily snapshots into monthly snapshots
 */
export function aggregateMonthlySnapshots(
  dailySnapshots: DailySnapshot[]
): MonthlySnapshot[] {
  if (dailySnapshots.length === 0) {
    return [];
  }

  // Group by month
  const monthlyGroups = new Map<string, DailySnapshot[]>();

  for (const snapshot of dailySnapshots) {
    const month = snapshot.date.substring(0, 7); // YYYY-MM
    if (!monthlyGroups.has(month)) {
      monthlyGroups.set(month, []);
    }
    monthlyGroups.get(month)!.push(snapshot);
  }

  // Aggregate each month
  const monthlySnapshots: MonthlySnapshot[] = [];

  for (const [month, snapshots] of monthlyGroups.entries()) {
    // Sort by date
    const sorted = snapshots.sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Calculate averages
    const avgSupplyAPR =
      sorted.reduce((sum, s) => sum + s.supplyAPR, 0) / sorted.length;
    const avgBorrowAPR =
      sorted.reduce((sum, s) => sum + s.borrowAPR, 0) / sorted.length;
    const avgPrice =
      sorted.reduce((sum, s) => sum + s.price, 0) / sorted.length;

    monthlySnapshots.push({
      month,
      startDate: first.date,
      endDate: last.date,
      avgSupplyAPR,
      avgBorrowAPR,
      startTotalSuppliedUSD: first.totalSuppliedUSD,
      endTotalSuppliedUSD: last.totalSuppliedUSD,
      startTotalBorrowedUSD: first.totalBorrowedUSD,
      endTotalBorrowedUSD: last.totalBorrowedUSD,
      startUtilizationRate: first.utilizationRate,
      endUtilizationRate: last.utilizationRate,
      avgPrice,
    });
  }

  return monthlySnapshots.sort((a, b) => a.month.localeCompare(b.month));
}
