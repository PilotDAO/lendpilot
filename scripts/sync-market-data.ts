#!/usr/bin/env tsx

/**
 * Background worker script to sync market data to database
 * 
 * Run this script periodically (e.g., via cron or Vercel Cron):
 * - Every 15 minutes for live data
 * - Every hour for historical data
 * 
 * Usage:
 *   npm run sync:market-data
 *   or
 *   tsx scripts/sync-market-data.ts
 */

// Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Verify GRAPH_API_KEY is loaded
if (!process.env.GRAPH_API_KEY) {
  console.error('❌ GRAPH_API_KEY is not set in .env.local');
  process.exit(1);
}

import { syncAllMarkets, cleanupOldData } from '@/lib/workers/market-data-sync';
import { syncAllAssetSnapshots } from '@/lib/workers/asset-snapshots-sync';
import { prisma } from '@/lib/db/prisma';

async function main() {
  console.log('🚀 Starting market data sync...');
  console.log(`⏰ ${new Date().toISOString()}`);

  try {
    // Sync market timeseries
    await syncAllMarkets();

    // Sync asset snapshots (runs less frequently, can take longer)
    // This can be run separately via cron if needed
    console.log('🔄 Syncing asset snapshots...');
    await syncAllAssetSnapshots(365);

    // Optional: Clean up old data (keep last 365 days)
    // Uncomment if you want to clean up old data
    // await cleanupOldData(365);

    console.log('✅ Market data sync completed successfully');
  } catch (error) {
    console.error('❌ Market data sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

main();
