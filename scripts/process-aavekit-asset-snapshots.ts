#!/usr/bin/env tsx

/**
 * Process AaveKit raw snapshots into AssetSnapshot table.
 *
 * Usage:
 *   npx tsx scripts/process-aavekit-asset-snapshots.ts
 */

import { AaveKitAssetProcessor } from "@/lib/processors/aavekit-asset-processor";

async function main() {
  console.log("🔄 Processing AaveKit raw snapshots into AssetSnapshot...");
  const processor = new AaveKitAssetProcessor();
  await processor.processAllPending();
  console.log("✅ Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

