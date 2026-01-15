#!/usr/bin/env tsx

/**
 * Script to verify data correctness by comparing:
 * 1. Current data from AaveKit API
 * 2. Latest data in database
 * 3. Data calculated from Subgraph for today
 * 
 * Usage:
 *   tsx scripts/verify-data-correctness.ts
 */

// Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { prisma } from '@/lib/db/prisma';
import { queryReserves } from '@/lib/api/aavekit';
import { calculateMarketTrends } from '@/lib/calculations/trends';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'ethereum-v3';

async function verifyDataCorrectness() {
  console.log('🔍 Verifying data correctness for ethereum-v3...\n');
  console.log(`⏰ Current time: ${new Date().toISOString()}\n`);

  try {
    // 1. Get current data from AaveKit API
    console.log('📊 Step 1: Current data from AaveKit API');
    console.log('='.repeat(60));
    
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

    const calculatedAvailable = totalSuppliedUSD - totalBorrowedUSD;

    console.log(`Total Supplied: $${totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Total Borrowed: $${totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available (sum): $${availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available (calculated): $${calculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Difference: $${Math.abs(availableLiquidityUSD - calculatedAvailable).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

    // 2. Get latest data from database
    console.log('\n\n💾 Step 2: Latest data from database');
    console.log('='.repeat(60));
    
    const latestDbData = await prisma.marketTimeseries.findFirst({
      where: {
        marketKey,
        window: '30d',
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

    if (!latestDbData) {
      console.log('❌ No data found in database');
      return;
    }

    const hoursSinceUpdate = (Date.now() - latestDbData.updatedAt.getTime()) / (1000 * 60 * 60);
    
    console.log(`Date: ${latestDbData.date.toISOString().split('T')[0]}`);
    console.log(`Updated: ${latestDbData.updatedAt.toISOString()} (${hoursSinceUpdate.toFixed(2)} hours ago)`);
    console.log(`Total Supplied: $${latestDbData.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Total Borrowed: $${latestDbData.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available Liquidity: $${latestDbData.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    
    const dbCalculatedAvailable = latestDbData.totalSuppliedUSD - latestDbData.totalBorrowedUSD;
    console.log(`Available (calculated): $${dbCalculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Difference: $${Math.abs(latestDbData.availableLiquidityUSD - dbCalculatedAvailable).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

    // 3. Calculate today's data from Subgraph
    console.log('\n\n🔬 Step 3: Today\'s data calculated from Subgraph');
    console.log('='.repeat(60));
    
    const todayTrends = await calculateMarketTrends(marketKey, '30d');
    if (todayTrends && todayTrends.data && todayTrends.data.length > 0) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const todayData = todayTrends.data.find(d => d.date === todayStr);
      
      if (todayData) {
        console.log(`Date: ${todayData.date}`);
        console.log(`Total Supplied: $${todayData.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`Total Borrowed: $${todayData.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`Available Liquidity: $${todayData.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        
        const subgraphCalculatedAvailable = todayData.totalSuppliedUSD - todayData.totalBorrowedUSD;
        console.log(`Available (calculated): $${subgraphCalculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`Difference: $${Math.abs(todayData.availableLiquidityUSD - subgraphCalculatedAvailable).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      } else {
        console.log(`⚠️  No data for today (${todayStr}) in Subgraph calculation`);
        // Use latest data from Subgraph
        const latestSubgraph = todayTrends.data[todayTrends.data.length - 1];
        console.log(`\nUsing latest Subgraph data (${latestSubgraph.date}):`);
        console.log(`Total Supplied: $${latestSubgraph.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`Total Borrowed: $${latestSubgraph.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`Available Liquidity: $${latestSubgraph.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      }
    } else {
      console.log('❌ Failed to calculate data from Subgraph');
    }

    // 4. Comparison
    console.log('\n\n📊 Step 4: Comparison');
    console.log('='.repeat(60));
    
    if (latestDbData && todayTrends?.data) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const todayData = todayTrends.data.find(d => d.date === todayStr) || todayTrends.data[todayTrends.data.length - 1];
      
      console.log('\nAaveKit API vs Database:');
      const supplyDiff1 = Math.abs(totalSuppliedUSD - latestDbData.totalSuppliedUSD);
      const supplyDiffPercent1 = (supplyDiff1 / totalSuppliedUSD) * 100;
      const borrowDiff1 = Math.abs(totalBorrowedUSD - latestDbData.totalBorrowedUSD);
      const borrowDiffPercent1 = (borrowDiff1 / totalBorrowedUSD) * 100;
      
      console.log(`  Supply: $${supplyDiff1.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${supplyDiffPercent1.toFixed(2)}%)`);
      console.log(`    AaveKit: $${totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`    Database: $${latestDbData.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`  Borrow: $${borrowDiff1.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${borrowDiffPercent1.toFixed(2)}%)`);
      console.log(`    AaveKit: $${totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`    Database: $${latestDbData.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      
      if (supplyDiffPercent1 > 5 || borrowDiffPercent1 > 5) {
        console.log(`  ⚠️  WARNING: Significant difference (>5%)!`);
      } else {
        console.log(`  ✅ Difference is within tolerance (<5%)`);
      }
      
      console.log('\nAaveKit API vs Subgraph (today):');
      const supplyDiff2 = Math.abs(totalSuppliedUSD - todayData.totalSuppliedUSD);
      const supplyDiffPercent2 = (supplyDiff2 / totalSuppliedUSD) * 100;
      const borrowDiff2 = Math.abs(totalBorrowedUSD - todayData.totalBorrowedUSD);
      const borrowDiffPercent2 = (borrowDiff2 / totalBorrowedUSD) * 100;
      
      console.log(`  Supply: $${supplyDiff2.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${supplyDiffPercent2.toFixed(2)}%)`);
      console.log(`  Borrow: $${borrowDiff2.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${borrowDiffPercent2.toFixed(2)}%)`);
      
      if (supplyDiffPercent2 > 5 || borrowDiffPercent2 > 5) {
        console.log(`  ⚠️  WARNING: Significant difference (>5%)!`);
        console.log(`  This suggests a problem with Subgraph calculation or data format.`);
      } else {
        console.log(`  ✅ Difference is within tolerance (<5%)`);
      }
      
      console.log('\nDatabase vs Subgraph:');
      const supplyDiff3 = Math.abs(latestDbData.totalSuppliedUSD - todayData.totalSuppliedUSD);
      const supplyDiffPercent3 = (supplyDiff3 / latestDbData.totalSuppliedUSD) * 100;
      const borrowDiff3 = Math.abs(latestDbData.totalBorrowedUSD - todayData.totalBorrowedUSD);
      const borrowDiffPercent3 = (borrowDiff3 / latestDbData.totalBorrowedUSD) * 100;
      
      console.log(`  Supply: $${supplyDiff3.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${supplyDiffPercent3.toFixed(2)}%)`);
      console.log(`  Borrow: $${borrowDiff3.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${borrowDiffPercent3.toFixed(2)}%)`);
      
      if (supplyDiffPercent3 > 5 || borrowDiffPercent3 > 5) {
        console.log(`  ⚠️  WARNING: Significant difference (>5%)!`);
        console.log(`  This suggests data in database may be incorrect or outdated.`);
      } else {
        console.log(`  ✅ Difference is within tolerance (<5%)`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDataCorrectness()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
