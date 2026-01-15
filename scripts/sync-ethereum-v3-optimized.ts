#!/usr/bin/env tsx

/**
 * Optimized sync script for ethereum-v3
 * Collects 1y data once, then filters for all windows (7d, 30d, 3m, 6m, 1y)
 * 
 * Usage:
 *   tsx scripts/sync-ethereum-v3-optimized.ts
 */

// Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { syncMarketTimeseries } from '@/lib/workers/market-data-sync';

async function syncEthereumV3() {
  const marketKey = 'ethereum-v3';
  
  console.log(`🔄 Starting optimized sync for ${marketKey}...`);
  console.log(`⏰ ${new Date().toISOString()}\n`);

  try {
    await syncMarketTimeseries(marketKey);
    console.log('\n✅ Sync completed successfully!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

syncEthereumV3()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
