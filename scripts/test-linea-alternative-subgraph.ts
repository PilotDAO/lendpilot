#!/usr/bin/env tsx

/**
 * Test alternative Subgraph ID for Linea
 * Compare with AaveKit to verify data correctness
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
  calculateTotalSuppliedUSDFromSubgraph,
  calculateTotalBorrowedUSDFromSubgraph,
} from '@/lib/calculations/totals';
import { getBlockByTimestamp } from '@/lib/api/rpc';

const marketKey = 'linea-v3';
const alternativeSubgraphId = 'BGqexPsTuknE9sVfTprnGw4fNTENDD74WybN61DX68ye';

async function testAlternativeSubgraph() {
  console.log('🔍 Testing alternative Subgraph ID for Linea...\n');
  console.log(`Alternative Subgraph ID: ${alternativeSubgraphId}\n`);

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('❌ Market not found');
      return;
    }

    console.log(`Market: ${market.displayName}`);
    console.log(`Current Subgraph ID: ${market.subgraphId}`);
    console.log(`Pool Address: ${market.poolAddress}\n`);

    // Try to get pool with alternative subgraph ID
    console.log('📊 Querying pool with alternative Subgraph ID...');
    const pool = await queryPoolByAddress(
      alternativeSubgraphId,
      normalizeAddress(market.poolAddress)
    );

    if (!pool) {
      console.error('❌ Pool not found with alternative Subgraph ID');
      return;
    }

    console.log(`✅ Pool found:`);
    console.log(`   Pool Entity ID: ${pool.id}`);
    console.log(`   Pool Address: ${pool.pool}\n`);

    // Get current block
    const now = Math.floor(Date.now() / 1000);
    const blockResult = await getBlockByTimestamp(now);
    const currentBlock = blockResult.blockNumber;

    // Get reserves from alternative Subgraph
    console.log(`📊 Fetching reserves from alternative Subgraph (block ${currentBlock})...`);
    const subgraphReserves = await queryReservesAtBlock(
      alternativeSubgraphId,
      pool.id,
      currentBlock
    );

    console.log(`✅ Found ${subgraphReserves.length} reserves in alternative Subgraph\n`);

    // Get reserves from AaveKit
    console.log('📊 Fetching reserves from AaveKit...');
    const aaveKitReserves = await queryReserves(marketKey);

    console.log(`✅ Found ${aaveKitReserves.length} reserves in AaveKit\n`);

    // Calculate totals from alternative Subgraph
    let totalSubgraphSupply = 0;
    let totalSubgraphBorrow = 0;
    let totalAaveKitSupply = 0;
    let totalAaveKitBorrow = 0;

    console.log('📈 Comparing reserves:\n');
    console.log('='.repeat(120));
    console.log(
      'Symbol'.padEnd(12) +
      'Subgraph Price'.padEnd(18) +
      'AaveKit Price'.padEnd(18) +
      'Subgraph Supply'.padEnd(20) +
      'AaveKit Supply'.padEnd(20) +
      'Match'
    );
    console.log('='.repeat(120));

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
      const supplyDiffPercent = aaveKitSuppliedUSD > 0 
        ? (supplyDiff / aaveKitSuppliedUSD) * 100 
        : 0;
      const borrowDiffPercent = aaveKitBorrowedUSD > 0 
        ? (borrowDiff / aaveKitBorrowedUSD) * 100 
        : 0;

      const isMatch = supplyDiffPercent < 10 && borrowDiffPercent < 10;

      if (!isMatch || suppliedUSD > 1000 || borrowedUSD > 1000) {
        console.log(
          subReserve.symbol.padEnd(12) +
          `$${subgraphPriceUSD.toFixed(2)}`.padEnd(18) +
          `$${aaveKitPriceUSD.toFixed(2)}`.padEnd(18) +
          `$${suppliedUSD.toLocaleString()}`.padEnd(20) +
          `$${aaveKitSuppliedUSD.toLocaleString()}`.padEnd(20) +
          (isMatch ? '✅' : '❌')
        );
        if (!isMatch) {
          console.log(`  ⚠️  Supply diff: ${supplyDiffPercent.toFixed(2)}%, Borrow diff: ${borrowDiffPercent.toFixed(2)}%`);
        }
      }
    }

    console.log('='.repeat(120));
    console.log('\n📊 Totals:');
    console.log(`  Alternative Subgraph Supply: $${totalSubgraphSupply.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  AaveKit Supply: $${totalAaveKitSupply.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Alternative Subgraph Borrow: $${totalSubgraphBorrow.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  AaveKit Borrow: $${totalAaveKitBorrow.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    
    const supplyDiffPercent = ((totalSubgraphSupply - totalAaveKitSupply) / totalAaveKitSupply) * 100;
    const borrowDiffPercent = ((totalSubgraphBorrow - totalAaveKitBorrow) / totalAaveKitBorrow) * 100;
    
    console.log(`\n  Supply difference: ${supplyDiffPercent > 0 ? '+' : ''}${supplyDiffPercent.toFixed(2)}%`);
    console.log(`  Borrow difference: ${borrowDiffPercent > 0 ? '+' : ''}${borrowDiffPercent.toFixed(2)}%`);
    
    if (Math.abs(supplyDiffPercent) < 10 && Math.abs(borrowDiffPercent) < 10) {
      console.log(`\n✅ SUCCESS: Alternative Subgraph data matches AaveKit!`);
      console.log(`   This Subgraph ID can be used for ${marketKey}.`);
    } else if (Math.abs(supplyDiffPercent) < 50 && Math.abs(borrowDiffPercent) < 50) {
      console.log(`\n⚠️  WARNING: Significant difference detected, but may be acceptable.`);
      console.log(`   Consider using this Subgraph ID if data quality is acceptable.`);
    } else {
      console.log(`\n❌ FAIL: Alternative Subgraph data differs significantly from AaveKit.`);
      console.log(`   This Subgraph ID should not be used for ${marketKey}.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAlternativeSubgraph()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
