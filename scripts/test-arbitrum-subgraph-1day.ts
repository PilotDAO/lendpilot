#!/usr/bin/env tsx

/**
 * Test Arbitrum Subgraph - collect 1 day of data and compare with AaveKit
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
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'arbitrum-v3';

async function testArbitrumSubgraph1Day() {
  console.log('🔍 Testing Arbitrum Subgraph - 1 day of data...\n');

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('❌ Market not found');
      return;
    }

    console.log(`Market: ${market.displayName}`);
    console.log(`Subgraph ID: ${market.subgraphId}`);
    console.log(`Pool Address: ${market.poolAddress}\n`);

    // Get pool entity
    const pool = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(market.poolAddress)
    );
    if (!pool) {
      console.error('❌ Pool not found');
      return;
    }

    console.log(`✅ Pool found:`);
    console.log(`   Pool Entity ID: ${pool.id}`);
    console.log(`   Pool Address: ${pool.pool}\n`);

    // Get yesterday's block (1 day ago)
    const now = Math.floor(Date.now() / 1000);
    const yesterday = now - (24 * 60 * 60); // 1 day ago
    const yesterdayBlockResult = await getBlockByTimestamp(yesterday);
    const yesterdayBlock = yesterdayBlockResult.blockNumber;

    // Get current block
    const currentBlockResult = await getBlockByTimestamp(now);
    const currentBlock = currentBlockResult.blockNumber;

    console.log(`📊 Block numbers:`);
    console.log(`   Yesterday (${new Date(yesterday * 1000).toISOString()}): ${yesterdayBlock}`);
    console.log(`   Current (${new Date(now * 1000).toISOString()}): ${currentBlock}\n`);

    // Get reserves from Subgraph for yesterday
    console.log(`📊 Fetching reserves from Subgraph for yesterday (block ${yesterdayBlock})...`);
    const subgraphReservesYesterday = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      yesterdayBlock
    );

    // Get reserves from Subgraph for today
    console.log(`📊 Fetching reserves from Subgraph for today (block ${currentBlock})...`);
    const subgraphReservesToday = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      currentBlock
    );

    console.log(`✅ Found ${subgraphReservesYesterday.length} reserves yesterday`);
    console.log(`✅ Found ${subgraphReservesToday.length} reserves today\n`);

    // Get reserves from AaveKit (current)
    console.log('📊 Fetching current reserves from AaveKit...');
    const aaveKitReserves = await queryReserves(marketKey);
    console.log(`✅ Found ${aaveKitReserves.length} reserves in AaveKit\n`);

    // Calculate totals from Subgraph (yesterday)
    let totalSubgraphSupplyYesterday = 0;
    let totalSubgraphBorrowYesterday = 0;

    // Calculate totals from Subgraph (today)
    let totalSubgraphSupplyToday = 0;
    let totalSubgraphBorrowToday = 0;

    // Calculate totals from AaveKit (current)
    let totalAaveKitSupply = 0;
    let totalAaveKitBorrow = 0;

    console.log('📈 Comparing reserves (showing top 10 by supply):\n');
    console.log('='.repeat(140));
    console.log(
      'Symbol'.padEnd(12) +
      'Subgraph Yest'.padEnd(20) +
      'Subgraph Today'.padEnd(20) +
      'AaveKit'.padEnd(20) +
      'Price Match'.padEnd(15) +
      'Supply Match'.padEnd(15)
    );
    console.log('='.repeat(140));

    const reserveComparisons: Array<{
      symbol: string;
      subgraphPrice: number;
      aaveKitPrice: number;
      subgraphSupplyYesterday: number;
      subgraphSupplyToday: number;
      aaveKitSupply: number;
      subgraphBorrowYesterday: number;
      subgraphBorrowToday: number;
      aaveKitBorrow: number;
    }> = [];

    for (const subReserveToday of subgraphReservesToday) {
      const normalizedAsset = normalizeAddress(subReserveToday.underlyingAsset);
      
      const subReserveYesterday = subgraphReservesYesterday.find(
        r => normalizeAddress(r.underlyingAsset) === normalizedAsset
      );

      const aaveKitReserve = aaveKitReserves.find(
        r => normalizeAddress(r.underlyingAsset) === normalizedAsset
      );

      if (!aaveKitReserve) continue;

      const aaveKitPriceUSD = priceToUSD(
        aaveKitReserve.price.priceInEth,
        aaveKitReserve.symbol,
        normalizedAsset
      );

      const subgraphPriceUSD = priceFromSubgraphToUSD(
        subReserveToday.price.priceInEth,
        subReserveToday.symbol,
        marketKey
      );

      // Calculate supply and borrow for yesterday
      const suppliedUSDYesterday = subReserveYesterday
        ? calculateTotalSuppliedUSDFromSubgraph(
            subReserveYesterday.totalATokenSupply,
            subReserveYesterday.decimals,
            priceFromSubgraphToUSD(subReserveYesterday.price.priceInEth, subReserveYesterday.symbol, marketKey)
          )
        : 0;
      const borrowedUSDYesterday = subReserveYesterday
        ? calculateTotalBorrowedUSDFromSubgraph(
            subReserveYesterday.totalCurrentVariableDebt,
            subReserveYesterday.decimals,
            priceFromSubgraphToUSD(subReserveYesterday.price.priceInEth, subReserveYesterday.symbol, marketKey)
          )
        : 0;

      // Calculate supply and borrow for today
      const suppliedUSDToday = calculateTotalSuppliedUSDFromSubgraph(
        subReserveToday.totalATokenSupply,
        subReserveToday.decimals,
        subgraphPriceUSD
      );
      const borrowedUSDToday = calculateTotalBorrowedUSDFromSubgraph(
        subReserveToday.totalCurrentVariableDebt,
        subReserveToday.decimals,
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

      totalSubgraphSupplyYesterday += suppliedUSDYesterday;
      totalSubgraphBorrowYesterday += borrowedUSDYesterday;
      totalSubgraphSupplyToday += suppliedUSDToday;
      totalSubgraphBorrowToday += borrowedUSDToday;
      totalAaveKitSupply += aaveKitSuppliedUSD;
      totalAaveKitBorrow += aaveKitBorrowedUSD;

      const priceDiffPercent = aaveKitPriceUSD > 0 
        ? (Math.abs(subgraphPriceUSD - aaveKitPriceUSD) / aaveKitPriceUSD) * 100 
        : 0;
      const supplyDiffPercent = aaveKitSuppliedUSD > 0 
        ? (Math.abs(suppliedUSDToday - aaveKitSuppliedUSD) / aaveKitSuppliedUSD) * 100 
        : 0;

      reserveComparisons.push({
        symbol: subReserveToday.symbol,
        subgraphPrice: subgraphPriceUSD,
        aaveKitPrice: aaveKitPriceUSD,
        subgraphSupplyYesterday: suppliedUSDYesterday,
        subgraphSupplyToday: suppliedUSDToday,
        aaveKitSupply: aaveKitSuppliedUSD,
        subgraphBorrowYesterday: borrowedUSDYesterday,
        subgraphBorrowToday: borrowedUSDToday,
        aaveKitBorrow: aaveKitBorrowedUSD,
      });
    }

    // Sort by supply and show top 10
    reserveComparisons.sort((a, b) => b.aaveKitSupply - a.aaveKitSupply);

    for (const comp of reserveComparisons.slice(0, 10)) {
      const priceMatch = Math.abs(comp.subgraphPrice - comp.aaveKitPrice) / comp.aaveKitPrice < 0.1 ? '✅' : '❌';
      const supplyMatch = Math.abs(comp.subgraphSupplyToday - comp.aaveKitSupply) / comp.aaveKitSupply < 0.1 ? '✅' : '❌';
      
      console.log(
        comp.symbol.padEnd(12) +
        `$${comp.subgraphSupplyYesterday.toLocaleString()}`.padEnd(20) +
        `$${comp.subgraphSupplyToday.toLocaleString()}`.padEnd(20) +
        `$${comp.aaveKitSupply.toLocaleString()}`.padEnd(20) +
        priceMatch.padEnd(15) +
        supplyMatch
      );
    }

    console.log('='.repeat(140));
    console.log('\n📊 Totals:');
    console.log(`  Subgraph Yesterday Supply: $${totalSubgraphSupplyYesterday.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Subgraph Today Supply: $${totalSubgraphSupplyToday.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  AaveKit Supply: $${totalAaveKitSupply.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Subgraph Yesterday Borrow: $${totalSubgraphBorrowYesterday.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Subgraph Today Borrow: $${totalSubgraphBorrowToday.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  AaveKit Borrow: $${totalAaveKitBorrow.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    
    const supplyDiffPercent = ((totalSubgraphSupplyToday - totalAaveKitSupply) / totalAaveKitSupply) * 100;
    const borrowDiffPercent = ((totalSubgraphBorrowToday - totalAaveKitBorrow) / totalAaveKitBorrow) * 100;
    
    console.log(`\n  Supply difference (Today vs AaveKit): ${supplyDiffPercent > 0 ? '+' : ''}${supplyDiffPercent.toFixed(2)}%`);
    console.log(`  Borrow difference (Today vs AaveKit): ${borrowDiffPercent > 0 ? '+' : ''}${borrowDiffPercent.toFixed(2)}%`);
    
    const supplyChange1d = ((totalSubgraphSupplyToday - totalSubgraphSupplyYesterday) / totalSubgraphSupplyYesterday) * 100;
    const borrowChange1d = ((totalSubgraphBorrowToday - totalSubgraphBorrowYesterday) / totalSubgraphBorrowYesterday) * 100;
    
    console.log(`\n  Supply change (1 day): ${supplyChange1d > 0 ? '+' : ''}${supplyChange1d.toFixed(2)}%`);
    console.log(`  Borrow change (1 day): ${borrowChange1d > 0 ? '+' : ''}${borrowChange1d.toFixed(2)}%`);
    
    if (Math.abs(supplyDiffPercent) < 10 && Math.abs(borrowDiffPercent) < 10) {
      console.log(`\n✅ SUCCESS: Arbitrum Subgraph data matches AaveKit!`);
      console.log(`   Subgraph can be used for historical data collection.`);
    } else if (Math.abs(supplyDiffPercent) < 50 && Math.abs(borrowDiffPercent) < 50) {
      console.log(`\n⚠️  WARNING: Significant difference detected, but may be acceptable.`);
      console.log(`   Consider validating data quality before using for historical data.`);
    } else {
      console.log(`\n❌ FAIL: Arbitrum Subgraph data differs significantly from AaveKit.`);
      console.log(`   Subgraph should not be used for historical data collection.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  }
}

testArbitrumSubgraph1Day()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
