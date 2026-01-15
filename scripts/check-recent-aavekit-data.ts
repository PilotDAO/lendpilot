#!/usr/bin/env tsx

/**
 * Check if new AaveKit data was added to database in the last N minutes
 */

import { prisma } from '@/lib/db/prisma';
import { loadMarkets } from '@/lib/utils/market';

async function main() {
  const minutes = parseInt(process.argv[2] || '10', 10);
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

  console.log(`🔍 Проверка данных AaveKit API за последние ${minutes} минут...`);
  console.log(`⏰ Время отсечки: ${cutoffTime.toISOString()}\n`);

  // Check AaveKitRawSnapshot
  const recentSnapshots = await prisma.aaveKitRawSnapshot.findMany({
    where: {
      createdAt: {
        gte: cutoffTime,
      },
      dataSource: 'aavekit',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`📊 AaveKitRawSnapshot (сырые данные):`);
  console.log(`   Всего записей за последние ${minutes} минут: ${recentSnapshots.length}`);

  if (recentSnapshots.length > 0) {
    console.log(`\n   Последние записи:`);
    const markets = loadMarkets();
    const marketMap = new Map(markets.map(m => [m.marketKey, m.displayName]));

    for (const snapshot of recentSnapshots.slice(0, 20)) {
      const marketName = marketMap.get(snapshot.marketKey) || snapshot.marketKey;
      const reserves = Array.isArray(snapshot.rawData) ? snapshot.rawData.length : 0;
      console.log(`   ✅ ${marketName} (${snapshot.marketKey})`);
      console.log(`      Дата: ${snapshot.date.toISOString().split('T')[0]}`);
      console.log(`      Резервов: ${reserves}`);
      console.log(`      Создано: ${snapshot.createdAt.toISOString()}`);
      console.log(`      Обновлено: ${snapshot.updatedAt.toISOString()}`);
      console.log('');
    }

    if (recentSnapshots.length > 20) {
      console.log(`   ... и еще ${recentSnapshots.length - 20} записей\n`);
    }

    // Group by market
    const byMarket = new Map<string, number>();
    for (const snapshot of recentSnapshots) {
      byMarket.set(snapshot.marketKey, (byMarket.get(snapshot.marketKey) || 0) + 1);
    }

    console.log(`   По маркетам:`);
    for (const [marketKey, count] of Array.from(byMarket.entries()).sort((a, b) => b[1] - a[1])) {
      const marketName = marketMap.get(marketKey) || marketKey;
      console.log(`      ${marketName}: ${count} записей`);
    }
  } else {
    console.log(`   ⚠️  Нет новых записей за последние ${minutes} минут\n`);
  }

  // Check MarketTimeseries (processed data)
  const recentTimeseries = await prisma.marketTimeseries.findMany({
    where: {
      createdAt: {
        gte: cutoffTime,
      },
      dataSource: 'aavekit',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`\n📈 MarketTimeseries (обработанные данные):`);
  console.log(`   Всего записей за последние ${minutes} минут: ${recentTimeseries.length}`);

  if (recentTimeseries.length > 0) {
    const byMarket = new Map<string, number>();
    for (const ts of recentTimeseries) {
      byMarket.set(ts.marketKey, (byMarket.get(ts.marketKey) || 0) + 1);
    }

    console.log(`   По маркетам:`);
    const markets = loadMarkets();
    const marketMap = new Map(markets.map(m => [m.marketKey, m.displayName]));
    for (const [marketKey, count] of Array.from(byMarket.entries()).sort((a, b) => b[1] - a[1])) {
      const marketName = marketMap.get(marketKey) || marketKey;
      console.log(`      ${marketName}: ${count} записей`);
    }
  }

  // Check AssetSnapshot (processed data)
  const recentAssets = await prisma.assetSnapshot.findMany({
    where: {
      createdAt: {
        gte: cutoffTime,
      },
      dataSource: 'aavekit',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log(`\n💎 AssetSnapshot (обработанные данные):`);
  console.log(`   Всего записей за последние ${minutes} минут: ${recentAssets.length > 0 ? 'много' : '0'}`);

  if (recentAssets.length > 0) {
    const count = await prisma.assetSnapshot.count({
      where: {
        createdAt: {
          gte: cutoffTime,
        },
        dataSource: 'aavekit',
      },
    });
    console.log(`   Точное количество: ${count} записей`);
  }

  // Summary
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📊 ИТОГО за последние ${minutes} минут:`);
  console.log(`   AaveKitRawSnapshot: ${recentSnapshots.length} записей`);
  console.log(`   MarketTimeseries: ${recentTimeseries.length} записей`);
  console.log(`   AssetSnapshot: ${recentAssets.length > 0 ? 'есть новые' : '0'} записей`);

  if (recentSnapshots.length === 0 && recentTimeseries.length === 0 && recentAssets.length === 0) {
    console.log(`\n⚠️  ВНИМАНИЕ: Нет новых данных за последние ${minutes} минут!`);
    console.log(`   Возможно, cron задача не запустилась или еще выполняется.`);
  } else {
    console.log(`\n✅ Данные добавляются в базу!`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
