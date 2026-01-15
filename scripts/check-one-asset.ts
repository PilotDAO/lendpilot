#!/usr/bin/env tsx

/**
 * Check whether an asset has snapshots in DB for a given market.
 *
 * Usage:
 *   npx tsx scripts/check-one-asset.ts base-v3 0x....
 */

import { prisma } from "@/lib/db/prisma";
import { normalizeAddress } from "@/lib/utils/address";

function iso(d: Date) {
  return d.toISOString().split("T")[0];
}

async function main() {
  const marketKey = process.argv[2];
  const addr = process.argv[3];
  if (!marketKey || !addr) {
    console.error("Usage: npx tsx scripts/check-one-asset.ts <marketKey> <assetAddress>");
    process.exit(1);
  }

  const underlying = normalizeAddress(addr);

  const max = await prisma.assetSnapshot.aggregate({
    where: { marketKey, dataSource: marketKey === "ethereum-v3" ? "subgraph" : "aavekit" },
    _max: { date: true },
  });

  console.log("marketKey:", marketKey);
  console.log("underlying:", underlying);
  console.log("latest date:", max._max.date ? iso(max._max.date) : null);

  const countAny = await prisma.assetSnapshot.count({ where: { marketKey, underlyingAsset: underlying } });
  const countAavekit = await prisma.assetSnapshot.count({
    where: { marketKey, underlyingAsset: underlying, dataSource: "aavekit" },
  });
  const countSubgraph = await prisma.assetSnapshot.count({
    where: { marketKey, underlyingAsset: underlying, dataSource: "subgraph" },
  });

  console.log("rows:", { any: countAny, aavekit: countAavekit, subgraph: countSubgraph });

  const lastRow = await prisma.assetSnapshot.findFirst({
    where: { marketKey, underlyingAsset: underlying },
    orderBy: { date: "desc" },
    select: {
      date: true,
      dataSource: true,
      totalSuppliedUSD: true,
      totalBorrowedUSD: true,
      supplyAPR: true,
      borrowAPR: true,
      oraclePrice: true,
    },
  });
  console.log("last row:", lastRow ? { ...lastRow, date: iso(lastRow.date) } : null);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

