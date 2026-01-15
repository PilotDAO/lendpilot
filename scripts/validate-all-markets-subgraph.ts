#!/usr/bin/env tsx

/**
 * Validate Subgraph data for all markets
 * Compare 1 day of data with AaveKit API
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { queryReservesAtBlock, queryPoolByAddress } from '@/lib/api/subgraph';
import { queryReserves } from '@/lib/api/aavekit';
import { loadMarkets } from '@/lib/utils/market';
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

interface MarketValidationResult {
  marketKey: string;
  displayName: string;
  subgraphId: string;
  poolFound: boolean;
  poolEntityId?: string;
  subgraphReservesCount: number;
  aaveKitReservesCount: number;
  missingReserves: number;
  totalSubgraphSupply: number;
  totalAaveKitSupply: number;
  totalSubgraphBorrow: number;
  totalAaveKitBorrow: number;
  supplyDiffPercent: number;
  borrowDiffPercent: number;
  priceMatches: number;
  priceMismatches: number;
  status: 'reliable' | 'unreliable' | 'error';
  error?: string;
}

async function validateMarket(marketKey: string): Promise<MarketValidationResult> {
  const result: MarketValidationResult = {
    marketKey,
    displayName: '',
    subgraphId: '',
    poolFound: false,
    subgraphReservesCount: 0,
    aaveKitReservesCount: 0,
    missingReserves: 0,
    totalSubgraphSupply: 0,
    totalAaveKitSupply: 0,
    totalSubgraphBorrow: 0,
    totalAaveKitBorrow: 0,
    supplyDiffPercent: 0,
    borrowDiffPercent: 0,
    priceMatches: 0,
    priceMismatches: 0,
    status: 'error',
  };

  try {
    const market = loadMarkets().find(m => m.marketKey === marketKey);
    if (!market) {
      result.error = 'Market not found';
      return result;
    }

    result.displayName = market.displayName;
    result.subgraphId = market.subgraphId;

    // Check if GRAPH_API_KEY is set
    if (!process.env.GRAPH_API_KEY || process.env.GRAPH_API_KEY.trim() === '') {
      result.error = 'GRAPH_API_KEY not set';
      return result;
    }

    // Get pool entity
    const pool = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(market.poolAddress)
    );

    if (!pool) {
      result.error = 'Pool not found in Subgraph';
      return result;
    }

    result.poolFound = true;
    result.poolEntityId = pool.id;

    // Get current block
    const now = Math.floor(Date.now() / 1000);
    const blockResult = await getBlockByTimestamp(now);
    const currentBlock = blockResult.blockNumber;

    // Get reserves from Subgraph
    const subgraphReserves = await queryReservesAtBlock(
      market.subgraphId,
      pool.id,
      currentBlock
    );

    result.subgraphReservesCount = subgraphReserves.length;

    // Get reserves from AaveKit
    const aaveKitReserves = await queryReserves(marketKey);
    result.aaveKitReservesCount = aaveKitReserves.length;

    // Calculate totals and compare
    let totalSubgraphSupply = 0;
    let totalSubgraphBorrow = 0;
    let totalAaveKitSupply = 0;
    let totalAaveKitBorrow = 0;
    let priceMatches = 0;
    let priceMismatches = 0;
    let missingReserves = 0;

    for (const aaveKitReserve of aaveKitReserves) {
      const normalizedAsset = normalizeAddress(aaveKitReserve.underlyingAsset);
      const subReserve = subgraphReserves.find(
        r => normalizeAddress(r.underlyingAsset) === normalizedAsset
      );

      const aaveKitPriceUSD = priceToUSD(
        aaveKitReserve.price.priceInEth,
        aaveKitReserve.symbol,
        normalizedAsset
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

      totalAaveKitSupply += aaveKitSuppliedUSD;
      totalAaveKitBorrow += aaveKitBorrowedUSD;

      if (!subReserve) {
        missingReserves++;
        continue;
      }

      const subgraphPriceUSD = priceFromSubgraphToUSD(
        subReserve.price.priceInEth,
        subReserve.symbol,
        marketKey
      );

      const priceDiffPercent = aaveKitPriceUSD > 0 
        ? (Math.abs(subgraphPriceUSD - aaveKitPriceUSD) / aaveKitPriceUSD) * 100 
        : 0;

      if (priceDiffPercent < 10) {
        priceMatches++;
      } else {
        priceMismatches++;
      }

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

      totalSubgraphSupply += suppliedUSD;
      totalSubgraphBorrow += borrowedUSD;
    }

    result.missingReserves = missingReserves;
    result.totalSubgraphSupply = totalSubgraphSupply;
    result.totalAaveKitSupply = totalAaveKitSupply;
    result.totalSubgraphBorrow = totalSubgraphBorrow;
    result.totalAaveKitBorrow = totalAaveKitBorrow;
    result.priceMatches = priceMatches;
    result.priceMismatches = priceMismatches;

    if (totalAaveKitSupply > 0) {
      result.supplyDiffPercent = ((totalSubgraphSupply - totalAaveKitSupply) / totalAaveKitSupply) * 100;
    }
    if (totalAaveKitBorrow > 0) {
      result.borrowDiffPercent = ((totalSubgraphBorrow - totalAaveKitBorrow) / totalAaveKitBorrow) * 100;
    }

    // Determine status
    const supplyDiff = Math.abs(result.supplyDiffPercent);
    const borrowDiff = Math.abs(result.borrowDiffPercent);
    const missingPercent = (missingReserves / aaveKitReserves.length) * 100;

    if (result.error) {
      result.status = 'error';
    } else if (supplyDiff < 10 && borrowDiff < 10 && missingPercent < 10) {
      result.status = 'reliable';
    } else {
      result.status = 'unreliable';
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.status = 'error';
  }

  return result;
}

async function validateAllMarkets() {
  console.log('🔍 Validating Subgraph data for all markets...\n');
  console.log('This will compare 1 day of data from Subgraph with AaveKit API\n');

  const markets = loadMarkets();
  const results: MarketValidationResult[] = [];

  console.log(`Found ${markets.length} markets to validate\n`);
  console.log('='.repeat(120));

  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    console.log(`\n[${i + 1}/${markets.length}] Validating ${market.marketKey} (${market.displayName})...`);
    
    const result = await validateMarket(market.marketKey);
    results.push(result);

    if (result.status === 'error') {
      console.log(`  ❌ Error: ${result.error}`);
    } else if (result.status === 'reliable') {
      console.log(`  ✅ Reliable`);
    } else {
      console.log(`  ⚠️  Unreliable`);
    }
  }

  // Generate report
  console.log('\n\n' + '='.repeat(120));
  console.log('📊 VALIDATION REPORT');
  console.log('='.repeat(120));

  const reliable = results.filter(r => r.status === 'reliable');
  const unreliable = results.filter(r => r.status === 'unreliable');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\n✅ Reliable: ${reliable.length}`);
  console.log(`⚠️  Unreliable: ${unreliable.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  console.log(`📊 Total: ${results.length}\n`);

  // Detailed table
  console.log('='.repeat(120));
  console.log(
    'Market'.padEnd(20) +
    'Status'.padEnd(12) +
    'Subgraph'.padEnd(12) +
    'AaveKit'.padEnd(12) +
    'Missing'.padEnd(10) +
    'Supply Diff'.padEnd(15) +
    'Borrow Diff'.padEnd(15) +
    'Price Match'
  );
  console.log('='.repeat(120));

  for (const result of results) {
    const status = result.status === 'reliable' ? '✅ Reliable' : 
                   result.status === 'unreliable' ? '⚠️  Unreliable' : 
                   '❌ Error';
    const supplyDiff = result.supplyDiffPercent.toFixed(1) + '%';
    const borrowDiff = result.borrowDiffPercent.toFixed(1) + '%';
    const priceMatch = result.priceMatches > 0 || result.priceMismatches > 0
      ? `${result.priceMatches}/${result.priceMatches + result.priceMismatches}`
      : 'N/A';

    console.log(
      result.marketKey.padEnd(20) +
      status.padEnd(12) +
      result.subgraphReservesCount.toString().padEnd(12) +
      result.aaveKitReservesCount.toString().padEnd(12) +
      result.missingReserves.toString().padEnd(10) +
      supplyDiff.padEnd(15) +
      borrowDiff.padEnd(15) +
      priceMatch
    );
  }

  // Unreliable markets details
  if (unreliable.length > 0) {
    console.log('\n\n⚠️  UNRELIABLE MARKETS DETAILS:');
    console.log('='.repeat(120));
    for (const result of unreliable) {
      console.log(`\n${result.marketKey} (${result.displayName}):`);
      console.log(`  Subgraph ID: ${result.subgraphId}`);
      console.log(`  Pool Found: ${result.poolFound ? '✅' : '❌'}`);
      if (result.poolEntityId) {
        console.log(`  Pool Entity ID: ${result.poolEntityId}`);
      }
      console.log(`  Reserves: Subgraph=${result.subgraphReservesCount}, AaveKit=${result.aaveKitReservesCount}, Missing=${result.missingReserves}`);
      console.log(`  Supply: Subgraph=$${result.totalSubgraphSupply.toLocaleString()}, AaveKit=$${result.totalAaveKitSupply.toLocaleString()}, Diff=${result.supplyDiffPercent.toFixed(2)}%`);
      console.log(`  Borrow: Subgraph=$${result.totalSubgraphBorrow.toLocaleString()}, AaveKit=$${result.totalAaveKitBorrow.toLocaleString()}, Diff=${result.borrowDiffPercent.toFixed(2)}%`);
      console.log(`  Prices: Matches=${result.priceMatches}, Mismatches=${result.priceMismatches}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }
  }

  // Error markets
  if (errors.length > 0) {
    console.log('\n\n❌ ERROR MARKETS:');
    console.log('='.repeat(120));
    for (const result of errors) {
      console.log(`\n${result.marketKey} (${result.displayName}):`);
      console.log(`  Error: ${result.error || 'Unknown error'}`);
    }
  }

  // Recommendations
  console.log('\n\n📋 RECOMMENDATIONS:');
  console.log('='.repeat(120));
  
  const unreliableMarketKeys = unreliable.map(r => r.marketKey);
  if (unreliableMarketKeys.length > 0) {
    console.log(`\nMarkets to add to UNRELIABLE_MARKETS list:`);
    console.log(`  const UNRELIABLE_MARKETS = [${unreliableMarketKeys.map(k => `'${k}'`).join(', ')}];`);
  }

  console.log('\n✅ Validation complete!');
}

validateAllMarkets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
