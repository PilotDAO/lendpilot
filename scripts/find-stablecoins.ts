import { queryReserves } from "@/lib/api/aavekit";
import { loadMarkets } from "@/lib/utils/market";
import { normalizeAddress } from "@/lib/utils/address";

// Common stablecoin symbols (case-insensitive check)
// Based on aavescan.com/stablecoins
const STABLECOIN_SYMBOLS = [
  "USDC",
  "USDT",
  "USDt", // Avalanche variant
  "USDT0", // Plasma variant
  "DAI",
  "FRAX",
  "LUSD",
  "GUSD",
  "USDP",
  "TUSD",
  "sUSD",
  "GHO",
  "crvUSD",
  "USDD",
  "BUSD",
  "USDX",
  "USDY",
  "USDe", // Ethena USD
  "sUSDe", // Staked USDe
  "PYUSD", // PayPal USD
  "RLUSD", // Real USD
  "EURS", // STASIS EURS
  "EURA", // Angle Protocol EUR
  "jEUR", // Jarvis Network jEUR
  "mUSD", // mStable USD
  "USDS", // Sperax USD
  "USDG", // USDG
  "syrupUSDT", // Syrup USDT
  "PT-sUSDE", // Pendle PT-sUSDE
  "PT-USDe", // Pendle PT-USDe
  "PT-eUSDE", // Pendle PT-eUSDE
];

interface DiscoveredStablecoin {
  symbol: string;
  address: string;
  name: string;
  markets: string[];
}

async function findStablecoins() {
  const markets = loadMarkets();
  const stablecoinMap = new Map<string, DiscoveredStablecoin>();

  console.log(`🔍 Scanning ${markets.length} markets for stablecoins...\n`);

  for (const market of markets) {
    try {
      console.log(`📊 Checking ${market.displayName} (${market.marketKey})...`);
      const reserves = await queryReserves(market.marketKey);

      for (const reserve of reserves) {
        const symbol = reserve.symbol.toUpperCase();
        if (STABLECOIN_SYMBOLS.includes(symbol)) {
          const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
          const key = `${symbol}-${normalizedAddress}`;

          if (!stablecoinMap.has(key)) {
            stablecoinMap.set(key, {
              symbol: reserve.symbol,
              address: normalizedAddress,
              name: reserve.name,
              markets: [],
            });
          }

          const stablecoin = stablecoinMap.get(key)!;
          if (!stablecoin.markets.includes(market.marketKey)) {
            stablecoin.markets.push(market.marketKey);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${market.marketKey}:`, error);
    }
  }

  console.log(`\n✅ Found ${stablecoinMap.size} unique stablecoins:\n`);

  const stablecoins = Array.from(stablecoinMap.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  for (const stablecoin of stablecoins) {
    console.log(`${stablecoin.symbol} (${stablecoin.name})`);
    console.log(`  Address: ${stablecoin.address}`);
    console.log(`  Markets: ${stablecoin.markets.join(", ")}\n`);
  }

  // Output JSON format
  const jsonOutput = stablecoins.map((s) => ({
    symbol: s.symbol,
    address: s.address,
    markets: s.markets,
  }));

  console.log("\n📋 JSON output:\n");
  console.log(JSON.stringify(jsonOutput, null, 2));

  return stablecoins;
}

if (require.main === module) {
  findStablecoins()
    .then(() => {
      console.log("\n✅ Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export { findStablecoins };
