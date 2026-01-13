import Link from "next/link";
import { loadMarkets } from "@/lib/utils/market";
import { MarketName } from "@/app/components/MarketName";

export default function Home() {
  const markets = loadMarkets();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          LendPilot
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Live and historical Lending market rates by <strong>DAO Pilot</strong>
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Markets
        </h2>
        <div className="space-y-4">
          {markets.map((market) => (
            <Link
              key={market.marketKey}
              href={`/${market.marketKey}`}
              className="block bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                <MarketName displayName={market.displayName} logoSize={20} />
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Market Key: {market.marketKey}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/stablecoins"
            className="block bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Stablecoins
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View all stablecoins across markets
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
