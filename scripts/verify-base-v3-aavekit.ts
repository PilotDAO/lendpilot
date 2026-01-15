#!/usr/bin/env tsx

/**
 * Verify AaveKit data for Base against real Aave data
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

const marketKey = 'base-v3';

async function verifyBaseData() {
  console.log('🔍 Verifying AaveKit data for Base...\n');

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
    
    console.log('\n📊 Please check real Aave Data from app.aave.com for base-v3');
    console.log('   Compare the values above with the official Aave interface.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyBaseData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
