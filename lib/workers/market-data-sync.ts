import { prisma } from '@/lib/db/prisma';
import { calculateMarketTrends } from '@/lib/calculations/trends';
import { loadMarkets } from '@/lib/utils/market';
import { syncAllAssetSnapshots } from './asset-snapshots-sync';
import { TimeWindow, ALL_TIME_WINDOWS, filterDataByWindow } from '@/lib/types/timeframes';
import { queryReserves } from '@/lib/api/aavekit';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';

export interface MarketTrendDataPoint {
  date: string; // ISO date (YYYY-MM-DD)
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  availableLiquidityUSD: number;
}

export interface SyncOptions {
  deleteOldData?: boolean; // Удалять ли старые данные перед синхронизацией
  compareWithAaveKit?: boolean; // Сравнивать ли с текущими данными из AaveKit
  showProgress?: boolean; // Показывать ли прогресс
  batchSize?: number; // Размер батча при сохранении (по умолчанию 100)
}

/**
 * Get current market data from AaveKit API for comparison
 */
async function getCurrentMarketData(marketKey: string) {
  const reserves = await queryReserves(marketKey);
  
  let totalSuppliedUSD = 0;
  let totalBorrowedUSD = 0;
  let availableLiquidityUSD = 0;

  for (const reserve of reserves) {
    const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
    const priceUSD = priceToUSD(reserve.price.priceInEth, reserve.symbol, normalizedAddress);
    const decimals = reserve.decimals;

    const suppliedUSD = calculateTotalSuppliedUSD(
      reserve.totalATokenSupply,
      decimals,
      priceUSD
    );
    const borrowedUSD = calculateTotalBorrowedUSD(
      reserve.totalCurrentVariableDebt,
      decimals,
      priceUSD
    );
    
    const availableLiquidity = new BigNumber(reserve.availableLiquidity);
    const availableUSD = availableLiquidity.times(priceUSD).toNumber();

    totalSuppliedUSD += suppliedUSD;
    totalBorrowedUSD += borrowedUSD;
    availableLiquidityUSD += availableUSD;
  }

  return {
    totalSuppliedUSD,
    totalBorrowedUSD,
    availableLiquidityUSD,
    calculatedAvailable: totalSuppliedUSD - totalBorrowedUSD,
  };
}

/**
 * Sync market timeseries data to database
 * Optimized: Collect 1y data once, then filter for all other windows
 * This reduces Subgraph API calls from 575 (30+180+365) to just 365
 * 
 * Note: Subgraph doesn't support batch queries for multiple blocks.
 * Each day requires a separate query to get reserves at that specific block.
 * We can parallelize requests, but need to be careful with rate limits.
 */
