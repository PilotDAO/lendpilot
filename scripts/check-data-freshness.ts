#!/usr/bin/env tsx

/**
 * Script to check when data was last updated and compare with current API data
 * 
 * Usage:
 *   tsx scripts/check-data-freshness.ts
 */

// Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { prisma } from '@/lib/db/prisma';
import { calculateMarketTrends } from '@/lib/calculations/trends';
import { queryReserves } from '@/lib/api/aavekit';
import { calculateMarketTotals } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { priceToUSD, calculateTotalSuppliedUSD, calculateTotalBorrowedUSD } from '@/lib/calculations/totals';

async function checkDataFreshness() {
  const marketKey = 'ethereum-v3';
  
  console.log('🔍 Checking data freshness for ethereum-v3...\n');
  console.log(`⏰ Current time: ${new Date().toISOString()}\n`);

  try {
    // 1. Check last update time in database
    console.log('📊 Database Data:');
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
        createdAt: true,
        totalSuppliedUSD: true,
        totalBorrowedUSD: true,
        availableLiquidityUSD: true,
      },
    });

    if (!latestDbData) {
      console.log('❌ No data found in database for ethereum-v3 (30d)');
      console.log('💡 Run: npm run sync:market-data');
      return;
    }

    const hoursSinceUpdate = (Date.now() - latestDbData.updatedAt.getTime()) / (1000 * 60 * 60);
    const daysSinceUpdate = hoursSinceUpdate / 24;

    console.log(`📅 Latest date in DB: ${latestDbData.date.toISOString().split('T')[0]}`);
    console.log(`🕐 Last updated: ${latestDbData.updatedAt.toISOString()}`);
    console.log(`⏱️  Hours since update: ${hoursSinceUpdate.toFixed(2)}`);
    console.log(`📆 Days since update: ${daysSinceUpdate.toFixed(2)}`);
    console.log(`\n💰 Latest values in DB:`);
    console.log(`   Total Supplied: $${latestDbData.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`   Total Borrowed: $${latestDbData.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`   Available Liquidity: $${latestDbData.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

    // 2. Get current data from API (AaveKit)
    console.log('\n\n🌐 Current API Data (AaveKit):');
    console.log('='.repeat(60));
    
    const reserves = await queryReserves(marketKey);
    const totals = reserves.reduce(
      (acc, r) => {
        const normalizedAddress = normalizeAddress(r.underlyingAsset);
        const priceUSD = priceToUSD(r.price.priceInEth, r.symbol, normalizedAddress);
        const decimals = r.decimals;

        const suppliedUSD = calculateTotalSuppliedUSD(
          r.totalATokenSupply,
          decimals,
          priceUSD
        );
        const borrowedUSD = calculateTotalBorrowedUSD(
          r.totalCurrentVariableDebt,
          decimals,
          priceUSD
        );

        acc.totalSuppliedUSD += suppliedUSD;
        acc.totalBorrowedUSD += borrowedUSD;
        return acc;
      },
      { totalSuppliedUSD: 0, totalBorrowedUSD: 0, availableLiquidityUSD: 0 }
    );

    totals.availableLiquidityUSD = totals.totalSuppliedUSD - totals.totalBorrowedUSD;

    console.log(`💰 Current values from API:`);
    console.log(`   Total Supplied: $${totals.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`   Total Borrowed: $${totals.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`   Available Liquidity: $${totals.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

    // 3. Compare
    console.log('\n\n📊 Comparison:');
    console.log('='.repeat(60));
    
    const suppliedDiff = totals.totalSuppliedUSD - latestDbData.totalSuppliedUSD;
    const borrowedDiff = totals.totalBorrowedUSD - latestDbData.totalBorrowedUSD;
    const availableDiff = totals.availableLiquidityUSD - latestDbData.availableLiquidityUSD;

    const suppliedDiffPercent = (suppliedDiff / latestDbData.totalSuppliedUSD) * 100;
    const borrowedDiffPercent = (borrowedDiff / latestDbData.totalBorrowedUSD) * 100;
    const availableDiffPercent = (availableDiff / latestDbData.availableLiquidityUSD) * 100;

    console.log(`\n📈 Total Supplied:`);
    console.log(`   Difference: $${suppliedDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${suppliedDiffPercent > 0 ? '+' : ''}${suppliedDiffPercent.toFixed(2)}%)`);
    
    console.log(`\n📉 Total Borrowed:`);
    console.log(`   Difference: $${borrowedDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${borrowedDiffPercent > 0 ? '+' : ''}${borrowedDiffPercent.toFixed(2)}%)`);
    
    console.log(`\n💧 Available Liquidity:`);
    console.log(`   Difference: $${availableDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${availableDiffPercent > 0 ? '+' : ''}${availableDiffPercent.toFixed(2)}%)`);

    // 4. Check if data needs sync
    console.log('\n\n🔍 Analysis:');
    console.log('='.repeat(60));
    
    if (daysSinceUpdate > 1) {
      console.log(`⚠️  Data is ${daysSinceUpdate.toFixed(1)} days old - needs sync!`);
    } else if (hoursSinceUpdate > 6) {
      console.log(`⚠️  Data is ${hoursSinceUpdate.toFixed(1)} hours old - may need sync`);
    } else {
      console.log(`✅ Data is fresh (${hoursSinceUpdate.toFixed(1)} hours old)`);
    }

    if (Math.abs(suppliedDiffPercent) > 5 || Math.abs(borrowedDiffPercent) > 5) {
      console.log(`\n⚠️  Significant difference detected (>5%) between DB and API!`);
      console.log(`   This suggests either:`);
      console.log(`   1. Data in DB is old and needs sync`);
      console.log(`   2. There's a calculation error in how data is saved`);
      console.log(`\n💡 Recommendation: Run sync to update database`);
      console.log(`   npm run sync:market-data`);
    } else {
      console.log(`\n✅ Differences are within normal range (<5%)`);
    }

    // 5. Check today's data from Subgraph calculation
    console.log('\n\n🔬 Testing Subgraph Calculation (today):');
    console.log('='.repeat(60));
    
    try {
      const todayTrends = await calculateMarketTrends(marketKey, '30d');
      if (todayTrends && todayTrends.data && todayTrends.data.length > 0) {
        const todayData = todayTrends.data[todayTrends.data.length - 1];
        const todayDate = new Date(todayData.date);
        const todayInDb = await prisma.marketTimeseries.findFirst({
          where: {
            marketKey,
            window: '30d',
            date: todayDate,
          },
        });

        console.log(`📅 Today's date: ${todayData.date}`);
        console.log(`\n💰 From Subgraph calculation:`);
        console.log(`   Total Supplied: $${todayData.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`   Total Borrowed: $${todayData.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`   Available Liquidity: $${todayData.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

        if (todayInDb) {
          console.log(`\n💰 From Database (same date):`);
          console.log(`   Total Supplied: $${todayInDb.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
          console.log(`   Total Borrowed: $${todayInDb.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
          console.log(`   Available Liquidity: $${todayInDb.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

          const calcSuppliedDiff = todayData.totalSuppliedUSD - todayInDb.totalSuppliedUSD;
          const calcBorrowedDiff = todayData.totalBorrowedUSD - todayInDb.totalBorrowedUSD;
          const calcAvailableDiff = todayData.availableLiquidityUSD - todayInDb.availableLiquidityUSD;

          console.log(`\n📊 Difference (Subgraph calc vs DB):`);
          console.log(`   Supplied: $${calcSuppliedDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
          console.log(`   Borrowed: $${calcBorrowedDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
          console.log(`   Available: $${calcAvailableDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

          if (Math.abs(calcSuppliedDiff) > 1000 || Math.abs(calcBorrowedDiff) > 1000) {
            console.log(`\n❌ ERROR: Significant difference between Subgraph calculation and DB!`);
            console.log(`   This indicates a problem with how data is saved to DB.`);
          } else {
            console.log(`\n✅ Subgraph calculation matches DB (within tolerance)`);
          }
        } else {
          console.log(`\n⚠️  Today's data not found in DB - needs sync`);
        }
      }
    } catch (error) {
      console.error(`\n❌ Error calculating from Subgraph:`, error);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDataFreshness()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
