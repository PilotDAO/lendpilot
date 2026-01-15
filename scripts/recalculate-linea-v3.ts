#!/usr/bin/env tsx

/**
 * Recalculate market timeseries data for linea-v3
 * Uses optimized syncMarketTimeseries with all features
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { syncMarketTimeseries } from '@/lib/workers/market-data-sync';

const marketKey = 'linea-v3';

async function recalculateMarket() {
  console.log(`🔄 Recalculating market timeseries for ${marketKey}...\n`);

  try {
    await syncMarketTimeseries(marketKey, {
      deleteOldData: true,
      compareWithAaveKit: true,
      showProgress: true,
      batchSize: 100,
    });

    console.log('\n✅ Recalculation completed!');
  } catch (error) {
    console.error('❌ Recalculation failed:', error);
    throw error;
  }
}

// Run the script
recalculateMarket()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
