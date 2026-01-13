import { Suspense } from "react";
import { StablecoinsTable } from "@/app/components/tables/StablecoinsTable";
import { StablecoinsTotals } from "@/app/components/stablecoins/StablecoinsTotals";
import {
  aggregateStablecoinsData,
  AggregatedStablecoinData,
} from "@/lib/calculations/stablecoins";
import { liveDataCache } from "@/lib/cache/cache-instances";

async function getStablecoinsData(): Promise<AggregatedStablecoinData[]> {
  // Check cache first
  const cacheKey = "stablecoins:aggregated";
  const cached = liveDataCache.get(cacheKey);
  if (cached) {
    const cachedData = cached as unknown as { data: AggregatedStablecoinData[] };
    return cachedData.data;
  }

  try {
    // Call the function directly instead of HTTP request
    // This is more efficient and avoids network issues
    const data = await aggregateStablecoinsData();

    // Cache response
    liveDataCache.set(cacheKey, { data } as Record<string, unknown>);

    return data;
  } catch (error) {
    // Try to return stale cache
    const stale = liveDataCache.get(cacheKey);
    if (stale) {
      const staleData = stale as unknown as { data: AggregatedStablecoinData[] };
      return staleData.data;
    }

    // Provide more detailed error information
    if (error instanceof Error) {
      throw new Error(`Failed to aggregate stablecoins data: ${error.message}`);
    }
    throw new Error(`Unknown error: ${String(error)}`);
  }
}

function calculateTotals(
  data: AggregatedStablecoinData[]
): { totalSuppliedUSD: number; totalBorrowedUSD: number } {
  return data.reduce(
    (acc, stablecoin) => ({
      totalSuppliedUSD: acc.totalSuppliedUSD + stablecoin.totalSuppliedUSD,
      totalBorrowedUSD: acc.totalBorrowedUSD + stablecoin.totalBorrowedUSD,
    }),
    { totalSuppliedUSD: 0, totalBorrowedUSD: 0 }
  );
}

export default async function StablecoinsPage() {
  let data: AggregatedStablecoinData[] = [];
  let error: string | null = null;

  try {
    data = await getStablecoinsData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
    console.error("Error fetching stablecoins:", e);
  }

  const totals = calculateTotals(data);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Stablecoins Across Markets
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        View all stablecoins across different markets with comparison and filtering
      </p>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
            Error loading stablecoins data
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error}
          </p>
          <p className="text-red-600 dark:text-red-400 text-xs mt-2">
            If this error persists, please check server logs and ensure all environment variables are configured correctly.
          </p>
        </div>
      ) : (
        <>
          <StablecoinsTotals totals={totals} />
          <Suspense fallback={<div>Loading stablecoins...</div>}>
            <StablecoinsTable data={data} />
          </Suspense>
        </>
      )}
    </div>
  );
}
