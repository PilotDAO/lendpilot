#!/usr/bin/env tsx

/**
 * Audit DB coverage for raw snapshots, market timeseries, and asset snapshots per market.
 *
 * Usage:
 *   npx tsx scripts/audit-db-coverage.ts
 */

import markets from "@/data/markets.json";
import { prisma } from "@/lib/db/prisma";

function iso(d: Date) {
  return d.toISOString().split("T")[0];
}

function range(min?: Date | null, max?: Date | null) {
  if (!min || !max) return null;
  return `${iso(min)}..${iso(max)}`;
}

function expectedDataSource(marketKey: string): "subgraph" | "aavekit" {
  return marketKey === "ethereum-v3" ? "subgraph" : "aavekit";
}

async function main() {
  const rows: Array<{
    marketKey: string;
    dataSource: "subgraph" | "aavekit";
    rawSnapshots: number;
    rawRange: string | null;
    timeseries: number;
    tsRange: string | null;
    assetSnapshots: number;
    assetRange: string | null;
    distinctAssets: number;
  }> = [];

  for (const m of markets as any[]) {
    const marketKey = m.marketKey as string;
    const dataSource = expectedDataSource(marketKey);

    const rawAgg =
      dataSource === "aavekit"
        ? await prisma.aaveKitRawSnapshot.aggregate({
            where: { marketKey, dataSource: "aavekit" },
            _count: { id: true },
            _min: { date: true },
            _max: { date: true },
          })
        : null;

    const tsAgg = await prisma.marketTimeseries.aggregate({
      where: { marketKey, dataSource, window: "1y" },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true },
    });

    const assetAgg = await prisma.assetSnapshot.aggregate({
      where: { marketKey, dataSource },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true },
    });

    const distinctAssets = await prisma.assetSnapshot.findMany({
      where: { marketKey, dataSource },
      distinct: ["underlyingAsset"],
      select: { underlyingAsset: true },
    });

    rows.push({
      marketKey,
      dataSource,
      rawSnapshots: rawAgg?._count.id ?? 0,
      rawRange: rawAgg ? range(rawAgg._min.date, rawAgg._max.date) : null,
      timeseries: tsAgg._count.id,
      tsRange: range(tsAgg._min.date, tsAgg._max.date),
      assetSnapshots: assetAgg._count.id,
      assetRange: range(assetAgg._min.date, assetAgg._max.date),
      distinctAssets: distinctAssets.length,
    });
  }

  const missing = rows.filter((r) => {
    if (r.dataSource === "subgraph") {
      // Ethereum-V3: should have timeseries + assets
      return r.timeseries === 0 || r.distinctAssets === 0;
    }
    // AaveKit markets: should have raw snapshots + timeseries + assets
    return r.rawSnapshots === 0 || r.timeseries === 0 || r.distinctAssets === 0;
  });

  console.log("=== Missing / Suspicious coverage ===");
  for (const r of missing) console.log(r);

  console.log("\n=== Summary (counts) ===");
  console.table(
    rows.map((r) => ({
      marketKey: r.marketKey,
      source: r.dataSource,
      raw: r.rawSnapshots,
      ts: r.timeseries,
      assets: r.distinctAssets,
    }))
  );

  console.log("\n=== Ranges ===");
  console.table(
    rows.map((r) => ({
      marketKey: r.marketKey,
      source: r.dataSource,
      rawRange: r.rawRange,
      tsRange: r.tsRange,
      assetRange: r.assetRange,
    }))
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

