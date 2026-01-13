import Link from "next/link";

export default function APIDocumentationPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          API Documentation
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Backend-for-Frontend (BFF) API for LendPilot - Lending market rates analytics
        </p>
      </div>

      <div className="space-y-8">
        {/* Overview */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Overview
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This API provides aggregated data from multiple sources (AaveKit GraphQL, The Graph
            Subgraph, Ethereum RPC) with caching, retry logic, and rate limiting. All endpoints
            return JSON responses unless otherwise specified.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Base URL:</strong> <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">/api/v1</code>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              <strong>Rate Limits:</strong> 100 req/min (live data), 20 req/min (historical data)
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              <strong>Cache TTL:</strong> 30-60s (live), 6-24h (historical)
            </p>
          </div>
        </section>

        {/* Markets Endpoints */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Markets
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/markets</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns list of all configured markets.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`Response: {
  "markets": [
    {
      "marketKey": "ethereum-v3",
      "displayName": "Ethereum V3",
      "poolAddress": "0x...",
      "subgraphId": "...",
      "chainId": 1
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/market/{`{marketKey}`}</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns current state of all assets in a market with totals.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`Response: {
  "reserves": [
    {
      "underlyingAsset": "0x...",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "imageUrl": "...",
      "currentState": {
        "supplyAPR": 0.05,
        "borrowAPR": 0.08,
        "totalSuppliedUSD": 1000000,
        "totalBorrowedUSD": 500000,
        "utilizationRate": 0.5
      }
    }
  ],
  "totals": {
    "totalSupply": 1000000000,
    "supply": 500000000,
    "borrowing": 500000000,
    "assetCount": 60
  }
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/market/{`{marketKey}`}/timeseries?window=30d|6m|1y</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns market totals time series data for the specified time window.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`Response: {
  "marketKey": "ethereum-v3",
  "data": [
    {
      "date": "2025-01-01",
      "timestamp": 1735689600,
      "totalSuppliedUSD": 1000000000,
      "totalBorrowedUSD": 500000000,
      "availableLiquidityUSD": 500000000
    }
  ],
  "assetChanges": [...],
  "totals": {...}
}`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Reserves Endpoints */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Reserves
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/reserve/{`{marketKey}`}/{`{underlying}`}</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns current state and metadata for a specific asset.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/reserve/{`{marketKey}`}/{`{underlying}`}/snapshots/daily</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns daily snapshots for the last 90 days.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/reserve/{`{marketKey}`}/{`{underlying}`}/snapshots/monthly</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns monthly aggregated snapshots for the last 24 months.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/reserve/{`{marketKey}`}/{`{underlying}`}/snapshots/daily/csv</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns daily snapshots as CSV file. Format: comma separator, UTF-8 encoding, ISO dates (YYYY-MM-DD).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/reserve/{`{marketKey}`}/{`{underlying}`}/liquidity-impact</code>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Returns calculated liquidity impact scenarios for different transaction sizes.
              </p>
            </div>
          </div>
        </section>

        {/* Stablecoins Endpoint */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Stablecoins
          </h2>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              GET <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">/stablecoins</code>
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Returns aggregated stablecoin data across all markets.
            </p>
          </div>
        </section>

        {/* Calculation Formulas */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Calculation Formulas
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                APR Calculation (Index-Based)
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Historical APR is calculated from liquidity and borrow indices using compound interest formula:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`dailyGrowth = (indexEnd / indexStart)^(1/days)
APR = (dailyGrowth - 1) * 365

Where:
- indexStart: Index value at start of period
- indexEnd: Index value at end of period
- days: Number of days in period
- Indices are stored as Ray (1e27) values`}
                </pre>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This formula provides accurate historical APR based on actual index growth, not current rates.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Market Totals Calculation
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Market-level totals are calculated by aggregating all reserves:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`Total Supply = Σ(totalSuppliedUSD for all reserves)
Total Borrowing = Σ(totalBorrowedUSD for all reserves)
Available Supply = Total Supply - Total Borrowing

Where:
- totalSuppliedUSD = (totalATokenSupply / 10^decimals) * priceUSD
- totalBorrowedUSD = (totalCurrentVariableDebt / 10^decimals) * priceUSD
- priceUSD = usdExchangeRate * 1e8 (converted from AaveKit format)`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Utilization Rate
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Utilization rate indicates how much of available liquidity is borrowed:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`utilizationRate = borrowed / (borrowed + availableLiquidity)

Where:
- borrowed: Total current variable debt
- availableLiquidity: Available liquidity for borrowing`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Data Formats */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Data Formats
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Addresses
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                All addresses are normalized to lowercase and validated as Ethereum addresses (0x + 40 hex characters).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Dates
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                All dates are in ISO format (YYYY-MM-DD). Timestamps are Unix seconds (number).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Numbers
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Large numbers (onchain values) are stored as strings to avoid precision loss. USD values are numbers with 2 decimal precision. APR values are numbers (0-1 range, e.g., 0.05 = 5%).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                CSV Export
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                CSV files use comma separator, UTF-8 encoding, ISO date format (YYYY-MM-DD). USD values have 2 decimals, APR values have 4 decimals.
              </p>
            </div>
          </div>
        </section>

        {/* Error Responses */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Error Responses
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Standard Error Format
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Optional additional details"
  }
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Error Codes
              </h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">INVALID_MARKET</code> - Invalid market key</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">INVALID_ADDRESS</code> - Invalid asset address</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">MARKET_NOT_FOUND</code> - Market not found</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">RESERVE_NOT_FOUND</code> - Asset not found in market</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">UPSTREAM_ERROR</code> - External API error</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">RATE_LIMIT_EXCEEDED</code> - Too many requests (429)</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">INTERNAL_ERROR</code> - Server error (500)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Usage Examples */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Usage Examples
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Fetch Market Data
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`fetch('/api/v1/market/ethereum-v3')
  .then(res => res.json())
  .then(data => {
    console.log('Total Supply:', data.totals.totalSupply);
    console.log('Reserves:', data.reserves);
  });`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Fetch Asset Snapshots
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`const address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
fetch(\`/api/v1/reserve/ethereum-v3/\${address}/snapshots/daily\`)
  .then(res => res.json())
  .then(snapshots => {
    console.log('Daily snapshots:', snapshots);
  });`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Download CSV
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
{`// Trigger CSV download
window.location.href = 
  '/api/v1/reserve/ethereum-v3/0x.../snapshots/daily/csv';`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Links */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Additional Resources
          </h2>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li>
              <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link href="/ethereum-v3" className="text-blue-600 dark:text-blue-400 hover:underline">
                Market Overview
              </Link>
            </li>
            <li>
              <Link href="/stablecoins" className="text-blue-600 dark:text-blue-400 hover:underline">
                Stablecoins
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
