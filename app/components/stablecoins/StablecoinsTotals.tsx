"use client";

interface StablecoinsTotalsProps {
  totals: {
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
  };
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

export function StablecoinsTotals({ totals }: StablecoinsTotalsProps) {
  return (
    <div className="relative z-0 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Total Supplied
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(totals.totalSuppliedUSD)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Total Borrowed
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(totals.totalBorrowedUSD)}
        </div>
      </div>
    </div>
  );
}
