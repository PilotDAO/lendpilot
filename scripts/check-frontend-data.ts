#!/usr/bin/env tsx

/**
 * Script to check if data is available for frontend
 */

import { prisma } from '@/lib/db/prisma';
import { loadMarkets } from '@/lib/utils/market';

async function main() {
  console.log('🔍 Checking data availability for frontend...\n');

  const markets = loadMarkets();
  const aaveKitMarkets = markets.filter(m => m.marketKey !== 'ethereum-v3');

  console.log(`📊 Checking ${aaveKitMarkets.length} AaveKit markets...\n`);

  for (const market of aaveKitMarkets) {
    // Check MarketTimeseries for 7d window
    const timeseries7d = await prisma.marketTimeseries.findMany({
      where: {
        marketKey: market.marketKey,
        window: '7d',
        dataSource: 'aavekit',
      },
      orderBy: {
        date: 'desc',
      },
      take: 1,
    });

    // Check AssetSnapshots
    const assetCount = await prisma.assetSnapshot.count({
      where: {
        marketKey: market.marketKey,
        dataSource: 'aavekit',
      },
    });

    const status = timeseries7d.length > 0 && assetCount > 0 ? '✅' : '⚠️';
    const timeseriesStatus = timeseries7d.length > 0 
      ? `${timeseries7d.length} entries` 
      : 'NO DATA';
    const assetsStatus = assetCount > 0 
      ? `${assetCount} assets` 
      : 'NO DATA';

    console.log(`${status} ${market.marketKey}`);
    console.log(`   MarketTimeseries (7d): ${timeseriesStatus}`);
    console.log(`   AssetSnapshots: ${assetsStatus}`);
    
    if (timeseries7d.length > 0) {
      const latest = timeseries7d[0];
      console.log(`   Latest date: ${latest.date.toISOString().split('T')[0]}`);
      console.log(`   Total Supply: $${latest.totalSuppliedUSD.toLocaleString()}`);
    }
    console.log('');
  }

  // Summary
  const totalTimeseries = await prisma.marketTimeseries.count({
    where: { dataSource: 'aavekit' },
  });

  const totalAssets = await prisma.assetSnapshot.count({
    where: { dataSource: 'aavekit' },
  });

  const totalRaw = await prisma.aaveKitRawSnapshot.count();

  console.log('📈 Summary:');
  console.log(`   Raw Snapshots: ${totalRaw}`);
  console.log(`   MarketTimeseries: ${totalTimeseries}`);
  console.log(`   AssetSnapshots: ${totalAssets}`);

  // Check Ethereum V3 (should have Subgraph data)
  const ethereumV3 = await prisma.marketTimeseries.findMany({
    where: {
      marketKey: 'ethereum-v3',
      window: '7d',
    },
    take: 1,
  });

  console.log(`\n📊 Ethereum V3 (Subgraph):`);
  console.log(`   MarketTimeseries (7d): ${ethereumV3.length > 0 ? `${ethereumV3.length} entries` : 'NO DATA'}`);

  await prisma.$disconnect();
}

main();
