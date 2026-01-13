"use client";

interface MonthlySnapshotsTableProps {
  snapshots: Array<{
    month: string;
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
  }>;
  marketKey: string;
  underlying: string;
}

function formatUSD(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function MonthlySnapshotsTable({
  snapshots,
  marketKey,
  underlying,
}: MonthlySnapshotsTableProps) {
  const handleCSVDownload = () => {
    window.location.href = `/api/v1/reserve/${marketKey}/${underlying}/snapshots/monthly/csv`;
  };

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Monthly Snapshots (24 months)
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Insufficient data
        </div>
      </div>
    );
  }

  // Sort snapshots by month descending (newest first)
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    return b.month.localeCompare(a.month);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Monthly Snapshots (24 months)
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Month
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Avg Supply APR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Avg Borrow APR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Start Supplied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                End Supplied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Avg Price
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedSnapshots.map((snapshot) => (
              <tr key={snapshot.month} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {snapshot.month}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPercent(snapshot.avgSupplyAPR)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPercent(snapshot.avgBorrowAPR)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatUSD(snapshot.startTotalSuppliedUSD)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatUSD(snapshot.endTotalSuppliedUSD)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatUSD(snapshot.avgPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleCSVDownload}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
