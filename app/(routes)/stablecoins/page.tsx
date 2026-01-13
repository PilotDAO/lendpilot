import { Suspense } from "react";
import { StablecoinsTable } from "@/app/components/tables/StablecoinsTable";
import { StablecoinsTotals } from "@/app/components/stablecoins/StablecoinsTotals";
import { AggregatedStablecoinData } from "@/lib/calculations/stablecoins";

async function getStablecoinsData(): Promise<AggregatedStablecoinData[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/v1/stablecoins`, {
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  });

  if (!response.ok) {
    throw new Error("Failed to fetch stablecoins data");
  }

  return response.json();
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
          <p className="text-red-800 dark:text-red-200">
            Error loading stablecoins data: {error}
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
