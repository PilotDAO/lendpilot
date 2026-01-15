#!/usr/bin/env tsx

/**
 * Monitor Subgraph data sync progress
 */

import { prisma } from '@/lib/db/prisma';
import { loadMarkets } from '@/lib/utils/market';

async function checkProgress() {
  const markets = loadMarkets();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  console.log('📊 Прогресс пересбора данных из Subgraph\n');
  console.log(`⏰ Время проверки: ${now.toISOString()}\n`);

  // Check MarketTimeseries (Subgraph)
  const recentMarketTimeseries = await prisma.marketTimeseries.count({
    where: {
      dataSource: 'subgraph',
      updatedAt: {
        gte: oneHourAgo,
      },
    },
  });

  const totalMarketTimeseries = await prisma.marketTimeseries.count({
    where: {
      dataSource: 'subgraph',
    },
  });

  console.log('📈 MarketTimeseries (Subgraph):');
  console.log(`   Всего записей: ${totalMarketTimeseries}`);
  console.log(`   Обновлено за последний час: ${recentMarketTimeseries}`);

  // Check by market
  const byMarket = await prisma.marketTimeseries.groupBy({
    by: ['marketKey'],
    where: {
      dataSource: 'subgraph',
      updatedAt: {
        gte: oneHourAgo,
      },
    },
    _count: {
      id: true,
    },
  });

  if (byMarket.length > 0) {
    console.log(`\n   Активные маркеты (обновлено за час):`);
    for (const market of byMarket) {
      const marketInfo = markets.find(m => m.marketKey === market.marketKey);
      const name = marketInfo?.displayName || market.marketKey;
      console.log(`      ${name}: ${market._count.id} записей`);
    }
  }

  // Check AssetSnapshot (Subgraph)
  const recentAssetSnapshots = await prisma.assetSnapshot.count({
    where: {
      dataSource: 'subgraph',
      updatedAt: {
        gte: oneHourAgo,
      },
    },
  });

  const totalAssetSnapshots = await prisma.assetSnapshot.count({
    where: {
      dataSource: 'subgraph',
    },
  });

  console.log(`\n💎 AssetSnapshot (Subgraph):`);
  console.log(`   Всего записей: ${totalAssetSnapshots}`);
  console.log(`   Обновлено за последний час: ${recentAssetSnapshots}`);

  // Check by market
  const byMarketAsset = await prisma.assetSnapshot.groupBy({
    by: ['marketKey'],
    where: {
      dataSource: 'subgraph',
      updatedAt: {
        gte: oneHourAgo,
      },
    },
    _count: {
      id: true,
    },
  });

  if (byMarketAsset.length > 0) {
    console.log(`\n   Активные маркеты (обновлено за час):`);
    for (const market of byMarketAsset) {
      const marketInfo = markets.find(m => m.marketKey === market.marketKey);
      const name = marketInfo?.displayName || market.marketKey;
      console.log(`      ${name}: ${market._count.id} записей`);
    }
  }

  // Latest updates
  const latestMarketTimeseries = await prisma.marketTimeseries.findFirst({
    where: {
      dataSource: 'subgraph',
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      marketKey: true,
      date: true,
      updatedAt: true,
    },
  });

  const latestAssetSnapshot = await prisma.assetSnapshot.findFirst({
    where: {
      dataSource: 'subgraph',
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      marketKey: true,
      underlyingAsset: true,
      date: true,
      updatedAt: true,
    },
  });

  console.log(`\n🕐 Последние обновления:`);
  if (latestMarketTimeseries) {
    const age = Math.floor((now.getTime() - latestMarketTimeseries.updatedAt.getTime()) / 1000 / 60);
    console.log(`   MarketTimeseries: ${latestMarketTimeseries.marketKey} (${age} минут назад)`);
  }
  if (latestAssetSnapshot) {
    const age = Math.floor((now.getTime() - latestAssetSnapshot.updatedAt.getTime()) / 1000 / 60);
    console.log(`   AssetSnapshot: ${latestAssetSnapshot.marketKey}/${latestAssetSnapshot.underlyingAsset.slice(0, 8)}... (${age} минут назад)`);
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  if (recentMarketTimeseries > 0 || recentAssetSnapshots > 0) {
    console.log(`✅ Синхронизация активна!`);
  } else {
    console.log(`⚠️  Нет обновлений за последний час. Возможно, синхронизация завершена или еще не началась.`);
  }

  await prisma.$disconnect();
}

// Run every 30 seconds
async function monitor() {
  while (true) {
    await checkProgress();
    console.log('\n⏳ Ожидание 30 секунд до следующей проверки...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

// If run with --once flag, run once and exit
if (process.argv.includes('--once')) {
  checkProgress().catch(console.error);
} else {
  monitor().catch(console.error);
}
