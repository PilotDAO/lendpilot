#!/usr/bin/env tsx

/**
 * Compare AaveKit live reserves list vs DB AssetSnapshot coverage for each market.
 *
 * Requires network access (AaveKit GraphQL).
 *
 * Usage:
 *   npx tsx scripts/audit-aavekit-vs-db-assets.ts
 */

import markets from "@/data/markets.json";
import { queryReserves } from "@/lib/api/aavekit";
import { prisma } from "@/lib/db/prisma";
import { normalizeAddress } from "@/lib/utils/address";

function iso(d: Date) {
  return d.toISOString().split("T")[0];
}

async function main() {
  const rows: Array<any> = [];
  const missingDetails: Array<any> = [];

  for (const m of markets as any[]) {
    const marketKey = m.marketKey as string;
    if (marketKey === "ethereum-v3") continue; // Subgraph path

    let reserves: Awaited<ReturnType<typeof queryReserves>>;
    try {
      reserves = await queryReserves(marketKey);
    } catch (e: any) {
      rows.push({ marketKey, error: e?.message || String(e) });
      continue;
    }

    const reserveAddrs = reserves.map((r) => normalizeAddress(r.underlyingAsset));

    const max = await prisma.assetSnapshot.aggregate({
      where: { marketKey, dataSource: "aavekit" },
      _max: { date: true },
    });
    const latestDate = max._max.date;

    const covered = latestDate
      ? await prisma.assetSnapshot.findMany({
          where: { marketKey, dataSource: "aavekit", date: latestDate },
          distinct: ["underlyingAsset"],
          select: { underlyingAsset: true },
        })
      : [];

    const coveredSet = new Set(covered.map((x) => x.underlyingAsset));

    const missing = reserveAddrs.filter((a) => !coveredSet.has(a));

    rows.push({
      marketKey,
      aavekitReserves: reserveAddrs.length,
      latestDate: latestDate ? iso(latestDate) : null,
      dbAssetsAtLatestDate: covered.length,
      missingAtLatestDate: missing.length,
    });

    if (missing.length > 0) {
      missingDetails.push({ marketKey, latestDate: latestDate ? iso(latestDate) : null, missing });
    }
  }

  console.log("=== AaveKit vs DB AssetSnapshot coverage (latest date) ===");
  console.table(rows);

  if (missingDetails.length > 0) {
    console.log("\n=== Missing assets details ===");
    for (const d of missingDetails) {
      console.log(d.marketKey, "latestDate=", d.latestDate, "missing=", d.missing.length);
      console.log("  ", d.missing.slice(0, 10).join(", "), d.missing.length > 10 ? "..." : "");
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

