import { TrendsSummaryCards } from "@/app/components/trends/TrendsSummaryCards";
import { TrendsTotalChart } from "@/app/components/charts/TrendsTotalChart";
import { TrendsByAssetChart } from "@/app/components/charts/TrendsByAssetChart";
import { TrendsChangesTable } from "@/app/components/tables/TrendsChangesTable";
import { MarketTrendsResponse } from "@/lib/calculations/trends";
import { validateMarketKey } from "@/lib/utils/market";

async function getTrendsData(
  marketKey: string,
  window: "7d" | "30d" | "3m" | "6m" | "1y" = "30d"
): Promise<MarketTrendsResponse | null> {
  if (!validateMarketKey(marketKey)) {
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/market/${marketKey}/timeseries?window=${window}`,
      {
        next: { revalidate: 3600 }, // Revalidate every hour
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching trends data:", error);
    return null;
  }
}

export default async function SupplyChangePage({
  params,
  searchParams,
}: {
  params: { marketKey: string };
  searchParams: { window?: string };
}) {
  const { marketKey } = params;
  const window = (searchParams.window || "30d") as "7d" | "30d" | "3m" | "6m" | "1y";

  const data = await getTrendsData(marketKey, window);

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Error loading trends data. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Supply Changes - {marketKey}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        View supply trends and changes over time
      </p>

      <TrendsSummaryCards
        totalSuppliedUSD={data.totals.currentTotalSuppliedUSD}
        totalBorrowedUSD={data.totals.currentTotalBorrowedUSD}
        change1d={data.totals.change1d}
        change7d={data.totals.change7d}
        change30d={data.totals.change30d}
        mode="supply"
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Total Supply Over Time
        </h2>
        <TrendsTotalChart data={data.data} mode="supply" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Supply by Asset (Top 10)
        </h2>
        <TrendsByAssetChart assets={data.assetChanges} mode="supply" limit={10} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Supply Changes by Asset
        </h2>
        <TrendsChangesTable data={data.assetChanges} mode="supply" />
      </div>
    </div>
  );
}
