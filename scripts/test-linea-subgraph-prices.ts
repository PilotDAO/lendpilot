#!/usr/bin/env tsx

/**
 * Test Subgraph price format for Linea
 * Compare with AaveKit to understand the format
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
import { priceFromSubgraphToUSD, priceToUSD } from '@/lib/calculations/totals';
import { getBlockByTimestamp } from '@/lib/api/rpc';

const marketKey = 'linea-v3';

async function testLineaPrices() {
  console.log('🔍 Testing Subgraph price format for Linea...\n');

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

    // Get current block
    const now = Math.floor(Date.now() / 1000);
    const blockResult = await getBlockByTimestamp(now);
    const currentBlock = blockResult.blockNumber;

    // Get current reserves from Subgraph
    console.log('📊 Fetching reserves from Subgraph (block', currentBlock, ')...');
    const subgraphReserves = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      currentBlock
    );

    // Get current reserves from AaveKit
    console.log('📊 Fetching reserves from AaveKit...');
    const aaveKitReserves = await queryReserves(marketKey);

    console.log(`\n📈 Comparing prices for ${subgraphReserves.length} reserves:\n`);
    console.log('='.repeat(100));
    console.log('Symbol'.padEnd(12) + 'Subgraph priceInEth'.padEnd(25) + 'Subgraph USD (current)'.padEnd(25) + 'AaveKit USD'.padEnd(20) + 'Match');
    console.log('='.repeat(100));

    let matches = 0;
    let mismatches = 0;

    for (const subReserve of subgraphReserves.slice(0, 10)) { // Check first 10
      const aaveKitReserve = aaveKitReserves.find(
        r => normalizeAddress(r.underlyingAsset) === normalizeAddress(subReserve.underlyingAsset)
      );

      if (!aaveKitReserve) continue;

      // AaveKit price
      const aaveKitPriceUSD = priceToUSD(
        aaveKitReserve.price.priceInEth,
        aaveKitReserve.symbol,
        normalizeAddress(aaveKitReserve.underlyingAsset)
      );

      if (aaveKitPriceUSD === 0) continue;

      const priceInEthNum = parseFloat(subReserve.price.priceInEth);
      
      // Try different formats
      const format1 = priceInEthNum / 1e8; // USD * 1e8 (Ethereum format)
      const format2 = priceInEthNum; // Already in USD
      const format3 = priceInEthNum / 1e18; // USD * 1e18
      const format4 = priceInEthNum * 1e8; // USD / 1e8

      const diffs = [
        { name: 'USD*1e8', price: format1, diff: Math.abs(format1 - aaveKitPriceUSD) },
        { name: 'USD (direct)', price: format2, diff: Math.abs(format2 - aaveKitPriceUSD) },
        { name: 'USD*1e18', price: format3, diff: Math.abs(format3 - aaveKitPriceUSD) },
        { name: 'USD/1e8', price: format4, diff: Math.abs(format4 - aaveKitPriceUSD) },
      ];

      const best = diffs.reduce((best, curr) => 
        curr.diff < best.diff ? curr : best
      );

      const bestDiffPercent = (best.diff / aaveKitPriceUSD) * 100;

      const isMatch = bestDiffPercent < 10; // Within 10%

      console.log(
        subReserve.symbol.padEnd(12) +
        subReserve.price.priceInEth.padEnd(25) +
        best.price.toFixed(6).padEnd(25) +
        aaveKitPriceUSD.toFixed(6).padEnd(20) +
        (isMatch ? '✅' : '❌') +
        ` (${best.name}, diff: ${bestDiffPercent.toFixed(2)}%)`
      );

      if (isMatch) {
        matches++;
      } else {
        mismatches++;
        // Show all formats for debugging
        console.log(`  Formats: USD*1e8=${format1.toFixed(2)}, USD=${format2.toFixed(2)}, USD*1e18=${format3.toFixed(2)}, USD/1e8=${format4.toFixed(2)}`);
      }
    }

    console.log('='.repeat(100));
    console.log(`\n✅ Matches: ${matches}, ❌ Mismatches: ${mismatches}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLineaPrices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
