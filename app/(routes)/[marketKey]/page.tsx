import { notFound } from "next/navigation";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import { CompoundMetricsBlock } from "@/app/components/market/CompoundMetricsBlock";
import { ReservesTable } from "@/app/components/tables/ReservesTable";
import { MarketName } from "@/app/components/MarketName";
import { queryReserves } from "@/lib/api/aavekit";
import { normalizeAddress } from "@/lib/utils/address";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  calculateMarketTotals,
  priceToUSD,
} from "@/lib/calculations/totals";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { withRetry } from "@/lib/utils/retry";
import { BigNumber } from "@/lib/utils/big-number";
import { prisma } from "@/lib/db/prisma";
import { calculateMarketTrends } from "@/lib/calculations/trends";

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
    // Fetch reserves with retry
    const aaveKitReserves = await withRetry(() => queryReserves(marketKey), {
      onRetry: (attempt, error) => {
        console.warn(`Retry ${attempt} for market ${marketKey}:`, error.message);
      },
    });

    // Transform to Reserve entities
    const reserves: Reserve[] = aaveKitReserves.map((r) => {
      const normalizedAddress = normalizeAddress(r.underlyingAsset);
      const priceUSD = priceToUSD(r.price.priceInEth, r.symbol, normalizedAddress);
      const decimals = r.decimals;

      const suppliedTokens = new BigNumber(r.totalATokenSupply);
      const borrowedTokens = new BigNumber(r.totalCurrentVariableDebt);
      const availableLiquidity = new BigNumber(r.availableLiquidity);

      const totalSuppliedUSD = calculateTotalSuppliedUSD(
        r.totalATokenSupply,
        decimals,
        priceUSD
      );
      const totalBorrowedUSD = calculateTotalBorrowedUSD(
        r.totalCurrentVariableDebt,
        decimals,
        priceUSD
      );

      // Calculate utilization
      const utilizationRate =
        borrowedTokens.plus(availableLiquidity).eq(0)
          ? 0
          : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();

      // AaveKit returns APY as decimal (e.g., 0.05 = 5%)
      // PercentValue.value is normalized (1.0 = 100%), so use directly
      const supplyAPR = new BigNumber(r.currentLiquidityRate).toNumber();
      const borrowAPR = r.currentVariableBorrowRate !== "0"
        ? new BigNumber(r.currentVariableBorrowRate).toNumber()
        : 0;

      return {
        underlyingAsset: normalizedAddress,
        symbol: r.symbol,
        name: r.name,
        decimals,
        imageUrl: r.imageUrl,
        currentState: {
          suppliedTokens: suppliedTokens.toString(),
          borrowedTokens: borrowedTokens.toString(),
          availableLiquidity: availableLiquidity.toString(),
          supplyAPR,
          borrowAPR,
          utilizationRate,
          oraclePrice: priceUSD,
          totalSuppliedUSD,
          totalBorrowedUSD,
        },
      };
    });

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
  window: "30d" | "6m" | "1y" = "30d"
): Promise<TimeseriesData[]> {
  try {
    // Try to fetch from database first (fast path)
    const dbData = await prisma.marketTimeseries.findMany({
      where: {
        marketKey,
        window,
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
        totalSuppliedUSD: true,
        totalBorrowedUSD: true,
        availableLiquidityUSD: true,
      },
    });

    // If we have data in DB, return it immediately
    if (dbData.length > 0) {
      return dbData.map((row) => ({
        date: row.date.toISOString().split('T')[0],
        totalSuppliedUSD: row.totalSuppliedUSD,
        totalBorrowedUSD: row.totalBorrowedUSD,
        availableLiquidityUSD: row.availableLiquidityUSD,
      }));
    }

    // Fallback: Calculate from Subgraph if DB is empty (slow path)
    console.warn(`⚠️  No DB data for ${marketKey} (${window}), falling back to Subgraph`);
    
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
  const [marketData, timeseriesData, trendsResponse] = await Promise.all([
    getMarketData(marketKey),
    getTimeseriesData(marketKey, "30d"),
    // Получаем тренды для изменений (может быть null при ошибке)
    calculateMarketTrends(marketKey, "30d").catch(() => null),
  ]);

  if (!marketData) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <CompoundMetricsBlock
        marketKey={marketKey}
        currentTotals={marketData.totals}
        initialTimeseriesData={timeseriesData}
        trendsData={trendsResponse?.totals}
        marketName={<MarketName displayName={market.displayName} marketKey={marketKey} logoSize={20} />}
        description="Market overview with all assets and key metrics"
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Assets
        </h2>
        <ReservesTable reserves={marketData.reserves} marketKey={marketKey} />
      </div>
    </div>
  );
}
