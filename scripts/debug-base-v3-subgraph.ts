#!/usr/bin/env tsx

/**
 * Debug Subgraph prices for Base - compare with AaveKit
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { queryReservesAtBlock, queryPoolByAddress } from '@/lib/api/subgraph';
import { queryReserves } from '@/lib/api/aavekit';
import { getMarket } from '@/lib/utils/market';
import { normalizeAddress } from '@/lib/utils/address';
import { 
  priceToUSD, 
  priceFromSubgraphToUSD,
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
} from '@/lib/calculations/totals';
import { getBlockByTimestamp } from '@/lib/api/rpc';
import { BigNumber } from '@/lib/utils/big-number';
import {
  calculateTotalSuppliedUSDFromSubgraph,
  calculateTotalBorrowedUSDFromSubgraph,
} from '@/lib/calculations/totals';

const marketKey = 'base-v3';

async function debugBasePrices() {
  console.log('🔍 Debugging Subgraph prices for Base...\n');

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('❌ Market not found');
      return;
    }

    // Get pool entity
    const pool = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(market.poolAddress)
    );
    if (!pool) {
      console.error('❌ Pool not found');
      return;
    }

    // Get current block
    const now = Math.floor(Date.now() / 1000);
    const blockResult = await getBlockByTimestamp(now);
    const currentBlock = blockResult.blockNumber;

    // Get reserves from both sources
    console.log('📊 Fetching reserves from Subgraph...');
    const subgraphReserves = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      currentBlock
    );

    console.log('📊 Fetching reserves from AaveKit...');
    const aaveKitReserves = await queryReserves(marketKey);

    console.log(`\n📈 Comparing ${subgraphReserves.length} reserves:\n`);

    let totalSubgraphSupply = 0;
    let totalSubgraphBorrow = 0;
    let totalAaveKitSupply = 0;
    let totalAaveKitBorrow = 0;

    for (const subReserve of subgraphReserves) {
      const aaveKitReserve = aaveKitReserves.find(
        r => normalizeAddress(r.underlyingAsset) === normalizeAddress(subReserve.underlyingAsset)
      );

      if (!aaveKitReserve) continue;

      const aaveKitPriceUSD = priceToUSD(
        aaveKitReserve.price.priceInEth,
        aaveKitReserve.symbol,
        normalizeAddress(aaveKitReserve.underlyingAsset)
      );

      // Use current priceFromSubgraphToUSD function
      const subgraphPriceUSD = priceFromSubgraphToUSD(
        subReserve.price.priceInEth,
        subReserve.symbol,
        marketKey
      );

      // Calculate supply and borrow
      const suppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
        subReserve.totalATokenSupply,
        subReserve.decimals,
        subgraphPriceUSD
      );
      const borrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
        subReserve.totalCurrentVariableDebt,
        subReserve.decimals,
        subgraphPriceUSD
      );

      // AaveKit returns human-readable format, not on-chain format
      const aaveKitSuppliedUSD = calculateTotalSuppliedUSD(
        aaveKitReserve.totalATokenSupply,
        aaveKitReserve.decimals,
        aaveKitPriceUSD
      );
      const aaveKitBorrowedUSD = calculateTotalBorrowedUSD(
        aaveKitReserve.totalCurrentVariableDebt,
        aaveKitReserve.decimals,
        aaveKitPriceUSD
      );

      totalSubgraphSupply += suppliedUSD;
      totalSubgraphBorrow += borrowedUSD;
      totalAaveKitSupply += aaveKitSuppliedUSD;
      totalAaveKitBorrow += aaveKitBorrowedUSD;

      // Show significant differences
      const supplyDiff = Math.abs(suppliedUSD - aaveKitSuppliedUSD);
      const borrowDiff = Math.abs(borrowedUSD - aaveKitBorrowedUSD);
      
      if (supplyDiff > 10000 || borrowDiff > 10000 || 
          (aaveKitSuppliedUSD > 0 && supplyDiff / aaveKitSuppliedUSD > 0.1) ||
          (aaveKitBorrowedUSD > 0 && borrowDiff / aaveKitBorrowedUSD > 0.1)) {
        console.log(`${subReserve.symbol}:`);
        console.log(`  Subgraph priceInEth: ${subReserve.price.priceInEth}`);
        console.log(`  Subgraph price: $${subgraphPriceUSD.toFixed(2)}`);
        console.log(`  AaveKit price: $${aaveKitPriceUSD.toFixed(2)}`);
        console.log(`  Subgraph Supply: $${suppliedUSD.toLocaleString()}`);
        console.log(`  AaveKit Supply: $${aaveKitSuppliedUSD.toLocaleString()}`);
        console.log(`  Subgraph Borrow: $${borrowedUSD.toLocaleString()}`);
        console.log(`  AaveKit Borrow: $${aaveKitBorrowedUSD.toLocaleString()}`);
        console.log('');
      }
    }

    console.log('\n📊 Totals:');
    console.log(`  Subgraph Supply: $${totalSubgraphSupply.toLocaleString()}`);
    console.log(`  AaveKit Supply: $${totalAaveKitSupply.toLocaleString()}`);
    console.log(`  Subgraph Borrow: $${totalSubgraphBorrow.toLocaleString()}`);
    console.log(`  AaveKit Borrow: $${totalAaveKitBorrow.toLocaleString()}`);
    
    const supplyDiffPercent = ((totalSubgraphSupply - totalAaveKitSupply) / totalAaveKitSupply) * 100;
    const borrowDiffPercent = ((totalSubgraphBorrow - totalAaveKitBorrow) / totalAaveKitBorrow) * 100;
    
    console.log(`\n  Supply difference: ${supplyDiffPercent > 0 ? '+' : ''}${supplyDiffPercent.toFixed(2)}%`);
    console.log(`  Borrow difference: ${borrowDiffPercent > 0 ? '+' : ''}${borrowDiffPercent.toFixed(2)}%`);
    
    if (Math.abs(supplyDiffPercent) > 50 || Math.abs(borrowDiffPercent) > 50) {
      console.log(`\n⚠️  WARNING: Significant difference detected!`);
      console.log(`   Subgraph data may be incorrect for ${marketKey}.`);
    } else {
      console.log(`\n✅ Subgraph data looks reasonable for ${marketKey}.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugBasePrices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
