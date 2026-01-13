import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "@/lib/db/prisma";
import { loadMarkets } from "@/lib/utils/market";
import { queryReserves } from "@/lib/api/aavekit";
import { withRetry } from "@/lib/utils/retry";

async function monitorSync() {
  console.log("📊 Monitoring Sync Progress\n");
  console.log("=".repeat(80));

  const markets = loadMarkets();
  const now = new Date();
  const targetDays = 365;
  const startTime = Date.now();

  // Get current snapshot counts
  const currentStats = await prisma.$queryRaw<Array<{
    marketKey: string;
    snapshot_count: bigint;
    asset_count: bigint;
    first_date: Date | null;
    last_date: Date | null;
  }>>`
    SELECT 
      "marketKey",
      COUNT(*) as snapshot_count,
      COUNT(DISTINCT "underlyingAsset") as asset_count,
      MIN(date) as first_date,
      MAX(date) as last_date
    FROM asset_snapshots
    GROUP BY "marketKey"
    ORDER BY "marketKey"
  `;

  const statsMap = new Map(
    currentStats.map(s => [s.marketKey, {
      snapshots: Number(s.snapshot_count),
      assets: Number(s.asset_count),
      firstDate: s.first_date,
      lastDate: s.last_date,
    }])
  );

  let totalSnapshots = 0;
  let totalExpected = 0;
  let totalAssets = 0;

  console.log("Market Progress:\n");
  console.log("-".repeat(80));

  for (const market of markets) {
    try {
      // Get actual asset count from AaveKit
      const reserves = await withRetry(
        () => queryReserves(market.marketKey),
        { maxRetries: 2 }
      );

      const assetCount = reserves.length;
      const stat = statsMap.get(market.marketKey) || { snapshots: 0, assets: 0, firstDate: null, lastDate: null };
      
      // Calculate expected snapshots (365 days * asset count)
      const expectedSnapshots = targetDays * assetCount;
      const currentSnapshots = stat.snapshots;
      const progress = expectedSnapshots > 0 ? (currentSnapshots / expectedSnapshots) * 100 : 0;
      
      // Calculate days covered
      const daysCovered = stat.firstDate && stat.lastDate
        ? Math.ceil((stat.lastDate.getTime() - stat.firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 0;

      totalSnapshots += currentSnapshots;
      totalExpected += expectedSnapshots;
      totalAssets += assetCount;

      const status = progress >= 100 ? "✅" : progress > 50 ? "🟡" : "🟠";
      
      console.log(
        `${status} ${market.marketKey.padEnd(25)} | ` +
        `Assets: ${assetCount.toString().padStart(3)} | ` +
        `Snapshots: ${currentSnapshots.toString().padStart(5)}/${expectedSnapshots.toString().padStart(5)} | ` +
        `Days: ${daysCovered.toString().padStart(3)}/${targetDays} | ` +
        `Progress: ${progress.toFixed(1).padStart(5)}%`
      );
    } catch (error) {
      console.log(`❌ ${market.marketKey.padEnd(25)} | Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const overallProgress = totalExpected > 0 ? (totalSnapshots / totalExpected) * 100 : 0;
  const elapsed = (Date.now() - startTime) / 1000; // seconds

  console.log("\n" + "=".repeat(80));
  console.log("📈 Overall Progress:");
  console.log("-".repeat(80));
  console.log(`Total Assets: ${totalAssets}`);
  console.log(`Total Snapshots: ${totalSnapshots.toLocaleString()} / ${totalExpected.toLocaleString()}`);
  console.log(`Overall Progress: ${overallProgress.toFixed(2)}%`);
  console.log(`Remaining: ${(totalExpected - totalSnapshots).toLocaleString()} snapshots`);

  // Estimate time remaining based on recent progress
  // Note: This is a rough estimate as sync speed varies by market/network
  const remaining = totalExpected - totalSnapshots;
  
  // Conservative estimate: 2-5 snapshots per second (varies by network speed)
  // This accounts for:
  // - RPC calls to resolve block numbers
  // - Subgraph queries
  // - Database writes
  // - Network latency
  const avgRatePerSecond = 3; // Conservative estimate
  const estimatedSeconds = remaining / avgRatePerSecond;
  const estimatedMinutes = estimatedSeconds / 60;
  const estimatedHours = estimatedMinutes / 60;

  console.log(`\n⏱️  Time Estimates (Conservative):`);
  console.log(`Assumed Rate: ~${avgRatePerSecond} snapshots/second`);
  console.log(`Remaining Snapshots: ${remaining.toLocaleString()}`);
  
  if (estimatedHours < 1) {
    console.log(`Estimated Time Remaining: ~${Math.ceil(estimatedMinutes)} minutes`);
  } else if (estimatedHours < 24) {
    console.log(`Estimated Time Remaining: ~${estimatedHours.toFixed(1)} hours (${Math.ceil(estimatedMinutes)} minutes)`);
  } else {
    const days = estimatedHours / 24;
    console.log(`Estimated Time Remaining: ~${days.toFixed(1)} days (${estimatedHours.toFixed(1)} hours)`);
  }

  console.log(`\n💡 Note: Actual time may vary based on:`);
  console.log(`   - Network speed and subgraph response times`);
  console.log(`   - Number of assets per market`);
  console.log(`   - Database write performance`);
  console.log(`   - Concurrent processes`);

  await prisma.$disconnect();
}

monitorSync().catch(console.error);
