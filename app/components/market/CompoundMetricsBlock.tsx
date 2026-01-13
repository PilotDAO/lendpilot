"use client";

import { useState, useEffect, useRef } from "react";
import { MarketTotalsChart } from "@/app/components/charts/MarketTotalsChart";
import { formatUSD } from "@/lib/utils/format";
import { AssetChange } from "@/lib/calculations/trends";

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
  const [timeWindow, setTimeWindow] = useState<"30d" | "6m" | "1y">("30d");
  const [trendsDataState, setTrendsDataState] = useState(trendsData || null);
  const [trendsDataChart, setTrendsDataChart] = useState<MarketTrendData[]>(initialTimeseriesData);
  const [loading, setLoading] = useState(initialTimeseriesData.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
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
          `${baseUrl}/api/v1/market/${marketKey}/timeseries?window=30d`
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

  useEffect(() => {
    // If we have initial data for 30d and user selects 30d, use it immediately
    if (timeWindow === "30d" && initialTimeseriesData.length > 0) {
      setTrendsDataChart(initialTimeseriesData);
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

      setLoading(true);
      setError(null);

      // Try to load from cache first
      if (typeof window !== "undefined") {
        const cacheKey = getCacheKey(marketKey, timeWindow);
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const cachedData: CachedData = JSON.parse(cached);
            const now = Date.now();
            
            // Use cached data if still valid
            if (now - cachedData.timestamp < CACHE_TTL && cachedData.window === timeWindow) {
              setTrendsDataChart(cachedData.data);
              setLoading(false);
              setIsUsingCache(true);
              
              // Still fetch fresh data in background
              fetchFreshData(abortController);
              return;
            }
          } catch (e) {
            // Invalid cache, continue with fresh fetch
            console.warn("Failed to parse cached data:", e);
          }
        }
      }

      await fetchFreshData(abortController);
    };

    const fetchFreshData = async (abortController: AbortController) => {
      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const url = `${baseUrl}/api/v1/market/${marketKey}/timeseries?window=${timeWindow}`;
        
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

        if (abortController.signal.aborted) {
          return;
        }

        setTrendsDataChart(transformedData);
        setIsUsingCache(false);

        // Cache the data
        if (typeof window !== "undefined") {
          const cacheKey = getCacheKey(marketKey, timeWindow);
          const cachedData: CachedData = {
            data: transformedData,
            timestamp: Date.now(),
            window: timeWindow,
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
        
        // If we have cached data, use it even if fresh fetch failed
        let usedCache = false;
        if (typeof window !== "undefined") {
          const cacheKey = getCacheKey(marketKey, timeWindow);
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData: CachedData = JSON.parse(cached);
              if (cachedData.window === timeWindow && cachedData.data.length > 0) {
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
  }, [marketKey, timeWindow, initialTimeseriesData]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      {/* Header */}
      {marketName && (
        <div className="mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
            {marketName}
          </h1>
          {description && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
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
              {(["30d", "6m", "1y"] as const).map((window) => (
                <button
                  key={window}
                  onClick={() => setTimeWindow(window)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    timeWindow === window
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {window === "30d" ? "30d" : window === "6m" ? "6m" : "1y"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[280px] text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-2"></div>
                <div className="text-sm">Loading chart data...</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <div className="text-center text-sm">{error}</div>
              {trendsDataChart.length > 0 && (
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Showing cached data
                </div>
              )}
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
