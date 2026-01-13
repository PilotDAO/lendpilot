"use client";

import { formatUSD } from "@/lib/utils/format";

interface MarketTotalsProps {
  totals: {
    totalSupply: number;
    supply: number;
    borrowing: number;
    assetCount: number;
  };
}

export function MarketTotals({ totals }: MarketTotalsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Total Supply
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(totals.totalSupply)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Available Supply
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(totals.supply)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Total Borrowing
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(totals.borrowing)}
        </div>
      </div>
    </div>
  );
}
