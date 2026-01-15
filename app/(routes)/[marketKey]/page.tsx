import { notFound } from "next/navigation";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import { CompoundMetricsBlock } from "@/app/components/market/CompoundMetricsBlock";
import { ReservesTable } from "@/app/components/tables/ReservesTable";
import { MarketName } from "@/app/components/MarketName";
import { getMarketReservesFromDB } from "@/lib/api/db-market-data";
import { calculateMarketTotals } from "@/lib/calculations/totals";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { prisma } from "@/lib/db/prisma";
import { calculateMarketTrends } from "@/lib/calculations/trends";
import { usesSubgraphForHistory } from "@/lib/utils/data-source";

interface MarketPageProps {
  params: Promise<{ marketKey: string }>;
}

interface Reserve {
  underlyingAsset: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl?: string;
  currentState: {
    suppliedTokens: string;
    borrowedTokens: string;
    availableLiquidity: string;
    supplyAPR: number;
    borrowAPR: number;
    utilizationRate: number;
    oraclePrice: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
  };
}

async function getMarketData(marketKey: string) {
  // Check cache
  const cacheKey = `market:${marketKey}`;
  const cached = liveDataCache.get(cacheKey);
  if (cached) {
    return cached as { reserves: Reserve[]; totals: ReturnType<typeof calculateMarketTotals> };
  }

  try {
    // All markets now use DB for current data (collected from AaveKit API via daily cron)
    const reserves = await getMarketReservesFromDB(marketKey);

    // Calculate market totals
    const totals = calculateMarketTotals(reserves);

    const response = { reserves, totals };

    // Cache response
    liveDataCache.set(cacheKey, response);

    return response;
  } catch (error) {
    console.error(`Error fetching market data for ${marketKey}:`, error);
    // Try to return stale cache
    const stale = liveDataCache.get(cacheKey);
    if (stale) {
      return stale as { reserves: Reserve[]; totals: ReturnType<typeof calculateMarketTotals> };
    }
    throw error;
  }
}

interface TimeseriesData {
  date: string;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  availableLiquidityUSD: number;
}

