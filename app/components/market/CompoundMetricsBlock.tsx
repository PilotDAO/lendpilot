"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { formatUSD } from "@/lib/utils/format";
import { AssetChange } from "@/lib/calculations/trends";

const MarketTotalsChart = dynamic(
  () => import("@/app/components/charts/MarketTotalsChart").then((mod) => ({ default: mod.MarketTotalsChart })),
  { ssr: false }
);

interface CompoundMetricsBlockProps {
  marketKey: string;
  currentTotals: {
    totalSupply: number;
    supply: number;
    borrowing: number;
  };
  initialTimeseriesData?: MarketTrendData[];
  trendsData?: {
    change1d: AssetChange | null;
    change7d: AssetChange | null;
    change30d: AssetChange | null;
  };
  marketName?: React.ReactNode;
  description?: string;
}

interface MarketTrendData {
  date: string;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  availableLiquidityUSD: number;
}

interface CachedData {
  data: MarketTrendData[];
  timestamp: number;
  window: string;
}

type TimeseriesMetadata = {
  window: "7d" | "30d" | "3m" | "6m" | "1y";
  expectedDays: number;
  actualDays: number;
  coveragePercent: number;
  dateRange: { from: string; to: string } | null;
};

// Cache key for sessionStorage
const getCacheKey = (marketKey: string, window: string) => 
  `trends_${marketKey}_${window}`;

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Retry with exponential backoff and Retry-After header support
async function fetchWithRetry(
  url: string,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // If rate limited (429), retry with backoff
      if (response.status === 429 && attempt < maxRetries) {
        // Check for Retry-After header
        const retryAfter = response.headers.get("Retry-After");
        let delay: number;
        
        if (retryAfter) {
          // Use Retry-After header value (in seconds)
          delay = parseInt(retryAfter, 10) * 1000;
          // Cap at 30 seconds
          delay = Math.min(delay, 30000);
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
        }
        
        console.log(`Rate limited, retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // For other errors, return response (will be handled by caller)
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Only retry network errors, not on last attempt
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
        console.log(`Network error, retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Failed to fetch after retries");
}

// Компонент для метрики с изменением (компактная версия)
function MetricCard({
  title,
  value,
  subtitle,
  change,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  change?: { value: number; label: string } | null;
  icon: string;
}) {
  const changeColor =
    change && change.value !== 0
      ? change.value > 0
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400"
      : "text-gray-500 dark:text-gray-400";

  const changeIcon =
    change && change.value !== 0
      ? change.value > 0
        ? "↑"
        : "↓"
      : "—";

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-200 flex-1 flex flex-col">
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{icon}</span>
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {title}
          </h3>
        </div>
        {change && change.value !== 0 && (
          <div className={`text-xs font-semibold ${changeColor} flex items-center gap-0.5`}>
            <span>{changeIcon}</span>
            <span>{Math.abs(change.value).toFixed(2)}%</span>
          </div>
        )}
      </div>
      <div className="text-lg font-bold text-gray-900 dark:text-white mb-0.5 flex-grow flex items-center">
        {value}
      </div>
      <div className="mt-auto">
        {subtitle && (
          <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
            {subtitle}
          </div>
        )}
        {change && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
            {change.label}
          </div>
        )}
      </div>
    </div>
  );
}

