#!/usr/bin/env tsx

/**
 * Quick sync script for ethereum-v3 30d window only
 * 
 * Usage:
 *   tsx scripts/sync-ethereum-v3-30d.ts
 */

// Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { prisma } from '@/lib/db/prisma';
import { calculateMarketTrends } from '@/lib/calculations/trends';

async function syncEthereumV3_30d() {
  const marketKey = 'ethereum-v3';
  const window: '30d' = '30d';
  
  console.log(`🔄 Starting sync for ${marketKey} (${window})...`);
  console.log(`⏰ ${new Date().toISOString()}\n`);

  try {
    // Get data from Subgraph
    console.log('📊 Fetching data from Subgraph...');
    const trendsData = await calculateMarketTrends(marketKey, window);
    
    if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
      console.error(`❌ No data received for ${marketKey} (${window})`);
      return;
    }

    console.log(`✅ Received ${trendsData.data.length} data points from Subgraph\n`);

    // Save to database
    console.log('💾 Saving to database...');
    let saved = 0;
    let updated = 0;
    let errors = 0;

    for (const point of trendsData.data) {
      try {
        const result = await prisma.marketTimeseries.upsert({
          where: {
            marketKey_date_window: {
              marketKey,
              date: new Date(point.date),
              window,
            },
          },
          update: {
            totalSuppliedUSD: point.totalSuppliedUSD,
            totalBorrowedUSD: point.totalBorrowedUSD,
            availableLiquidityUSD: point.availableLiquidityUSD,
            updatedAt: new Date(),
          },
          create: {
            marketKey,
            date: new Date(point.date),
            window,
            totalSuppliedUSD: point.totalSuppliedUSD,
            totalBorrowedUSD: point.totalBorrowedUSD,
            availableLiquidityUSD: point.availableLiquidityUSD,
          },
        });

        // Check if this was an update or create
        const existing = await prisma.marketTimeseries.findUnique({
          where: {
            marketKey_date_window: {
              marketKey,
              date: new Date(point.date),
              window,
            },
          },
        });

        if (existing && existing.createdAt.getTime() !== existing.updatedAt.getTime()) {
          updated++;
        } else {
          saved++;
        }
      } catch (error) {
        console.error(`❌ Error saving point ${point.date}:`, error);
        errors++;
      }
    }
    
    console.log(`\n✅ Sync completed!`);
    console.log(`   📊 Total points: ${trendsData.data.length}`);
    console.log(`   ✨ New records: ${saved}`);
    console.log(`   🔄 Updated records: ${updated}`);
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}`);
    }

    // Show latest data
    const latest = await prisma.marketTimeseries.findFirst({
      where: {
        marketKey,
        window,
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
        updatedAt: true,
        totalSuppliedUSD: true,
        totalBorrowedUSD: true,
        availableLiquidityUSD: true,
      },
    });

    if (latest) {
      console.log(`\n📅 Latest data point:`);
      console.log(`   Date: ${latest.date.toISOString().split('T')[0]}`);
      console.log(`   Updated: ${latest.updatedAt.toISOString()}`);
      console.log(`   Total Supplied: $${latest.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`   Total Borrowed: $${latest.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`   Available Liquidity: $${latest.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    }

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

syncEthereumV3_30d()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
