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
import { queryReserve } from "@/lib/api/aavekit";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  priceToUSD,
} from "@/lib/calculations/totals";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { withRetry } from "@/lib/utils/retry";
import { BigNumber } from "@/lib/utils/big-number";
import { calculateAverageLendingRates } from "@/lib/calculations/apr";

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
    const aaveKitReserve = await withRetry(() => queryReserve(marketKey, normalizedAddress), {
      onRetry: (attempt, error) => {
        console.warn(`Retry ${attempt} for reserve ${marketKey}/${normalizedAddress}:`, error.message);
      },
    });

    if (!aaveKitReserve) {
      return null;
    }

    const priceUSD = priceToUSD(
      aaveKitReserve.price.priceInEth,
      aaveKitReserve.symbol,
      normalizedAddress
    );
    const decimals = aaveKitReserve.decimals;

    const suppliedTokens = new BigNumber(aaveKitReserve.totalATokenSupply);
    const borrowedTokens = new BigNumber(aaveKitReserve.totalCurrentVariableDebt);
    const availableLiquidity = new BigNumber(aaveKitReserve.availableLiquidity);

    const totalSuppliedUSD = calculateTotalSuppliedUSD(
      aaveKitReserve.totalATokenSupply,
      decimals,
      priceUSD
    );
    const totalBorrowedUSD = calculateTotalBorrowedUSD(
      aaveKitReserve.totalCurrentVariableDebt,
      decimals,
      priceUSD
    );

    const utilizationRate =
      borrowedTokens.plus(availableLiquidity).eq(0)
        ? 0
        : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();

    // AaveKit returns APY as decimal (e.g., 0.05 = 5%)
    // Convert to number directly (no Ray conversion needed)
    const supplyAPR = new BigNumber(aaveKitReserve.currentLiquidityRate).toNumber();
    const borrowAPR = aaveKitReserve.currentVariableBorrowRate !== "0"
      ? new BigNumber(aaveKitReserve.currentVariableBorrowRate).toNumber()
      : 0;

    const reserve = {
      underlyingAsset: normalizedAddress,
      symbol: aaveKitReserve.symbol,
      name: aaveKitReserve.name,
      decimals,
      imageUrl: aaveKitReserve.imageUrl,
      currentState: {
        supplyAPR,
        borrowAPR,
        suppliedTokens: suppliedTokens.toString(),
        borrowedTokens: borrowedTokens.toString(),
        availableLiquidity: availableLiquidity.toString(),
        totalSuppliedUSD,
        totalBorrowedUSD,
        utilizationRate,
        oraclePrice: priceUSD,
        liquidityIndex: aaveKitReserve.liquidityIndex,
        variableBorrowIndex: aaveKitReserve.variableBorrowIndex,
        lastUpdateTimestamp: aaveKitReserve.lastUpdateTimestamp,
      },
    };

    liveDataCache.set(cacheKey, reserve);
    return reserve;
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
  // Use internal API calls - Next.js will optimize these
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const timeout = 65000; // 65 seconds (slightly more than endpoint timeout)

  const fetchWithTimeout = (url: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(url, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timeoutId);
        return response;
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
      });
  };

  try {
    const [dailyResponse, monthlyResponse] = await Promise.allSettled([
      fetchWithTimeout(
        `${baseUrl}/api/v1/reserve/${marketKey}/${underlying}/snapshots/daily`
      ).catch(() => ({ ok: false, json: async () => [] })),
      fetchWithTimeout(
        `${baseUrl}/api/v1/reserve/${marketKey}/${underlying}/snapshots/monthly`
      ).catch(() => ({ ok: false, json: async () => [] })),
    ]);

    const daily =
      dailyResponse.status === "fulfilled" && dailyResponse.value.ok
        ? await dailyResponse.value.json()
        : [];
    const monthly =
      monthlyResponse.status === "fulfilled" && monthlyResponse.value.ok
        ? await monthlyResponse.value.json()
        : [];

    return { daily, monthly };
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    return { daily: [], monthly: [] };
  }
}

async function getLiquidityImpactData(marketKey: string, underlying: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/reserve/${marketKey}/${underlying}/liquidity-impact`,
      { next: { revalidate: 60 } }
    ).catch(() => ({ ok: false, json: async () => ({ results: [] }) }));
    if (!response.ok) {
      return { results: [] };
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching liquidity impact:", error);
    return { results: [] };
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

  // Fetch data in parallel - use graceful degradation
  const [reserve, snapshots, liquidityImpact] = await Promise.allSettled([
    getReserveData(marketKey, normalizedAddress),
    getSnapshotsData(marketKey, normalizedAddress),
    getLiquidityImpactData(marketKey, normalizedAddress),
  ]);

  const reserveData = reserve.status === "fulfilled" ? reserve.value : null;
  const snapshotsData = snapshots.status === "fulfilled" ? snapshots.value : { daily: [], monthly: [] };
  const liquidityImpactData = liquidityImpact.status === "fulfilled" ? liquidityImpact.value : { results: [] };

  if (!reserveData) {
    notFound();
  }

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
