#!/usr/bin/env tsx

/**
 * Verify AaveKit data for Linea against real Aave data
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { queryReserves } from '@/lib/api/aavekit';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'linea-v3';

async function verifyLineaData() {
  console.log('🔍 Verifying AaveKit data for Linea...\n');

  try {
    const reserves = await queryReserves(marketKey);
    
    console.log(`📊 Total reserves: ${reserves.length}\n`);
    
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

    console.log('📊 Calculated from AaveKit:');
    console.log(`  Total Supply: $${totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Total Borrowed: $${totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Available Liquidity (sum): $${availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Available Liquidity (calculated): $${calculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    
    console.log('\n📊 Real Aave Data (from app.aave.com):');
    console.log(`  Total market size: $183.90M`);
    console.log(`  Total available: $107.66M`);
    console.log(`  Total borrows: $74.30M`);
    
    console.log('\n📊 Comparison:');
    const supplyDiff = ((totalSuppliedUSD / 183900000) - 1) * 100;
    const borrowDiff = ((totalBorrowedUSD / 74300000) - 1) * 100;
    const availableDiff = ((calculatedAvailable / 107660000) - 1) * 100;
    
    console.log(`  Supply: ${supplyDiff > 0 ? '+' : ''}${supplyDiff.toFixed(2)}%`);
    console.log(`  Borrow: ${borrowDiff > 0 ? '+' : ''}${borrowDiff.toFixed(2)}%`);
    console.log(`  Available: ${availableDiff > 0 ? '+' : ''}${availableDiff.toFixed(2)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyLineaData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
