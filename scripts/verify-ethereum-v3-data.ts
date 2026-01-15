#!/usr/bin/env tsx

/**
 * Verify data correctness for ethereum-v3 after sync
 * Compares database data with current AaveKit API data
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { prisma } from '@/lib/db/prisma';
import { queryReserves } from '@/lib/api/aavekit';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';
import { ALL_TIME_WINDOWS } from '@/lib/types/timeframes';

const marketKey = 'ethereum-v3';

async function verifyData() {
  console.log('🔍 Verifying data correctness for ethereum-v3...\n');

  try {
    // 1. Get current data from AaveKit API
    console.log('📊 Step 1: Current data from AaveKit API');
    console.log('='.repeat(60));
    
    const reserves = await queryReserves(marketKey);
    let totalSuppliedUSD = 0;
    let totalBorrowedUSD = 0;

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

      totalSuppliedUSD += suppliedUSD;
      totalBorrowedUSD += borrowedUSD;
    }

    const calculatedAvailable = totalSuppliedUSD - totalBorrowedUSD;

    console.log(`Total Supplied: $${totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Total Borrowed: $${totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available Liquidity: $${calculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

    // 2. Check database data for all windows
    console.log('\n\n💾 Step 2: Database data for all windows');
    console.log('='.repeat(60));
    
    for (const window of ALL_TIME_WINDOWS) {
      const latestDbData = await prisma.marketTimeseries.findFirst({
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

      if (!latestDbData) {
        console.log(`\n${window}: ❌ No data found`);
        continue;
      }

      const hoursSinceUpdate = (Date.now() - latestDbData.updatedAt.getTime()) / (1000 * 60 * 60);
      const dbCalculatedAvailable = latestDbData.totalSuppliedUSD - latestDbData.totalBorrowedUSD;
      
      console.log(`\n${window}:`);
      console.log(`  Date: ${latestDbData.date.toISOString().split('T')[0]}`);
      console.log(`  Updated: ${latestDbData.updatedAt.toISOString()} (${hoursSinceUpdate.toFixed(2)}h ago)`);
      console.log(`  Total Supplied: $${latestDbData.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`  Total Borrowed: $${latestDbData.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`  Available: $${latestDbData.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`  Available (calculated): $${dbCalculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      
      // Check if values match
      const availableDiff = Math.abs(latestDbData.availableLiquidityUSD - dbCalculatedAvailable);
      if (availableDiff > 0.01) {
        console.log(`  ⚠️  Available mismatch: $${availableDiff.toFixed(2)}`);
      } else {
        console.log(`  ✅ Available values match`);
      }

      // Compare with current AaveKit data (if today's data)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const dataDate = new Date(latestDbData.date);
      dataDate.setUTCHours(0, 0, 0, 0);
      
      if (dataDate.getTime() === today.getTime()) {
        const supplyDiff = Math.abs(totalSuppliedUSD - latestDbData.totalSuppliedUSD);
        const supplyDiffPercent = (supplyDiff / totalSuppliedUSD) * 100;
        const borrowDiff = Math.abs(totalBorrowedUSD - latestDbData.totalBorrowedUSD);
        const borrowDiffPercent = (borrowDiff / totalBorrowedUSD) * 100;
        
        console.log(`\n  🔍 Comparison with current AaveKit data:`);
        console.log(`    Supply: $${supplyDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${supplyDiffPercent.toFixed(2)}%)`);
        console.log(`    Borrow: $${borrowDiff.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${borrowDiffPercent.toFixed(2)}%)`);
        
        if (supplyDiffPercent > 5 || borrowDiffPercent > 5) {
          console.log(`    ⚠️  WARNING: Significant difference (>5%)!`);
        } else {
          console.log(`    ✅ Data matches well (within 5% tolerance)`);
        }
      }
    }

    // 3. Check data counts
    console.log('\n\n📊 Step 3: Data counts per window');
    console.log('='.repeat(60));
    
    for (const window of ALL_TIME_WINDOWS) {
      const count = await prisma.marketTimeseries.count({
        where: {
          marketKey,
          window,
        },
      });
      
      const expectedDays = window === '7d' ? 7 : window === '30d' ? 30 : window === '3m' ? 90 : window === '6m' ? 180 : 365;
      const coverage = count > 0 ? ((count / expectedDays) * 100).toFixed(1) : '0';
      
      console.log(`${window}: ${count} records (expected ~${expectedDays}, coverage: ${coverage}%)`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
