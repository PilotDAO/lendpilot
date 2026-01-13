import { prisma } from '@/lib/db/prisma';
import { calculateMarketTrends } from '@/lib/calculations/trends';
import { queryReserves } from '@/lib/api/aavekit';
import { calculateMarketTotals, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD } from '@/lib/calculations/totals';

const marketKey = 'ethereum-v3';

async function getCurrentMarketData() {
  console.log('📊 Fetching current market data from AaveKit...');
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

    if (process.env.NODE_ENV === 'development') {
      console.log(`  ${reserve.symbol}: Supply=$${suppliedUSD.toLocaleString()}, Borrow=$${borrowedUSD.toLocaleString()}, Available=$${availableUSD.toLocaleString()}`);
    }
  }

  return {
    totalSuppliedUSD,
    totalBorrowedUSD,
    availableLiquidityUSD,
    calculatedAvailable: totalSuppliedUSD - totalBorrowedUSD,
  };
}

async function recalculateMarket() {
  console.log(`🔄 Recalculating market timeseries for ${marketKey}...\n`);

  // Check if GRAPH_API_KEY is set
  if (!process.env.GRAPH_API_KEY || process.env.GRAPH_API_KEY.trim() === '') {
    console.error('❌ GRAPH_API_KEY is not set in .env.local');
    console.error('   Please set GRAPH_API_KEY to recalculate historical data from Subgraph.');
    console.error('   You can get a free API key from: https://thegraph.com/studio/apikeys/');
    process.exit(1);
  }

  // Get current real data from AaveKit for comparison
  const currentData = await getCurrentMarketData();
  console.log('\n📈 Current Market Data (from AaveKit API):');
  console.log(`  Total Supply: $${currentData.totalSuppliedUSD.toLocaleString()}`);
  console.log(`  Total Borrowed: $${currentData.totalBorrowedUSD.toLocaleString()}`);
  console.log(`  Available Liquidity (sum): $${currentData.availableLiquidityUSD.toLocaleString()}`);
  console.log(`  Available Liquidity (calculated): $${currentData.calculatedAvailable.toLocaleString()}`);
  console.log(`  Difference: $${Math.abs(currentData.availableLiquidityUSD - currentData.calculatedAvailable).toLocaleString()}\n`);

  // Delete existing data for this market (only for windows we're recalculating)
  // Don't delete all data - only delete data for windows we're about to recalculate
  console.log('🗑️  Deleting existing timeseries data for windows being recalculated...');
  const windowsToRecalc: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
  for (const window of windowsToRecalc) {
    const deleted = await prisma.marketTimeseries.deleteMany({
      where: { marketKey, window },
    });
    console.log(`  Deleted ${deleted.count} records for ${window}`);
  }
  console.log('');

  // Recalculate for all windows
  const windows: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
  
  for (const window of windows) {
    console.log(`📊 Calculating ${window} data from Subgraph...`);
    const startTime = Date.now();
    
    try {
      const trendsData = await calculateMarketTrends(marketKey, window);
      
      if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
        console.warn(`  ⚠️  No data for ${window}`);
        continue;
      }

      console.log(`  📦 Received ${trendsData.data.length} data points`);

      // Save to database (save in batches for better performance, especially for 1y)
      let saved = 0;
      let errors = 0;
      const batchSize = window === '1y' ? 50 : 100; // Smaller batches for 1y to avoid timeouts
      
      console.log(`  💾 Saving ${trendsData.data.length} data points in batches of ${batchSize}...`);
      
      for (let i = 0; i < trendsData.data.length; i += batchSize) {
        const batch = trendsData.data.slice(i, i + batchSize);
        const batchPromises = batch.map(async (point) => {
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
        
        // Show progress for 1y (it's a long operation)
        if (window === '1y' && (i + batchSize) % 100 === 0) {
          console.log(`  📊 Progress: ${Math.min(i + batchSize, trendsData.data.length)}/${trendsData.data.length} points saved...`);
        }
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ✅ Saved ${saved} data points for ${window} (${errors} errors, ${elapsed}s)`);

      // Check today's data
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const todayData = trendsData.data.find(d => d.date === todayStr);
      if (todayData) {
        console.log(`\n  📅 Today's data (${todayStr}):`);
        console.log(`    Total Supply: $${todayData.totalSuppliedUSD.toLocaleString()}`);
        console.log(`    Total Borrowed: $${todayData.totalBorrowedUSD.toLocaleString()}`);
        console.log(`    Available Liquidity: $${todayData.availableLiquidityUSD.toLocaleString()}`);
        console.log(`    Calculated Available: $${(todayData.totalSuppliedUSD - todayData.totalBorrowedUSD).toLocaleString()}`);
        
        // Compare with current data
        const supplyDiff = Math.abs(todayData.totalSuppliedUSD - currentData.totalSuppliedUSD);
        const supplyDiffPercent = (supplyDiff / currentData.totalSuppliedUSD) * 100;
        const borrowDiff = Math.abs(todayData.totalBorrowedUSD - currentData.totalBorrowedUSD);
        const borrowDiffPercent = (borrowDiff / currentData.totalBorrowedUSD) * 100;
        
        console.log(`\n  🔍 Comparison with current AaveKit data:`);
        console.log(`    Supply difference: $${supplyDiff.toLocaleString()} (${supplyDiffPercent.toFixed(2)}%)`);
        console.log(`    Borrow difference: $${borrowDiff.toLocaleString()} (${borrowDiffPercent.toFixed(2)}%)`);
        
        if (supplyDiffPercent > 5 || borrowDiffPercent > 5) {
          console.log(`    ⚠️  WARNING: Significant difference detected!`);
        } else {
          console.log(`    ✅ Data matches well (within 5% tolerance)`);
        }
      } else {
        console.log(`  ⚠️  No data for today (${todayStr})`);
      }
      
      // Show date range
      const firstDate = trendsData.data[0]?.date;
      const lastDate = trendsData.data[trendsData.data.length - 1]?.date;
      console.log(`  📆 Date range: ${firstDate} to ${lastDate}`);
      
      console.log('');
    } catch (error) {
      console.error(`  ❌ Error calculating ${window}:`, error);
      if (error instanceof Error) {
        console.error(`     ${error.message}`);
      }
    }
  }

  console.log('✅ Recalculation completed!');
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
