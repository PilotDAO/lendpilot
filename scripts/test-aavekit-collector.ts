#!/usr/bin/env tsx

/**
 * Test script for AaveKit data collection
 * Runs the collector and processor to test data collection
 */

import { AaveKitDailyCollector } from '@/lib/collectors/aavekit-daily-collector';
import { AaveKitMarketProcessor } from '@/lib/processors/aavekit-market-processor';
import { AaveKitAssetProcessor } from '@/lib/processors/aavekit-asset-processor';
import { prisma } from '@/lib/db/prisma';

async function main() {
  console.log('🧪 Testing AaveKit data collection...\n');

  try {
    // Step 1: Collect raw data
    console.log('📊 Step 1: Collecting raw data from AaveKit...');
    const collector = new AaveKitDailyCollector();
    await collector.collectDailySnapshots();
    console.log('✅ Raw data collection completed\n');

    // Step 2: Process MarketTimeseries
    console.log('📊 Step 2: Processing MarketTimeseries...');
    const marketProcessor = new AaveKitMarketProcessor();
    await marketProcessor.processAllPending();
    console.log('✅ MarketTimeseries processing completed\n');

    // Step 3: Process AssetSnapshots
    console.log('📊 Step 3: Processing AssetSnapshots...');
    const assetProcessor = new AaveKitAssetProcessor();
    await assetProcessor.processAllPending();
    console.log('✅ AssetSnapshots processing completed\n');

    // Step 4: Check results
    console.log('📊 Step 4: Checking results...');
    
    const rawCount = await prisma.aaveKitRawSnapshot.count();
    console.log(`  Raw snapshots: ${rawCount}`);
    
    const marketTimeseriesCount = await prisma.marketTimeseries.count({
      where: { dataSource: 'aavekit' },
    });
    console.log(`  MarketTimeseries (AaveKit): ${marketTimeseriesCount}`);
    
    const assetSnapshotsCount = await prisma.assetSnapshot.count({
      where: { dataSource: 'aavekit' },
    });
    console.log(`  AssetSnapshots (AaveKit): ${assetSnapshotsCount}`);

    // Show sample data
    const sampleMarket = await prisma.marketTimeseries.findFirst({
      where: { dataSource: 'aavekit' },
      orderBy: { date: 'desc' },
    });
    
    if (sampleMarket) {
      console.log(`\n📋 Sample MarketTimeseries entry:`);
      console.log(`  Market: ${sampleMarket.marketKey}`);
      console.log(`  Date: ${sampleMarket.date.toISOString().split('T')[0]}`);
      console.log(`  Window: ${sampleMarket.window}`);
      console.log(`  Total Supplied: $${sampleMarket.totalSuppliedUSD.toLocaleString()}`);
      console.log(`  Total Borrowed: $${sampleMarket.totalBorrowedUSD.toLocaleString()}`);
    }

    const sampleAsset = await prisma.assetSnapshot.findFirst({
      where: { dataSource: 'aavekit' },
      orderBy: { date: 'desc' },
    });
    
    if (sampleAsset) {
      console.log(`\n📋 Sample AssetSnapshot entry:`);
      console.log(`  Market: ${sampleAsset.marketKey}`);
      console.log(`  Asset: ${sampleAsset.underlyingAsset}`);
      console.log(`  Date: ${sampleAsset.date.toISOString().split('T')[0]}`);
      console.log(`  Total Supplied USD: $${sampleAsset.totalSuppliedUSD.toLocaleString()}`);
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