export async function syncMarketTimeseries(
  marketKey: string,
  options: SyncOptions = {}
): Promise<void> {
  const {
    deleteOldData = false,
    compareWithAaveKit = false,
    showProgress = false,
    batchSize = 100,
  } = options;

  console.log(`🔄 Syncing market timeseries for ${marketKey}...`);

  // Check if GRAPH_API_KEY is set
  if (!process.env.GRAPH_API_KEY || process.env.GRAPH_API_KEY.trim() === '') {
    throw new Error('GRAPH_API_KEY is not set in .env.local. Please set it to sync historical data from Subgraph.');
  }

  try {
    // 1. Optionally get current data from AaveKit for comparison
    let currentData: { totalSuppliedUSD: number; totalBorrowedUSD: number; calculatedAvailable: number } | null = null;
    if (compareWithAaveKit) {
      console.log('📊 Fetching current market data from AaveKit for comparison...');
      currentData = await getCurrentMarketData(marketKey);
      console.log(`  Total Supply: $${currentData.totalSuppliedUSD.toLocaleString()}`);
      console.log(`  Total Borrowed: $${currentData.totalBorrowedUSD.toLocaleString()}`);
      console.log(`  Available Liquidity: $${currentData.calculatedAvailable.toLocaleString()}\n`);
    }

    // 2. Optionally delete old data
    if (deleteOldData) {
      console.log('🗑️  Deleting existing timeseries data for all windows...');
      for (const window of ALL_TIME_WINDOWS) {
        const deleted = await prisma.marketTimeseries.deleteMany({
          where: { marketKey, window },
        });
        console.log(`  Deleted ${deleted.count} records for ${window}`);
      }
      console.log('');
    }

    // 3. Check if Subgraph data is reliable for this market
    // For many markets, Subgraph data is incorrect, incomplete, or unavailable
    // We'll validate by comparing current data from Subgraph with AaveKit
    // Based on validation report: 0 reliable markets out of 20 tested
    const UNRELIABLE_MARKETS = [
      'ethereum-v3',           // -45.5% supply diff, price mismatches
      'ethereum-ether-fi-v3',  // -100% (no data)
      'ethereum-lido-v3',      // -81.4% supply diff
      'optimism-v3',           // +728.9% supply diff, missing 6 reserves
      'sonic-v3',              // +180.8% supply diff
      'base-v3',               // -71.3% supply diff, missing 7 reserves
      'arbitrum-v3',           // -97.8% supply diff, missing 12 reserves
      'avalanche-v3',          // -57.8% supply diff, missing 6 reserves
      'ink-v3',                // -100% (no reserves in Subgraph)
      'linea-v3',              // +482.7% supply diff, price mismatches
      'scroll-v3',             // -7.1% supply but +140.1% borrow diff
    ]; // Markets where Subgraph data is known to be incorrect or incomplete
    
    if (UNRELIABLE_MARKETS.includes(marketKey)) {
      console.warn(`⚠️  Market ${marketKey} is known to have unreliable Subgraph data.`);
      console.warn(`   Skipping historical data collection from Subgraph.`);
      console.warn(`   Only current data from AaveKit will be used.`);
      
      // Save only current data point from AaveKit (stored once, filtered by date on API)
      if (currentData) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        await prisma.marketTimeseries.upsert({
          where: {
            marketKey_date_window: {
              marketKey,
              date: today,
              window: '1y', // Use "1y" as default - window is just for compatibility, filtering is by date
            },
          },
            update: {
              totalSuppliedUSD: currentData.totalSuppliedUSD,
              totalBorrowedUSD: currentData.totalBorrowedUSD,
              availableLiquidityUSD: currentData.calculatedAvailable,
              dataSource: 'aavekit',
              updatedAt: new Date(),
            },
            create: {
              marketKey,
              window: '1y', // Use "1y" as default - window is just for compatibility, filtering is by date
              date: today,
              totalSuppliedUSD: currentData.totalSuppliedUSD,
              totalBorrowedUSD: currentData.totalBorrowedUSD,
              availableLiquidityUSD: currentData.calculatedAvailable,
              dataSource: 'aavekit',
            },
          });
        console.log(`✅ Saved current data point (stored once, filtered by date on API)`);
      }
      return;
    }

    // 4. Collect 1y data once (365 requests to Subgraph, one per day)
    // Note: Subgraph requires separate queries for each block/day
    // We can't batch multiple days in one query because each day has a different block number
    const startTime = Date.now();
    console.log(`📊 Collecting 1y data from Subgraph (will filter for 7d, 30d, 3m, 6m)...`);
    console.log(`   Note: This requires 365 queries (one per day) as Subgraph doesn't support batch queries for multiple blocks.`);
    
    const trendsData1y = await calculateMarketTrends(marketKey, '1y');
    
    if (!trendsData1y || !trendsData1y.data || trendsData1y.data.length === 0) {
      console.warn(`⚠️  No data for ${marketKey} (1y)`);
      return;
    }

    console.log(`✅ Collected ${trendsData1y.data.length} data points for 1y`);
    
    // Validate Subgraph data quality by comparing with AaveKit if available
    if (currentData && trendsData1y.data.length > 0) {
      const latestSubgraphData = trendsData1y.data[trendsData1y.data.length - 1];
      const supplyDiff = Math.abs(latestSubgraphData.totalSuppliedUSD - currentData.totalSuppliedUSD) / currentData.totalSuppliedUSD;
      const borrowDiff = Math.abs(latestSubgraphData.totalBorrowedUSD - currentData.totalBorrowedUSD) / currentData.totalBorrowedUSD;
      
      // If difference is more than 50%, Subgraph data is likely incorrect
      if (supplyDiff > 0.5 || borrowDiff > 0.5) {
        console.warn(`⚠️  WARNING: Subgraph data differs significantly from AaveKit:`);
        console.warn(`   Supply difference: ${(supplyDiff * 100).toFixed(2)}%`);
        console.warn(`   Borrow difference: ${(borrowDiff * 100).toFixed(2)}%`);
        console.warn(`   Subgraph data may be incorrect for ${marketKey}.`);
        console.warn(`   Consider adding ${marketKey} to UNRELIABLE_MARKETS list.`);
      }
    }

    // 5. Save data once (using "1y" as default window for compatibility)
    // Filtering by date will be done on API level, not by window field
    // This avoids data duplication - one record per marketKey+date+dataSource
    const data = trendsData1y.data;
    let saved = 0;
    let errors = 0;
    
    console.log(`  💾 Saving ${data.length} data points (stored once, filtered by date on API) in batches of ${batchSize}...`);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchPromises = batch.map(async (point) => {
        try {
          await prisma.marketTimeseries.upsert({
            where: {
              marketKey_date_window: {
                marketKey,
                date: new Date(point.date),
                window: '1y', // Use "1y" as default - window is just for compatibility, filtering is by date
              },
            },
            update: {
              totalSuppliedUSD: point.totalSuppliedUSD,
              totalBorrowedUSD: point.totalBorrowedUSD,
              availableLiquidityUSD: point.availableLiquidityUSD,
              dataSource: 'subgraph',
              updatedAt: new Date(),
            },
            create: {
              marketKey,
              date: new Date(point.date),
              window: '1y', // Use "1y" as default - window is just for compatibility, filtering is by date
              totalSuppliedUSD: point.totalSuppliedUSD,
              totalBorrowedUSD: point.totalBorrowedUSD,
              availableLiquidityUSD: point.availableLiquidityUSD,
              dataSource: 'subgraph',
            },
          });
          return { success: true, date: point.date };
        } catch (error) {
          return { success: false, date: point.date, error };
        }
      });
      
      const results = await Promise.all(batchPromises);
      for (const result of results) {
        if (result.success) {
          saved++;
        } else {
          errors++;
          if (errors <= 5) {
            console.error(`  ❌ Error saving point ${result.date}:`, result.error);
          }
        }
      }
      
      // Show progress (it's a long operation for 1y)
      if (showProgress && (i + batchSize) % 100 === 0) {
        console.log(`  📊 Progress: ${Math.min(i + batchSize, data.length)}/${data.length} points saved...`);
      }
    }
    
    console.log(`  ✅ Saved ${saved} data points${errors > 0 ? ` (${errors} errors)` : ''}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Total time: ${elapsed}s`);

    // 6. Optionally compare today's data with current AaveKit data
    if (compareWithAaveKit && currentData) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const todayData = trendsData1y.data.find(d => d.date === todayStr);
      if (todayData) {
        console.log(`\n📅 Today's data (${todayStr}):`);
        console.log(`  Total Supply: $${todayData.totalSuppliedUSD.toLocaleString()}`);
        console.log(`  Total Borrowed: $${todayData.totalBorrowedUSD.toLocaleString()}`);
        console.log(`  Available Liquidity: $${todayData.availableLiquidityUSD.toLocaleString()}`);
        console.log(`  Calculated Available: $${(todayData.totalSuppliedUSD - todayData.totalBorrowedUSD).toLocaleString()}`);
        
        // Compare with current data
        const supplyDiff = Math.abs(todayData.totalSuppliedUSD - currentData.totalSuppliedUSD);
        const supplyDiffPercent = (supplyDiff / currentData.totalSuppliedUSD) * 100;
        const borrowDiff = Math.abs(todayData.totalBorrowedUSD - currentData.totalBorrowedUSD);
        const borrowDiffPercent = (borrowDiff / currentData.totalBorrowedUSD) * 100;
        
        console.log(`\n🔍 Comparison with current AaveKit data:`);
        console.log(`  Supply difference: $${supplyDiff.toLocaleString()} (${supplyDiffPercent.toFixed(2)}%)`);
        console.log(`  Borrow difference: $${borrowDiff.toLocaleString()} (${borrowDiffPercent.toFixed(2)}%)`);
        
        if (supplyDiffPercent > 5 || borrowDiffPercent > 5) {
          console.log(`  ⚠️  WARNING: Significant difference detected!`);
          console.log(`  This might indicate a problem with data calculation.`);
        } else {
          console.log(`  ✅ Data matches well (within 5% tolerance)`);
        }
      } else {
        console.log(`\n⚠️  No data for today (${todayStr})`);
      }
    }
    
    // Show date range
    const firstDate = trendsData1y.data[0]?.date;
    const lastDate = trendsData1y.data[trendsData1y.data.length - 1]?.date;
    console.log(`\n📆 Date range: ${firstDate} to ${lastDate}`);
    
  } catch (error) {
    console.error(`❌ Error syncing ${marketKey}:`, error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    throw error;
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
