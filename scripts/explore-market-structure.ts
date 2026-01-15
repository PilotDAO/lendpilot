#!/usr/bin/env tsx

/**
 * Explore Market structure in alternative Subgraph
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { GraphQLClient } from 'graphql-request';
import { env } from '@/lib/config/env';

const alternativeSubgraphId = 'BGqexPsTuknE9sVfTprnGw4fNTENDD74WybN61DX68ye';
const poolAddress = '0xc47b8c00b0f69a36fa203ffeac0334874574a8ac';

async function exploreMarketStructure() {
  console.log('🔍 Exploring Market structure...\n');

  try {
    const apiKey = process.env.GRAPH_API_KEY || env.GRAPH_API_KEY;
    const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${alternativeSubgraphId}`;
    const client = new GraphQLClient(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    // Get market with all possible fields
    console.log('📊 Querying market with all fields...');
    const marketQuery = `
      query GetMarket($marketId: ID!) {
        market(id: $marketId) {
          id
        }
      }
    `;

    const marketData = await client.request<{
      market: {
        id: string;
      } | null;
    }>(marketQuery, {
      marketId: poolAddress.toLowerCase(),
    });

    if (!marketData.market) {
      console.log('❌ Market not found with pool address, trying with different format...');
      
      // Try with different address formats
      for (const addr of [
        poolAddress,
        poolAddress.toLowerCase(),
        poolAddress.toUpperCase(),
      ]) {
        try {
          const result = await client.request(marketQuery, { marketId: addr }) as any;
          if (result?.market) {
            console.log(`✅ Market found with address: ${addr}`);
            console.log(`   Market ID: ${result.market.id}`);
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    } else {
      console.log(`✅ Market found: ${marketData.market.id}`);
    }

    // Get all markets to see structure
    console.log('\n📊 Querying all markets...');
    const allMarketsQuery = `
      query {
        markets(first: 5) {
          id
        }
      }
    `;

    const allMarkets = await client.request<{
      markets: Array<{ id: string }>;
    }>(allMarketsQuery);

    console.log(`✅ Found ${allMarkets.markets.length} markets:`);
    for (const m of allMarkets.markets) {
      console.log(`   - ${m.id}`);
    }

    // Get atokens separately
    console.log('\n📊 Querying aTokens...');
    const atokensQuery = `
      query {
        atokens(first: 10) {
          id
          underlyingAsset
          totalSupply
          token {
            id
            symbol
            decimals
            priceUSD
          }
        }
      }
    `;

    try {
      const atokensData = await client.request<{
        atokens: Array<{
          id: string;
          underlyingAsset: string;
          totalSupply: string;
          token: {
            id: string;
            symbol: string;
            decimals: number;
            priceUSD: string;
          };
        }>;
      }>(atokensQuery);

      console.log(`✅ Found ${atokensData.atokens.length} aTokens`);
      for (const atoken of atokensData.atokens.slice(0, 5)) {
        console.log(`   ${atoken.token.symbol}: ${atoken.underlyingAsset}`);
        console.log(`     Total Supply: ${atoken.totalSupply}`);
        console.log(`     Price: $${atoken.token.priceUSD}`);
        console.log('');
      }
    } catch (error) {
      console.log(`❌ Error querying aTokens: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Get variableDebtTokens separately
    console.log('📊 Querying variableDebtTokens...');
    const debtTokensQuery = `
      query {
        variableDebtTokens(first: 10) {
          id
          underlyingAsset
          totalSupply
          token {
            id
            symbol
            decimals
            priceUSD
          }
        }
      }
    `;

    try {
      const debtTokensData = await client.request<{
        variableDebtTokens: Array<{
          id: string;
          underlyingAsset: string;
          totalSupply: string;
          token: {
            id: string;
            symbol: string;
            decimals: number;
            priceUSD: string;
          };
        }>;
      }>(debtTokensQuery);

      console.log(`✅ Found ${debtTokensData.variableDebtTokens.length} variableDebtTokens`);
      for (const dt of debtTokensData.variableDebtTokens.slice(0, 5)) {
        console.log(`   ${dt.token.symbol}: ${dt.underlyingAsset}`);
        console.log(`     Total Supply: ${dt.totalSupply}`);
        console.log(`     Price: $${dt.token.priceUSD}`);
        console.log('');
      }
    } catch (error) {
      console.log(`❌ Error querying variableDebtTokens: ${error instanceof Error ? error.message : String(error)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

exploreMarketStructure()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
