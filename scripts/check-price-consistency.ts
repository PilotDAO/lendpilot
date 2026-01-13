import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "@/lib/db/prisma";
import { queryReserves } from "@/lib/api/aavekit";
import { loadMarkets } from "@/lib/utils/market";
import { normalizeAddress } from "@/lib/utils/address";
import { priceToUSD } from "@/lib/calculations/totals";
import { withRetry } from "@/lib/utils/retry";

interface PriceMismatch {
  marketKey: string;
  assetAddress: string;
  symbol: string;
  currentPrice: number;
  snapshotPrice: number;
  differencePercent: number;
  snapshotDate: string;
}

async function checkPriceConsistency() {
  console.log("🔍 Checking price consistency across all assets...\n");

  const markets = loadMarkets();
  const mismatches: PriceMismatch[] = [];
  const threshold = 0.15; // 15% difference threshold

  for (const market of markets) {
    console.log(`📊 Checking market: ${market.marketKey} (${market.displayName})`);

    try {
      // Get all reserves from AaveKit
      const reserves = await withRetry(() => queryReserves(market.marketKey), {
        onRetry: (attempt, error) => {
          console.warn(`  Retry ${attempt} for market ${market.marketKey}:`, error.message);
        },
      });

      console.log(`  Found ${reserves.length} assets`);

      // Check each asset
      for (const reserve of reserves) {
        const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
        
        try {
          // Get current price from AaveKit
          const currentPrice = priceToUSD(
            reserve.price.priceInEth,
            reserve.symbol,
            normalizedAddress
          );

          // Get latest snapshot from database
          const latestSnapshot = await prisma.assetSnapshot.findFirst({
            where: {
              marketKey: market.marketKey,
              underlyingAsset: normalizedAddress,
            },
            orderBy: {
              date: "desc",
            },
          });

          if (!latestSnapshot) {
            // No snapshot data - skip
            continue;
          }

          const snapshotPrice = latestSnapshot.oraclePrice;
          const difference = Math.abs(currentPrice - snapshotPrice);
          const differencePercent = (difference / currentPrice) * 100;

          // Check if difference exceeds threshold
          if (differencePercent > threshold * 100) {
            mismatches.push({
              marketKey: market.marketKey,
              assetAddress: normalizedAddress,
              symbol: reserve.symbol,
              currentPrice,
              snapshotPrice,
              differencePercent,
              snapshotDate: latestSnapshot.date.toISOString().split("T")[0],
            });
          }
        } catch (error) {
          console.warn(`  ⚠️  Error checking ${reserve.symbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error(`  ❌ Error processing market ${market.marketKey}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Print report
  console.log("\n" + "=".repeat(80));
  console.log("📋 PRICE CONSISTENCY REPORT");
  console.log("=".repeat(80));

  if (mismatches.length === 0) {
    console.log("\n✅ All prices are consistent! No issues found.");
  } else {
    console.log(`\n⚠️  Found ${mismatches.length} assets with price mismatches (>${threshold * 100}% difference):\n`);

    // Group by market
    const byMarket = mismatches.reduce((acc, mismatch) => {
      if (!acc[mismatch.marketKey]) {
        acc[mismatch.marketKey] = [];
      }
      acc[mismatch.marketKey].push(mismatch);
      return acc;
    }, {} as Record<string, PriceMismatch[]>);

    for (const [marketKey, marketMismatches] of Object.entries(byMarket)) {
      console.log(`\n📊 Market: ${marketKey} (${marketMismatches.length} assets need resync)`);
      console.log("-".repeat(80));

      // Sort by difference percent (largest first)
      marketMismatches.sort((a, b) => b.differencePercent - a.differencePercent);

      for (const mismatch of marketMismatches) {
        const currentPriceStr = mismatch.currentPrice.toFixed(2);
        const snapshotPriceStr = mismatch.snapshotPrice.toFixed(2);
        console.log(
          `  ${mismatch.symbol.padEnd(8)} | ` +
          `Current: $${currentPriceStr.padStart(10)} | ` +
          `Snapshot: $${snapshotPriceStr.padStart(10)} | ` +
          `Diff: ${mismatch.differencePercent.toFixed(1)}% | ` +
          `Date: ${mismatch.snapshotDate}`
        );
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔧 RECOMMENDED ACTIONS:");
    console.log("=".repeat(80));
    console.log("\nTo fix these issues, resync snapshots for affected markets:");
    console.log("\n1. Resync all markets (recommended):");
    console.log("   npm run sync:market-data");
    console.log("\n2. Or resync specific markets via API:");
    for (const marketKey of Object.keys(byMarket)) {
      console.log(`   curl -X POST http://localhost:3000/api/cron/sync-asset-snapshots`);
      console.log(`   # Market: ${marketKey}`);
    }
  }

  return mismatches;
}

async function main() {
  try {
    const mismatches = await checkPriceConsistency();
    process.exit(mismatches.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
