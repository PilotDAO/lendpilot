"use client";

import { useState } from "react";
import { AssetChange } from "@/lib/calculations/trends";

interface TrendsSummaryCardsProps {
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  change1d: AssetChange | null;
  change7d: AssetChange | null;
  change30d: AssetChange | null;
  mode: "supply" | "borrow";
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

function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function ChangeCard({
  label,
  value,
  change,
  mode,
}: {
  label: string;
  value: number;
  change: AssetChange | null;
  mode: "supply" | "borrow";
}) {
  const changeValue = change
    ? mode === "supply"
      ? change.suppliedPercent
      : change.borrowedPercent
    : null;
  const changeColor =
    changeValue !== null
      ? changeValue >= 0
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400"
      : "text-gray-400";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {formatUSD(value)}
      </div>
      {changeValue !== null ? (
        <div className={`text-sm font-medium ${changeColor}`}>
          {formatChange(changeValue)}
        </div>
      ) : (
        <div className="text-sm text-gray-400">-</div>
      )}
    </div>
  );
}

export function TrendsSummaryCards({
  totalSuppliedUSD,
  totalBorrowedUSD,
  change1d,
  change7d,
  change30d,
  mode,
}: TrendsSummaryCardsProps) {
  const [window, setWindow] = useState<"30d" | "6m" | "1y">("30d");

  const currentValue = mode === "supply" ? totalSuppliedUSD : totalBorrowedUSD;

  return (
    <div className="space-y-4 mb-6">
      {/* Time Window Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Time Window:
        </label>
        <select
          value={window}
          onChange={(e) => setWindow(e.target.value as "30d" | "6m" | "1y")}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="30d">30 Days</option>
          <option value="6m">6 Months</option>
          <option value="1y">1 Year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ChangeCard
          label={mode === "supply" ? "Total Supply" : "Total Borrowing"}
          value={currentValue}
          change={null}
          mode={mode}
        />
        <ChangeCard
          label={`${mode === "supply" ? "Supply" : "Borrow"} Change (1d)`}
          value={currentValue}
          change={change1d}
          mode={mode}
        />
        <ChangeCard
          label={`${mode === "supply" ? "Supply" : "Borrow"} Change (7d)`}
          value={currentValue}
          change={change7d}
          mode={mode}
        />
        <ChangeCard
          label={`${mode === "supply" ? "Supply" : "Borrow"} Change (30d)`}
          value={currentValue}
          change={change30d}
          mode={mode}
        />
      </div>
    </div>
  );
}
