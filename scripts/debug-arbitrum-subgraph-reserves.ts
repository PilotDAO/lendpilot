#!/usr/bin/env tsx

/**
 * Debug why Arbitrum Subgraph returns fewer reserves
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
import { getBlockByTimestamp } from '@/lib/api/rpc';

const marketKey = 'arbitrum-v3';

async function debugArbitrumReserves() {
  console.log('🔍 Debugging Arbitrum Subgraph reserves...\n');

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

    console.log(`Pool Entity ID: ${pool.id}`);
    console.log(`Pool Address: ${pool.pool}\n`);

    // Get current block
    const now = Math.floor(Date.now() / 1000);
    const blockResult = await getBlockByTimestamp(now);
    const currentBlock = blockResult.blockNumber;

    // Get reserves from Subgraph
    console.log(`📊 Fetching reserves from Subgraph (block ${currentBlock})...`);
    const subgraphReserves = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      currentBlock
    );

    // Get reserves from AaveKit
    console.log('📊 Fetching reserves from AaveKit...');
    const aaveKitReserves = await queryReserves(marketKey);

    console.log(`\n📈 Reserve comparison:\n`);
    console.log(`Subgraph reserves: ${subgraphReserves.length}`);
    console.log(`AaveKit reserves: ${aaveKitReserves.length}\n`);

    // Show Subgraph reserves
    console.log('Subgraph reserves:');
    for (const reserve of subgraphReserves) {
      console.log(`  ${reserve.symbol} (${normalizeAddress(reserve.underlyingAsset)})`);
    }

    console.log('\nAaveKit reserves:');
    for (const reserve of aaveKitReserves) {
      const normalizedAsset = normalizeAddress(reserve.underlyingAsset);
      const inSubgraph = subgraphReserves.some(
        r => normalizeAddress(r.underlyingAsset) === normalizedAsset
      );
      console.log(`  ${reserve.symbol} (${normalizedAsset}) ${inSubgraph ? '✅' : '❌ MISSING'}`);
    }

    // Check if we're missing reserves
    const missingReserves = aaveKitReserves.filter(
      aaveKitReserve => !subgraphReserves.some(
        subReserve => normalizeAddress(subReserve.underlyingAsset) === normalizeAddress(aaveKitReserve.underlyingAsset)
      )
    );

    if (missingReserves.length > 0) {
      console.log(`\n⚠️  Missing ${missingReserves.length} reserves in Subgraph:`);
      for (const reserve of missingReserves) {
        console.log(`  - ${reserve.symbol} (${normalizeAddress(reserve.underlyingAsset)})`);
      }
    }

    // Check if Subgraph has reserves not in AaveKit
    const extraReserves = subgraphReserves.filter(
      subReserve => !aaveKitReserves.some(
        aaveKitReserve => normalizeAddress(aaveKitReserve.underlyingAsset) === normalizeAddress(subReserve.underlyingAsset)
      )
    );

    if (extraReserves.length > 0) {
      console.log(`\n⚠️  Extra ${extraReserves.length} reserves in Subgraph (not in AaveKit):`);
      for (const reserve of extraReserves) {
        console.log(`  - ${reserve.symbol} (${normalizeAddress(reserve.underlyingAsset)})`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugArbitrumReserves()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