async function getTimeseriesData(
  marketKey: string,
  window: "7d" | "30d" | "3m" | "6m" | "1y" = "30d"
): Promise<TimeseriesData[]> {
  try {
    // Historical data can come from 'subgraph' or 'aavekit' in DB
    // Check both sources for historical data
    // Calculate cutoff date for the window (only last N days)
    const expectedDays = window === "7d" ? 7 : window === "30d" ? 30 : window === "3m" ? 90 : window === "6m" ? 180 : 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - expectedDays);
    cutoffDate.setUTCHours(0, 0, 0, 0);

    // Try to fetch from database first (fast path)
    // Filter by date to only return data for the requested window period
    // Historical data can be from 'subgraph' or 'aavekit' source
    const dbData = await prisma.marketTimeseries.findMany({
      where: {
        marketKey,
        window,
        dataSource: { in: ['subgraph', 'aavekit'] }, // Check both sources
        date: {
          gte: cutoffDate, // Only data from the last N days
        },
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
        totalSuppliedUSD: true,
        totalBorrowedUSD: true,
        availableLiquidityUSD: true,
        updatedAt: true,
      },
    });

    // If we have data in DB, return it immediately
    if (dbData.length > 0) {
      // Log data freshness for debugging
      const latestUpdate = dbData[dbData.length - 1]?.updatedAt;
      if (latestUpdate) {
        const hoursSinceUpdate = (Date.now() - latestUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24) {
          console.warn(
            `⚠️  [getTimeseriesData] Data for ${marketKey} (${window}) is ${hoursSinceUpdate.toFixed(1)} hours old. ` +
            `Last updated: ${latestUpdate.toISOString()}. Consider running sync.`
          );
        }
      }
      
      return dbData.map((row) => ({
        date: row.date.toISOString().split('T')[0],
        totalSuppliedUSD: row.totalSuppliedUSD,
        totalBorrowedUSD: row.totalBorrowedUSD,
        availableLiquidityUSD: row.availableLiquidityUSD,
      }));
    }

    // Fallback: All markets can use Subgraph for historical data if not in DB
    // Historical data comes from Subgraph (as per original spec)
    console.warn(`⚠️  No DB data for ${marketKey} (${window}), falling back to Subgraph`);
    
    try {
      const trendsData = await calculateMarketTrends(marketKey, window);
      
      if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
        return [];
      }

      return trendsData.data.map((trend) => ({
        date: trend.date,
        totalSuppliedUSD: trend.totalSuppliedUSD,
        totalBorrowedUSD: trend.totalBorrowedUSD,
        availableLiquidityUSD: trend.availableLiquidityUSD,
      }));
    } catch (error) {
      console.error(`Failed to fetch historical data from Subgraph for ${marketKey}:`, error);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching timeseries for ${marketKey}:`, error);
    return [];
  }
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { marketKey } = await params;

  // Validate market key
  if (!validateMarketKey(marketKey)) {
    notFound();
  }

  const market = getMarket(marketKey);
  if (!market) {
    notFound();
  }

  // Fetch market data, timeseries data, and trends in parallel
  // Use 7d as default window as requested
  const [marketData, timeseriesData, trendsResponse] = await Promise.allSettled([
    getMarketData(marketKey),
    getTimeseriesData(marketKey, "7d"),
    // Получаем тренды для изменений (может быть null при ошибке)
    // Calculate trends for all markets (historical data from Subgraph)
    // All markets can use Subgraph for historical data
    calculateMarketTrends(marketKey, "7d").catch(() => null),
  ]);

  // Handle errors gracefully
  if (marketData.status === "rejected" || !marketData.value) {
    const errorMessage = marketData.status === "rejected" 
      ? marketData.reason?.message || String(marketData.reason)
      : "No data";
    console.error("Failed to fetch market data:", errorMessage);
    
    // Check if it's a "no data in DB" error for ethereum-v3
    const isEthereumV3NoData = marketKey === 'ethereum-v3' && 
      errorMessage.includes('No data found in database');
    
    // Instead of showing 404, show the page with an error message
    // This allows users to see the page structure even if data fetch fails
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            {isEthereumV3NoData ? "Data Collection in Progress" : "Error Loading Market Data"}
          </h2>
          {isEthereumV3NoData ? (
            <>
              <p className="text-yellow-600 dark:text-yellow-300 mb-4">
                Data for this market is being collected. This may take a few minutes.
              </p>
              <p className="text-sm text-yellow-500 dark:text-yellow-400">
                The daily cron job will collect data from AaveKit API and store it in the database. 
                Please check back in a few minutes.
              </p>
            </>
          ) : (
            <>
              <p className="text-yellow-600 dark:text-yellow-300 mb-4">
                Unable to fetch market data. This may be due to:
              </p>
              <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-300 space-y-1 mb-4">
                <li>Data not yet collected (cron job may not have run yet)</li>
                <li>API service temporarily unavailable</li>
                <li>Network connectivity issues</li>
              </ul>
              <p className="text-sm text-yellow-500 dark:text-yellow-400">
                Please try refreshing the page in a few moments.
              </p>
            </>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {market.displayName}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Market data will appear here once the API connection is restored.
          </p>
        </div>
      </div>
    );
  }

  const resolvedMarketData = marketData.value;
  const resolvedTimeseriesData = timeseriesData.status === "fulfilled" ? timeseriesData.value : [];
  const resolvedTrendsData = trendsResponse.status === "fulfilled" ? trendsResponse.value?.totals : undefined;

  return (
    <div className="container mx-auto px-4 py-6">
      <CompoundMetricsBlock
        marketKey={marketKey}
        currentTotals={resolvedMarketData.totals}
        initialTimeseriesData={resolvedTimeseriesData}
        trendsData={resolvedTrendsData}
        marketName={<MarketName displayName={market.displayName} marketKey={marketKey} logoSize={20} />}
        description="Market overview with all assets and key metrics"
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Assets
        </h2>
        <ReservesTable reserves={resolvedMarketData.reserves} marketKey={marketKey} />
      </div>
    </div>
  );
}
