#!/usr/bin/env tsx

/**
 * Collect historical AaveKit data for the last N days
 * This will populate the database with historical data for charts
 */

import { AaveKitDailyCollector } from '@/lib/collectors/aavekit-daily-collector';
import { AaveKitMarketProcessor } from '@/lib/processors/aavekit-market-processor';
import { AaveKitAssetProcessor } from '@/lib/processors/aavekit-asset-processor';
import { prisma } from '@/lib/db/prisma';
import { loadMarkets } from '@/lib/utils/market';

async function main() {
  const days = parseInt(process.argv[2] || '7', 10);
  console.log(`🔄 Collecting historical AaveKit data for last ${days} days...\n`);

  const collector = new AaveKitDailyCollector();
  const marketProcessor = new AaveKitMarketProcessor();
  const assetProcessor = new AaveKitAssetProcessor();

  const markets = loadMarkets();
  const aaveKitMarkets = markets.filter(m => m.marketKey !== 'ethereum-v3');

  // Generate dates for last N days
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);
    dates.push(date);
  }

  console.log(`📅 Dates to collect: ${dates.map(d => d.toISOString().split('T')[0]).join(', ')}\n`);

  let totalCollected = 0;
  let totalProcessed = 0;

  // Collect data for each date
  for (const date of dates) {
    console.log(`\n📊 Collecting data for ${date.toISOString().split('T')[0]}...`);

    // Check if we already have data for this date
    const existing = await prisma.aaveKitRawSnapshot.findMany({
      where: {
        date,
        dataSource: 'aavekit',
      },
    });

    if (existing.length === aaveKitMarkets.length) {
      console.log(`  ⏭️  Data already exists for ${date.toISOString().split('T')[0]}, skipping...`);
      continue;
    }

    // Collect for each market
    for (const market of aaveKitMarkets) {
      try {
        // Check if snapshot exists
        const snapshotExists = await prisma.aaveKitRawSnapshot.findUnique({
          where: {
            marketKey_date_dataSource: {
              marketKey: market.marketKey,
              date,
              dataSource: 'aavekit',
            },
          },
        });

        if (snapshotExists) {
          continue; // Skip if already exists
        }

        await collector.collectMarketSnapshot(market.marketKey, date);
        totalCollected++;
      } catch (error) {
        console.error(`  ❌ Failed to collect ${market.marketKey} for ${date.toISOString().split('T')[0]}:`, error);
      }
    }

    // Process collected data for all markets
    console.log(`  🔄 Processing data for ${date.toISOString().split('T')[0]}...`);
    
    for (const market of aaveKitMarkets) {
      try {
        await marketProcessor.processMarket(market.marketKey, date);
        totalProcessed++;
      } catch (error) {
        console.error(`  ❌ Failed to process ${market.marketKey} for ${date.toISOString().split('T')[0]}:`, error);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Process all asset snapshots
  console.log(`\n🔄 Processing all asset snapshots...`);
  await assetProcessor.processAllPending();

  // Summary
  const rawCount = await prisma.aaveKitRawSnapshot.count({
    where: { dataSource: 'aavekit' },
  });

  const timeseriesCount = await prisma.marketTimeseries.count({
    where: { dataSource: 'aavekit' },
  });

  const assetCount = await prisma.assetSnapshot.count({
    where: { dataSource: 'aavekit' },
  });

  console.log(`\n✅ Collection completed!`);
  console.log(`   Raw Snapshots: ${rawCount}`);
  console.log(`   MarketTimeseries: ${timeseriesCount}`);
  console.log(`   AssetSnapshots: ${assetCount}`);

  await prisma.$disconnect();
}

main();
