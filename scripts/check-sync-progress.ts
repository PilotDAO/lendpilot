import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "@/lib/db/prisma";

async function checkProgress() {
  console.log("📊 Sync Progress Check\n");

  // Get snapshot counts by market
  const marketStats = await prisma.$queryRaw<Array<{
    marketKey: string;
    snapshot_count: bigint;
    first_date: Date | null;
    last_date: Date | null;
  }>>`
    SELECT 
      "marketKey",
      COUNT(*) as snapshot_count,
      MIN(date) as first_date,
      MAX(date) as last_date
    FROM asset_snapshots
    GROUP BY "marketKey"
    ORDER BY snapshot_count DESC
  `;

  const total = await prisma.assetSnapshot.count();

  console.log(`Total snapshots: ${total.toLocaleString()}\n`);
  console.log("Snapshots by market:");
  console.log("-".repeat(80));

  for (const stat of marketStats) {
    const count = Number(stat.snapshot_count);
    const firstDate = stat.first_date ? stat.first_date.toISOString().split("T")[0] : "N/A";
    const lastDate = stat.last_date ? stat.last_date.toISOString().split("T")[0] : "N/A";
    const days = stat.first_date && stat.last_date 
      ? Math.ceil((stat.last_date.getTime() - stat.first_date.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    console.log(
      `${stat.marketKey.padEnd(25)} | ` +
      `Snapshots: ${count.toString().padStart(6)} | ` +
      `Days: ${days.toString().padStart(4)} | ` +
      `Range: ${firstDate} to ${lastDate}`
    );
  }

  await prisma.$disconnect();
}

checkProgress().catch(console.error);