export function CompoundMetricsBlock({
  marketKey,
  currentTotals,
  initialTimeseriesData = [],
  trendsData,
  marketName,
  description,
}: CompoundMetricsBlockProps) {
  const [timeWindow, setTimeWindow] = useState<"7d" | "30d" | "3m" | "6m" | "1y">("7d");
  const [trendsDataState, setTrendsDataState] = useState(trendsData || null);
  const [trendsDataChart, setTrendsDataChart] = useState<MarketTrendData[]>(initialTimeseriesData);
  const [loading, setLoading] = useState(initialTimeseriesData.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [timeseriesMeta, setTimeseriesMeta] = useState<TimeseriesMetadata | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Загружаем данные трендов, если не переданы
  useEffect(() => {
    if (trendsData) {
      setTrendsDataState(trendsData);
      return;
    }

    const fetchTrends = async () => {
      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const response = await fetch(
          `${baseUrl}/api/v1/market/${marketKey}/timeseries?window=7d`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.totals) {
            setTrendsDataState({
              change1d: data.totals.change1d,
              change7d: data.totals.change7d,
              change30d: data.totals.change30d,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch trends:", error);
      }
    };

    fetchTrends();
  }, [marketKey, trendsData]);

  // Вычисляем изменения для каждой метрики
  const supplyChange7d = trendsDataState?.change7d
    ? {
        value: trendsDataState.change7d.suppliedPercent,
        label: "vs 7 days ago",
      }
    : null;
  const supplyChange30d = trendsDataState?.change30d
    ? {
        value: trendsDataState.change30d.suppliedPercent,
        label: "vs 30 days ago",
      }
    : null;
  const borrowChange30d = trendsDataState?.change30d
    ? {
        value: trendsDataState.change30d.borrowedPercent,
        label: "vs 30 days ago",
      }
    : null;

  // Use ref to track initial data to avoid unnecessary re-renders
  const initialDataRef = useRef(initialTimeseriesData);
  const currentTimeWindowRef = useRef(timeWindow);
  
  useEffect(() => {
    // Update ref when initialTimeseriesData changes
    if (initialTimeseriesData.length > 0) {
      initialDataRef.current = initialTimeseriesData;
    }
  }, [initialTimeseriesData.length]);

  useEffect(() => {
    // Update current timeWindow ref
    currentTimeWindowRef.current = timeWindow;
    
    // Clear metadata and cache when window changes to avoid showing stale data
    setTimeseriesMeta(null);
    if (typeof window !== "undefined") {
      // Clear cache for this market/window to force fresh fetch with proper date filtering
      const cacheKey = getCacheKey(marketKey, timeWindow);
      sessionStorage.removeItem(cacheKey);
    }
    
    // If we have initial data for 7d and user selects 7d, use it immediately
    if (timeWindow === "7d" && initialDataRef.current.length > 0) {
      setTrendsDataChart(initialDataRef.current);
      setLoading(false);
      setIsUsingCache(false);
      return;
    }

    const fetchTrendsData = async () => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Capture current timeWindow to check later
      const requestedTimeWindow = timeWindow;

      setLoading(true);
      setError(null);
      setTimeseriesMeta(null); // Clear metadata when fetching new data

      // Skip cache - always fetch fresh to ensure proper date filtering
      // Cache can contain old data from before date filtering was implemented
      await fetchFreshData(abortController, requestedTimeWindow);
    };

    const fetchFreshData = async (abortController: AbortController, requestedTimeWindow: "7d" | "30d" | "3m" | "6m" | "1y") => {
      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const url = `${baseUrl}/api/v1/market/${marketKey}/timeseries?window=${requestedTimeWindow}`;
        
        const response = await fetchWithRetry(url, 5, 2000);

        if (abortController.signal.aborted) {
          return;
        }

        if (!response.ok) {
          // For 429, try to get retry-after time
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            if (retryAfter) {
              const seconds = parseInt(retryAfter, 10);
              throw new Error(`Rate limit exceeded. Please wait ${seconds} seconds and try again.`);
            }
            throw new Error("Rate limit exceeded. Please wait a moment and try again.");
          }
          // For other errors, try to parse error response
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch trends data: ${response.statusText}`);
          } catch {
            throw new Error(`Failed to fetch trends data: ${response.statusText}`);
          }
        }

        const data = await response.json();
        
        // Check if timeWindow changed during fetch - if so, abort
        if (currentTimeWindowRef.current !== requestedTimeWindow) {
          return;
        }

        // Metadata: show coverage + actual date range so user isn't misled
        if (data?.metadata) {
          setTimeseriesMeta(data.metadata as TimeseriesMetadata);
        } else {
          setTimeseriesMeta(null);
        }
        
        // Check if data is empty
        if (!data.data || data.data.length === 0) {
          // Show appropriate message based on window
          if (requestedTimeWindow === "1y") {
            throw new Error("1 year data is not available yet. Historical data sync is in progress.");
          }
          throw new Error(`No data available for ${requestedTimeWindow} period.`);
        }
        
        // Transform data array to MarketTrendData format
        const transformedData: MarketTrendData[] = (data.data || []).map((trend: any) => ({
          date: trend.date,
          totalSuppliedUSD: trend.totalSuppliedUSD,
          totalBorrowedUSD: trend.totalBorrowedUSD,
          availableLiquidityUSD: trend.availableLiquidityUSD,
        }));

        if (abortController.signal.aborted) {
          return;
        }
        
        // Double-check timeWindow hasn't changed before updating state
        if (currentTimeWindowRef.current !== requestedTimeWindow) {
          return;
        }

        setTrendsDataChart(transformedData);
        setIsUsingCache(false);

        // Cache the data (only if timeWindow hasn't changed)
        if (typeof window !== "undefined" && currentTimeWindowRef.current === requestedTimeWindow) {
          const cacheKey = getCacheKey(marketKey, requestedTimeWindow);
          const cachedData: CachedData = {
            data: transformedData,
            timestamp: Date.now(),
            window: requestedTimeWindow,
          };
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(cachedData));
          } catch (e) {
            // Ignore storage errors (quota exceeded, etc.)
            console.warn("Failed to cache data:", e);
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }
        
        console.error("Error fetching trends data:", err);
        
        // If we have cached data, use it even if fresh fetch failed (only if timeWindow hasn't changed)
        let usedCache = false;
        if (typeof window !== "undefined" && currentTimeWindowRef.current === requestedTimeWindow) {
          const cacheKey = getCacheKey(marketKey, requestedTimeWindow);
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData: CachedData = JSON.parse(cached);
              if (cachedData.window === requestedTimeWindow && cachedData.data.length > 0) {
                setTrendsDataChart(cachedData.data);
                setIsUsingCache(true);
                setError(null);
                setLoading(false);
                usedCache = true;
              }
            } catch (e) {
              // Ignore cache parse errors
            }
          }
        }
        
        // Only show error if we don't have cached data
        if (!usedCache) {
          const errorMessage = err instanceof Error ? err.message : "Failed to load trends data";
          setError(errorMessage);
          setTimeseriesMeta(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchTrendsData();

    // Cleanup on unmount or dependency change
    return () => {
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
      } catch (e) {
        // Ignore errors during cleanup
        console.warn("Error during cleanup:", e);
      }
    };
  }, [marketKey, timeWindow]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      {/* Header */}
      {marketName && (
        <div className="mb-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {marketName}
          </h1>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart - takes 2 columns */}
        <div className="lg:col-span-2">
          {/* Time Range Chips - над графиком */}
          <div className="flex items-center justify-end gap-2 mb-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              {(["7d", "30d", "3m", "6m", "1y"] as const).map((window) => (
                <button
                  key={window}
                  onClick={() => setTimeWindow(window)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    timeWindow === window
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {window}
                </button>
              ))}
            </div>
          </div>

          {/* Coverage warning (prevents misleading "3m" when only a few days exist) */}
          {timeseriesMeta &&
          timeseriesMeta.actualDays > 0 &&
          timeseriesMeta.coveragePercent < 90 ? (
            <div className="mb-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
              Showing {timeseriesMeta.actualDays} of {timeseriesMeta.expectedDays} days for{" "}
              <span className="font-semibold">{timeseriesMeta.window}</span>{" "}
              ({timeseriesMeta.coveragePercent}% coverage)
              {timeseriesMeta.dateRange ? (
                <>
                  {" "}
                  — {timeseriesMeta.dateRange.from} → {timeseriesMeta.dateRange.to}
                </>
              ) : null}
              . Historical backfill is in progress.
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center h-[280px] text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-2"></div>
                <div className="text-sm">Loading chart data...</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[280px] bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-center">
                {timeWindow === "1y" ? (
                  <>
                    <div className="text-amber-600 dark:text-amber-400 font-medium mb-2">
                      📊 Historical data for 1 year is being prepared
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      This requires processing 365 days of data. Please check back later or use 30d or 6m views.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-red-600 dark:text-red-400 font-medium mb-2">
                      ⚠️ {error}
                    </div>
                    {trendsDataChart.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Showing cached data
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {isUsingCache && (
                <div className="mb-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                  ⚠️ Showing cached data (may be outdated)
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <MarketTotalsChart data={trendsDataChart} />
              </div>
            </>
          )}
        </div>

        {/* Key Metrics - right side, компактные, на высоту графика */}
        <div className="flex flex-col gap-2 min-h-[280px]">
          <MetricCard
            title="Total Supply"
            value={formatUSD(currentTotals.totalSupply)}
            subtitle="Total value locked"
            change={supplyChange30d}
            icon="💰"
          />

          <MetricCard
            title="Available Liquidity"
            value={formatUSD(currentTotals.supply)}
            subtitle="Ready to borrow"
            change={supplyChange7d}
            icon="💧"
          />

          <MetricCard
            title="Total Borrowed"
            value={formatUSD(currentTotals.borrowing)}
            subtitle="Currently borrowed"
            change={borrowChange30d}
            icon="📊"
          />
        </div>
      </div>
    </div>
  );
}
