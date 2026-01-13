"use client";

interface AssetTopCardsProps {
  reserve: {
    symbol: string;
    name: string;
    imageUrl?: string;
    currentState: {
      supplyAPR: number;
      borrowAPR: number;
      totalSuppliedUSD: number;
      totalBorrowedUSD: number;
      oraclePrice: number;
      suppliedTokens: string;
      borrowedTokens: string;
    };
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function AssetTopCards({ reserve }: AssetTopCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          {reserve.imageUrl && (
            <img
              src={reserve.imageUrl}
              alt={reserve.symbol}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {reserve.symbol}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{reserve.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Supply APR</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatPercent(reserve.currentState.supplyAPR)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Borrow APR</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatPercent(reserve.currentState.borrowAPR)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Supplied</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(reserve.currentState.totalSuppliedUSD)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Borrowed</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(reserve.currentState.totalBorrowedUSD)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Oracle Price</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatUSD(reserve.currentState.oraclePrice)}
        </div>
      </div>
    </div>
  );
}
