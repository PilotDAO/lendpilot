import { notFound } from "next/navigation";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { AssetTopCards } from "@/app/components/asset/AssetTopCards";
import { MarketName } from "@/app/components/MarketName";
import dynamic from "next/dynamic";

const MainChartWrapper = dynamic(
  () => import("@/app/components/charts/MainChartWrapper").then((mod) => ({ default: mod.MainChartWrapper })),
  { ssr: false }
);
import { AverageLendingRatesTable } from "@/app/components/asset/AverageLendingRatesTable";
import { DailySnapshotsTable } from "@/app/components/asset/DailySnapshotsTable";
import { MonthlySnapshotsTable } from "@/app/components/asset/MonthlySnapshotsTable";
import { LiquidityImpactTable } from "@/app/components/asset/LiquidityImpactTable";
import { getReserveFromDB } from "@/lib/api/db-market-data";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { BigNumber } from "@/lib/utils/big-number";
import { calculateAverageLendingRates } from "@/lib/calculations/apr";
import { prisma } from "@/lib/db/prisma";
import type { DailySnapshot } from "@/lib/calculations/snapshots";
import { aggregateMonthlySnapshots } from "@/lib/calculations/snapshots";
import {
  calculateLiquidityImpact,
  type ReserveParameters,
} from "@/lib/calculations/liquidity-impact";
import scenarios from "@/data/liquidityImpactScenarios.json";

interface AssetPageProps {
  params: Promise<{ marketKey: string; assetAddress: string }>;
}

async function getReserveData(
  marketKey: string,
  underlying: string
): Promise<ReserveData | null> {
  // Normalize address for cache key
  const normalizedAddress = normalizeAddress(underlying);
  const cacheKey = `reserve:${marketKey}:${normalizedAddress}`;
  const cached = liveDataCache.get(cacheKey);
  if (cached) {
    return cached as unknown as ReserveData;
  }

  return fetchReserveData(marketKey, normalizedAddress, cacheKey);
}

interface ReserveData {
  underlyingAsset: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl?: string;
  currentState: {
    supplyAPR: number;
    borrowAPR: number;
    suppliedTokens: string;
    borrowedTokens: string;
    availableLiquidity: string;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    utilizationRate: number;
    oraclePrice: number;
    liquidityIndex: string;
    variableBorrowIndex: string;
    lastUpdateTimestamp: number;
  };
}

async function fetchReserveData(
  marketKey: string,
  normalizedAddress: string,
  cacheKey: string
): Promise<ReserveData | null> {
  try {
    // All markets now use DB for current data (collected from AaveKit API via daily cron)
    const reserve = await getReserveFromDB(marketKey, normalizedAddress);

    if (!reserve) {
      return null;
    }

    // Transform to ReserveData format (add missing fields if needed)
    const reserveData: ReserveData = {
      underlyingAsset: reserve.underlyingAsset,
      symbol: reserve.symbol,
      name: reserve.name,
      decimals: reserve.decimals,
      imageUrl: reserve.imageUrl,
      currentState: {
        ...reserve.currentState,
        // These fields are not in DB currentState, set defaults
        liquidityIndex: "0",
        variableBorrowIndex: "0",
        lastUpdateTimestamp: 0,
      },
    };

    liveDataCache.set(cacheKey, reserveData as unknown as Record<string, unknown>);
    return reserveData;
  } catch (error) {
    console.error(`Error fetching reserve ${marketKey}/${normalizedAddress}:`, error);
    const stale = liveDataCache.get(cacheKey);
    if (stale) {
      return stale as unknown as ReserveData;
    }
    throw error;
  }
}

