#!/usr/bin/env tsx

/**
 * Test Subgraph price calculation
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { queryReservesAtBlock, queryPoolByAddress } from '@/lib/api/subgraph';
import { getBlockByTimestamp } from '@/lib/api/rpc';
import { getMarket } from '@/lib/utils/market';
import { normalizeAddress } from '@/lib/utils/address';
import { priceFromSubgraphToUSD } from '@/lib/calculations/totals';
import { calculateTotalSuppliedUSDFromSubgraph, calculateTotalBorrowedUSDFromSubgraph } from '@/lib/calculations/totals';
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'ethereum-v3';

async function testSubgraphPrice() {
  console.log('🔍 Testing Subgraph price calculation...\n');

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('Market not found');
      return;
    }

    // Get current block
    const now = Math.floor(Date.now() / 1000);
    const blockResult = await getBlockByTimestamp(now);
    const blockNumber = blockResult.blockNumber;

    console.log(`📊 Current block: ${blockNumber}\n`);

    // Get pool
    const pool = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(market.poolAddress)
    );
    if (!pool) {
      console.error('Pool not found');
      return;
    }

    // Get reserves
    const reserves = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      blockNumber
    );

    console.log(`📊 Total reserves: ${reserves.length}\n`);

    // Show first 5 reserves
    for (let i = 0; i < Math.min(5, reserves.length); i++) {
      const reserve = reserves[i];
      const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
      const priceUSD = priceFromSubgraphToUSD(reserve.price.priceInEth, reserve.symbol);
      
      console.log(`${i + 1}. ${reserve.symbol}`);
      console.log(`   priceInEth (raw): ${reserve.price.priceInEth}`);
      console.log(`   priceUSD (calculated): ${priceUSD}`);
      console.log(`   decimals: ${reserve.decimals}`);
      console.log(`   totalATokenSupply (raw): ${reserve.totalATokenSupply}`);
      console.log(`   totalCurrentVariableDebt (raw): ${reserve.totalCurrentVariableDebt}`);
      console.log(`   availableLiquidity (raw): ${reserve.availableLiquidity}`);
      
      const suppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
        reserve.totalATokenSupply,
        reserve.decimals,
        priceUSD
      );
      const borrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
        reserve.totalCurrentVariableDebt,
        reserve.decimals,
        priceUSD
      );
      
      const availableLiquidity = BigNumber.fromOnchain(reserve.availableLiquidity, reserve.decimals);
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
      const priceUSD = priceFromSubgraphToUSD(reserve.price.priceInEth, reserve.symbol);
      const decimals = reserve.decimals;

      const suppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
        reserve.totalATokenSupply,
        decimals,
        priceUSD
      );
      const borrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
        reserve.totalCurrentVariableDebt,
        decimals,
        priceUSD
      );
      
      const availableLiquidity = BigNumber.fromOnchain(reserve.availableLiquidity, decimals);
      const availableUSD = availableLiquidity.times(priceUSD).toNumber();

      totalSuppliedUSD += suppliedUSD;
      totalBorrowedUSD += borrowedUSD;
      availableLiquidityUSD += availableUSD;
    }

    console.log('\n📈 Market Totals (from Subgraph):');
    console.log(`Total Supplied: $${totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Total Borrowed: $${totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available (sum): $${availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`Available (calculated): $${(totalSuppliedUSD - totalBorrowedUSD).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSubgraphPrice()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
