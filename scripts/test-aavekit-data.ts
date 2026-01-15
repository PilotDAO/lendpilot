#!/usr/bin/env tsx

/**
 * Simple test to see what AaveKit API returns
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

const marketKey = 'ethereum-v3';

async function testAaveKitData() {
  console.log('🔍 Testing AaveKit API data...\n');

  try {
    const reserves = await queryReserves(marketKey);
    
    console.log(`📊 Total reserves: ${reserves.length}\n`);
    
    // Show first 5 reserves in detail
    for (let i = 0; i < Math.min(5, reserves.length); i++) {
      const reserve = reserves[i];
      const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
      const priceUSD = priceToUSD(reserve.price.priceInEth, reserve.symbol, normalizedAddress);
      
      console.log(`${i + 1}. ${reserve.symbol} (${reserve.name})`);
      console.log(`   Address: ${normalizedAddress}`);
      console.log(`   Decimals: ${reserve.decimals}`);
      console.log(`   Price (priceInEth): ${reserve.price.priceInEth}`);
      console.log(`   Price (USD): ${priceUSD}`);
      console.log(`   totalATokenSupply (raw): ${reserve.totalATokenSupply}`);
      console.log(`   totalCurrentVariableDebt (raw): ${reserve.totalCurrentVariableDebt}`);
      console.log(`   availableLiquidity (raw): ${reserve.availableLiquidity}`);
      
      const suppliedUSD = calculateTotalSuppliedUSD(
        reserve.totalATokenSupply,
        reserve.decimals,
        priceUSD
      );
      const borrowedUSD = calculateTotalBorrowedUSD(
        reserve.totalCurrentVariableDebt,
        reserve.decimals,
        priceUSD
      );
      
      const availableLiquidity = new BigNumber(reserve.availableLiquidity);
      const availableUSD = availableLiquidity.times(priceUSD).toNumber();
      
      console.log(`   Supplied USD: $${suppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`   Borrowed USD: $${borrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log(`   Available USD: $${availableUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      console.log('');
    }
    
    // Calculate totals
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

    console.log('\n📈 Market Totals:');
    console.log(`Total Supplied: $${totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Total Borrowed: $${totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available (sum): $${availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available (calculated): $${calculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Difference: $${Math.abs(availableLiquidityUSD - calculatedAvailable).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAaveKitData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
