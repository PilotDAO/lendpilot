import { prisma } from '@/lib/db/prisma';
import { calculateMarketTrends } from '@/lib/calculations/trends';
import { loadMarkets } from '@/lib/utils/market';
import { syncAllAssetSnapshots } from './asset-snapshots-sync';

export interface MarketTrendDataPoint {
  date: string; // ISO date (YYYY-MM-DD)
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  availableLiquidityUSD: number;
}

/**
 * Sync market timeseries data to database
 * This runs in background to pre-populate data for fast API responses
 */
export async function syncMarketTimeseries(marketKey: string): Promise<void> {
  const windows: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
  
  console.log(`🔄 Syncing market timeseries for ${marketKey}...`);

  for (const window of windows) {
    try {
      // Get data from Subgraph (slow, but runs in background)
      const trendsData = await calculateMarketTrends(marketKey, window);
      
      if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
        console.warn(`⚠️  No data for ${marketKey} (${window})`);
        continue;
      }

      // Save to database
      let saved = 0;
      for (const point of trendsData.data) {
        try {
          await prisma.marketTimeseries.upsert({
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
          saved++;
        } catch (error) {
          console.error(`Error saving point ${point.date} for ${marketKey} (${window}):`, error);
        }
      }
      
      console.log(`✅ Synced ${marketKey} timeseries (${window}): ${saved} points`);
    } catch (error) {
      console.error(`❌ Error syncing ${marketKey} (${window}):`, error);
      // Continue with other windows even if one fails
    }
  }
}

/**
 * Sync all markets to database
 */
export async function syncAllMarkets(): Promise<void> {
  // Get all markets from config
  const markets = loadMarkets();
  const marketKeys = markets.map(m => m.marketKey);
  
  console.log(`🔄 Starting sync for ${marketKeys.length} markets...`);
  
  for (const marketKey of marketKeys) {
    try {
      await syncMarketTimeseries(marketKey);
    } catch (error) {
      console.error(`❌ Failed to sync ${marketKey}:`, error);
      // Continue with other markets
    }
  }
  
  console.log(`✅ Market sync completed`);
}

/**
 * Clean up old data (optional, for maintenance)
 */
export async function cleanupOldData(daysToKeep: number = 365): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const deleted = await prisma.marketTimeseries.deleteMany({
    where: {
      date: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`🧹 Cleaned up ${deleted.count} old timeseries records`);
}
