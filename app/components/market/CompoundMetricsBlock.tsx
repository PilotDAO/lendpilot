"use client";

import { useState, useEffect } from "react";
import { MarketTotalsChart } from "@/app/components/charts/MarketTotalsChart";
import { formatUSD } from "@/lib/utils/format";

interface CompoundMetricsBlockProps {
  marketKey: string;
  currentTotals: {
    totalSupply: number;
    supply: number;
    borrowing: number;
  };
}

interface MarketTrendData {
  date: string;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  availableLiquidityUSD: number;
}

export function CompoundMetricsBlock({
  marketKey,
  currentTotals,
}: CompoundMetricsBlockProps) {
  const [timeWindow, setTimeWindow] = useState<"30d" | "6m" | "1y">("30d");
  const [trendsData, setTrendsData] = useState<MarketTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendsData = async () => {
      setLoading(true);
      setError(null);

      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const response = await fetch(
          `${baseUrl}/api/v1/market/${marketKey}/timeseries?window=${timeWindow}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch trends data: ${response.statusText}`);
        }

        const data = await response.json();
        // Transform data array to MarketTrendData format
        const transformedData: MarketTrendData[] = (data.data || []).map((trend: any) => ({
          date: trend.date,
          totalSuppliedUSD: trend.totalSuppliedUSD,
          totalBorrowedUSD: trend.totalBorrowedUSD,
          availableLiquidityUSD: trend.availableLiquidityUSD,
        }));

        setTrendsData(transformedData);
      } catch (err) {
        console.error("Error fetching trends data:", err);
        setError(err instanceof Error ? err.message : "Failed to load trends data");
      } finally {
        setLoading(false);
      }
    };

    fetchTrendsData();
  }, [marketKey, timeWindow]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      {/* Header with time range selector */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Market Overview
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Time Range:</label>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as "30d" | "6m" | "1y")}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="30d">30 Days</option>
            <option value="6m">6 Months</option>
            <option value="1y">1 Year</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart - takes 2 columns on large screens */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Loading chart data...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-400">
              {error}
            </div>
          ) : (
            <MarketTotalsChart data={trendsData} />
          )}
        </div>

        {/* Metrics - right side */}
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total Supply
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatUSD(currentTotals.totalSupply)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Supply
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatUSD(currentTotals.supply)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Available liquidity
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Borrowing
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatUSD(currentTotals.borrowing)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
