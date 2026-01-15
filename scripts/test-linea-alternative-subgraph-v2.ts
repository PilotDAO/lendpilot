#!/usr/bin/env tsx

/**
 * Test alternative Subgraph ID for Linea with correct schema
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { GraphQLClient } from 'graphql-request';
import { env } from '@/lib/config/env';
import { queryReserves } from '@/lib/api/aavekit';
import { normalizeAddress } from '@/lib/utils/address';
import { 
  priceToUSD,
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
} from '@/lib/calculations/totals';
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'linea-v3';
const alternativeSubgraphId = 'BGqexPsTuknE9sVfTprnGw4fNTENDD74WybN61DX68ye';
const poolAddress = '0xc47b8c00b0f69a36fa203ffeac0334874574a8ac';

async function testAlternativeSubgraphV2() {
  console.log('🔍 Testing alternative Subgraph ID for Linea (v2 schema)...\n');
  console.log(`Subgraph ID: ${alternativeSubgraphId}\n`);

  try {
    const apiKey = process.env.GRAPH_API_KEY || env.GRAPH_API_KEY;
    const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${alternativeSubgraphId}`;
    const client = new GraphQLClient(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    // Get market
    console.log('📊 Querying market...');
    const marketQuery = `
      query GetMarket($marketId: ID!) {
        market(id: $marketId) {
          id
          atokens {
            id
            underlyingAsset
            totalSupply
            token {
              symbol
              decimals
            }
          }
          variableDebtTokens {
            id
            underlyingAsset
            totalSupply
            token {
              symbol
              decimals
            }
          }
        }
      }
    `;

    const marketData = await client.request<{
      market: {
        id: string;
        atokens: Array<{
          id: string;
          underlyingAsset: string;
          totalSupply: string;
          token: {
            symbol: string;
            decimals: number;
          };
        }>;
        variableDebtTokens: Array<{
          id: string;
          underlyingAsset: string;
          totalSupply: string;
          token: {
            symbol: string;
            decimals: number;
          };
        }>;
      } | null;
    }>(marketQuery, {
      marketId: normalizeAddress(poolAddress),
    });

    if (!marketData.market) {
      console.error('❌ Market not found');
      return;
    }

    console.log(`✅ Market found: ${marketData.market.id}`);
    console.log(`   aTokens: ${marketData.market.atokens.length}`);
    console.log(`   Variable Debt Tokens: ${marketData.market.variableDebtTokens.length}\n`);

    // Get tokens with prices
    console.log('📊 Querying tokens with prices...');
    const tokensQuery = `
      query GetTokens {
        tokens(first: 100) {
          id
          symbol
          decimals
          priceUSD
        }
      }
    `;

    const tokensData = await client.request<{
      tokens: Array<{
        id: string;
        symbol: string;
        decimals: number;
        priceUSD: string;
      }>;
    }>(tokensQuery);

    const priceMap = new Map<string, number>();
    for (const token of tokensData.tokens) {
      priceMap.set(normalizeAddress(token.id), parseFloat(token.priceUSD));
    }

    console.log(`✅ Found ${tokensData.tokens.length} tokens with prices\n`);

    // Get AaveKit data for comparison
    console.log('📊 Fetching AaveKit data...');
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

    // Match aTokens with variableDebtTokens
    for (const aToken of marketData.market.atokens) {
      const normalizedAsset = normalizeAddress(aToken.underlyingAsset);
      const priceUSD = priceMap.get(normalizedAsset) || 0;

      const debtToken = marketData.market.variableDebtTokens.find(
        dt => normalizeAddress(dt.underlyingAsset) === normalizedAsset
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

      // Calculate supply (aToken totalSupply)
      const suppliedTokens = new BigNumber(aToken.totalSupply).div(
        new BigNumber(10).pow(aToken.token.decimals)
      );
      const suppliedUSD = suppliedTokens.times(priceUSD).toNumber();

      // Calculate borrow (variableDebtToken totalSupply)
      const borrowedTokens = debtToken
        ? new BigNumber(debtToken.totalSupply).div(
            new BigNumber(10).pow(debtToken.token.decimals)
          )
        : new BigNumber(0);
      const borrowedUSD = borrowedTokens.times(priceUSD).toNumber();

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

      const supplyDiffPercent = aaveKitSuppliedUSD > 0 
        ? (Math.abs(suppliedUSD - aaveKitSuppliedUSD) / aaveKitSuppliedUSD) * 100 
        : 0;
      const borrowDiffPercent = aaveKitBorrowedUSD > 0 
        ? (Math.abs(borrowedUSD - aaveKitBorrowedUSD) / aaveKitBorrowedUSD) * 100 
        : 0;

      const isMatch = supplyDiffPercent < 10 && borrowDiffPercent < 10;

      if (suppliedUSD > 1000 || borrowedUSD > 1000) {
        console.log(
          aToken.token.symbol.padEnd(12) +
          `$${priceUSD.toFixed(2)}`.padEnd(18) +
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
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  }
}

testAlternativeSubgraphV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
