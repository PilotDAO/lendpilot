"use client";

interface DailySnapshotsTableProps {
  snapshots: Array<{
    date: string;
    supplyAPR: number;
    borrowAPR: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    utilizationRate: number;
    price: number;
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

export function DailySnapshotsTable({
  snapshots,
  marketKey,
  underlying,
}: DailySnapshotsTableProps) {
  const handleCSVDownload = () => {
    window.location.href = `/api/v1/reserve/${marketKey}/${underlying}/snapshots/daily/csv`;
  };

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Daily Snapshots (90 days)
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Insufficient data
        </div>
      </div>
    );
  }

  // Sort snapshots by Supplied (USD) descending (highest first)
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    return b.totalSuppliedUSD - a.totalSuppliedUSD;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Daily Snapshots (90 days)
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Supply APR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Borrow APR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Supplied (USD)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Borrowed (USD)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Utilization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedSnapshots.slice(0, 30).map((snapshot) => (
              <tr key={snapshot.date} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {snapshot.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPercent(snapshot.supplyAPR)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPercent(snapshot.borrowAPR)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatUSD(snapshot.totalSuppliedUSD)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatUSD(snapshot.totalBorrowedUSD)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPercent(snapshot.utilizationRate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatUSD(snapshot.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedSnapshots.length > 30 && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
            Showing first 30 of {sortedSnapshots.length} snapshots. Download CSV for full data.
          </p>
        )}
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