async function getSnapshotsData(marketKey: string, underlying: string) {
  try {
    // Read directly from DB to avoid dependency on NEXT_PUBLIC_APP_URL (can be misconfigured in local dev)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    cutoffDate.setUTCHours(0, 0, 0, 0);

    const rows = await prisma.assetSnapshot.findMany({
      where: {
        marketKey,
        underlyingAsset: underlying,
        date: { gte: cutoffDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        timestamp: true,
        blockNumber: true,
        supplyAPR: true,
        borrowAPR: true,
        totalSuppliedUSD: true,
        totalBorrowedUSD: true,
        utilizationRate: true,
        oraclePrice: true,
        liquidityIndex: true,
        variableBorrowIndex: true,
      },
    });

    const daily: DailySnapshot[] = rows.map((s) => ({
      date: s.date.toISOString().split("T")[0],
      timestamp: Number(s.timestamp),
      blockNumber: Number(s.blockNumber),
      supplyAPR: s.supplyAPR,
      borrowAPR: s.borrowAPR,
      totalSuppliedUSD: s.totalSuppliedUSD,
      totalBorrowedUSD: s.totalBorrowedUSD,
      utilizationRate: s.utilizationRate,
      price: s.oraclePrice,
      liquidityIndex: s.liquidityIndex,
      variableBorrowIndex: s.variableBorrowIndex,
    }));

    const monthly = aggregateMonthlySnapshots(daily);
    return { daily, monthly };
  } catch (error) {
    console.error("Error fetching snapshots from DB:", error);
    return { daily: [], monthly: [] };
  }
}

function loadScenariosForUnderlying(normalizedUnderlying: string): Array<{ action: "Deposit" | "Borrow" | "Repay" | "Withdraw"; amount: string }> {
  const cfg = scenarios as any;
  return cfg.overrides?.[normalizedUnderlying] || cfg.default || [];
}

async function getLiquidityImpactData(marketKey: string, underlying: string, reserveData: ReserveData) {
  try {
    // All markets now use DB for current data (collected from AaveKit API via daily cron)
    let reserve: any;
    try {
      reserve = await getReserveFromDB(marketKey, underlying);
    } catch (dbError) {
      console.warn(`Failed to fetch reserve from DB for ${marketKey}/${underlying}:`, dbError);
      // Continue with defaults if DB lookup fails
    }

    // Extract parameters from reserve (now available from DB)
    // Use defaults if parameters are not available
    const optimalUsageRate = reserve?.optimalUsageRate
      ? new BigNumber(reserve.optimalUsageRate).toNumber()
      : 0.8;
    const baseRate = reserve?.baseVariableBorrowRate
      ? new BigNumber(reserve.baseVariableBorrowRate).toNumber()
      : 0.0;
    const slope1 = reserve?.variableRateSlope1
      ? new BigNumber(reserve.variableRateSlope1).toNumber()
      : 0.04;
    const slope2 = reserve?.variableRateSlope2
      ? new BigNumber(reserve.variableRateSlope2).toNumber()
      : 0.75;
    const reserveFactor = reserve?.reserveFactor
      ? new BigNumber(reserve.reserveFactor).toNumber()
      : 0.1;

    const params: ReserveParameters = {
      optimalUtilization: optimalUsageRate,
      baseRate,
      slope1,
      slope2,
    };

    const currentState = reserveData.currentState;
    const scenariosList = loadScenariosForUnderlying(underlying);

    const results = scenariosList.map((scenario) => {
      const impact = calculateLiquidityImpact(
        {
          borrowedUSD: currentState.totalBorrowedUSD,
          availableUSD: currentState.totalSuppliedUSD - currentState.totalBorrowedUSD,
          supplyAPR: currentState.supplyAPR,
          borrowAPR: currentState.borrowAPR,
        },
        { action: scenario.action, amountUSD: parseFloat(scenario.amount) },
        params,
        reserveFactor
      );

      return {
        scenario: { action: scenario.action, amountUSD: parseFloat(scenario.amount) },
        impact,
      };
    });

    return { results };
  } catch (error) {
    console.error("Error calculating liquidity impact:", error);
    return { results: [] as any[] };
  }
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { marketKey, assetAddress } = await params;

  // Validate inputs
  if (!validateMarketKey(marketKey) || !validateAddress(assetAddress)) {
    notFound();
  }

  const normalizedAddress = normalizeAddress(assetAddress);
  const market = getMarket(marketKey);
  if (!market) {
    notFound();
  }

  // Fetch reserve + snapshots in parallel (liquidity impact depends on reserve data)
  const [reserve, snapshots] = await Promise.allSettled([
    getReserveData(marketKey, normalizedAddress),
    getSnapshotsData(marketKey, normalizedAddress),
  ]);

  const reserveData = reserve.status === "fulfilled" ? reserve.value : null;
  const snapshotsData = snapshots.status === "fulfilled" ? snapshots.value : { daily: [], monthly: [] };

  if (!reserveData) {
    notFound();
  }

  const liquidityImpactData = await getLiquidityImpactData(marketKey, normalizedAddress, reserveData);

  // Calculate average lending rates from daily snapshots
  const averageRates = calculateAverageLendingRates(
    snapshotsData.daily.map((s: { liquidityIndex: string; variableBorrowIndex: string; timestamp: number }) => ({
      liquidityIndex: s.liquidityIndex,
      variableBorrowIndex: s.variableBorrowIndex,
      timestamp: s.timestamp,
    }))
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <AssetTopCards 
        reserve={reserveData} 
        marketDisplayName={market.displayName}
        marketKey={marketKey}
        contractAddress={normalizedAddress}
      />

      {snapshots.status === "rejected" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            Historical data temporarily unavailable. Showing current state only.
          </p>
        </div>
      )}

      <div className="mb-6">
        <MainChartWrapper data={snapshotsData.daily} />
      </div>

      <div className="mb-6">
        <AverageLendingRatesTable rates={averageRates} />
      </div>

      <div className="mb-6">
        <DailySnapshotsTable
          snapshots={snapshotsData.daily}
          marketKey={marketKey}
          underlying={normalizedAddress}
        />
      </div>

      <div className="mb-6">
        <MonthlySnapshotsTable
          snapshots={snapshotsData.monthly}
          marketKey={marketKey}
          underlying={normalizedAddress}
        />
      </div>

      {liquidityImpactData.results && liquidityImpactData.results.length > 0 && (
        <div className="mb-6">
          <LiquidityImpactTable 
            results={liquidityImpactData.results}
            currentState={reserveData.currentState}
          />
        </div>
      )}
    </div>
  );
}
