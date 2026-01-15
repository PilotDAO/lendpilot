#!/usr/bin/env tsx

/**
 * Debug Subgraph prices for Linea - compare with AaveKit
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
import { priceToUSD } from '@/lib/calculations/totals';
import { getBlockByTimestamp } from '@/lib/api/rpc';
import { BigNumber } from '@/lib/utils/big-number';
import {
  calculateTotalSuppliedUSDFromSubgraph,
  calculateTotalBorrowedUSDFromSubgraph,
} from '@/lib/calculations/totals';

const marketKey = 'linea-v3';

async function debugLineaPrices() {
  console.log('🔍 Debugging Subgraph prices for Linea...\n');

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

      // Try different price formats for Subgraph
      const priceInEthNum = parseFloat(subReserve.price.priceInEth);
      
      // Format 1: USD * 1e8 (Ethereum format)
      const priceUSD1 = priceInEthNum / 1e8;
      // Format 2: Already in USD
      const priceUSD2 = priceInEthNum;
      // Format 3: USD * 1e6
      const priceUSD3 = priceInEthNum / 1e6;
      // Format 4: USD * 1e18
      const priceUSD4 = priceInEthNum / 1e18;

      // Calculate totals for each format
      const formats = [
        { name: 'USD*1e8', price: priceUSD1 },
        { name: 'USD (direct)', price: priceUSD2 },
        { name: 'USD*1e6', price: priceUSD3 },
        { name: 'USD*1e18', price: priceUSD4 },
      ];

      let bestFormat = formats[0];
      let bestDiff = Infinity;

      for (const format of formats) {
        if (format.price === 0 && aaveKitPriceUSD > 0) continue;
        
        const diff = Math.abs(format.price - aaveKitPriceUSD);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestFormat = format;
        }
      }

      // Calculate supply and borrow for best format
      const bestPriceUSD = bestFormat.price;
      const suppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
        subReserve.totalATokenSupply,
        subReserve.decimals,
        bestPriceUSD
      );
      const borrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
        subReserve.totalCurrentVariableDebt,
        subReserve.decimals,
        bestPriceUSD
      );

      const aaveKitSuppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
        aaveKitReserve.totalATokenSupply,
        aaveKitReserve.decimals,
        aaveKitPriceUSD
      );
      const aaveKitBorrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
        aaveKitReserve.totalCurrentVariableDebt,
        aaveKitReserve.decimals,
        aaveKitPriceUSD
      );

      totalSubgraphSupply += suppliedUSD;
      totalSubgraphBorrow += borrowedUSD;
      totalAaveKitSupply += aaveKitSuppliedUSD;
      totalAaveKitBorrow += aaveKitBorrowedUSD;

      if (Math.abs(suppliedUSD - aaveKitSuppliedUSD) > 1000 || 
          Math.abs(borrowedUSD - aaveKitBorrowedUSD) > 1000) {
        console.log(`${subReserve.symbol}:`);
        console.log(`  Subgraph priceInEth: ${subReserve.price.priceInEth}`);
        console.log(`  Best format: ${bestFormat.name} = $${bestPriceUSD.toFixed(2)}`);
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
    console.log(`\n  Real Aave: Supply=$183.90M, Borrow=$74.30M`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugLineaPrices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
