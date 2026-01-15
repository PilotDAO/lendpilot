#!/usr/bin/env tsx

/**
 * Check if the user mentioned address is a Pool Entity ID
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { GraphQLClient } from 'graphql-request';
import { env } from '@/lib/config/env';
import { getMarket } from '@/lib/utils/market';
import { normalizeAddress } from '@/lib/utils/address';

const marketKey = 'linea-v3';
const userMentionedAddress = '0x638571c9a2b9ce88dbe3e40d8f385f69417922ac';

async function checkAlternativePool() {
  console.log('🔍 Checking if user mentioned address is a Pool Entity ID...\n');

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('❌ Market not found');
      return;
    }

    const apiKey = process.env.GRAPH_API_KEY || env.GRAPH_API_KEY;
    const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${market.subgraphId}`;
    const client = new GraphQLClient(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    // Try to query pool by ID (not by address)
    console.log(`📊 Querying pool by ID: ${userMentionedAddress}...`);
    const queryById = `
      query PoolById($poolId: ID!) {
        pool(id: $poolId) {
          id
          pool
          addressProviderId
        }
      }
    `;

    try {
      const dataById = await client.request<{
        pool: {
          id: string;
          pool: string;
          addressProviderId: string;
        } | null;
      }>(queryById, {
        poolId: normalizeAddress(userMentionedAddress),
      });

      if (dataById.pool) {
        console.log(`✅ Pool found by ID:`);
        console.log(`   Pool Entity ID: ${dataById.pool.id}`);
        console.log(`   Pool Address: ${dataById.pool.pool}`);
        console.log(`   Address Provider ID: ${dataById.pool.addressProviderId}`);
      } else {
        console.log(`❌ Pool not found by ID`);
      }
    } catch (error) {
      console.log(`❌ Error querying by ID: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Also check reserves for this pool ID
    console.log(`\n📊 Checking reserves for pool ID: ${userMentionedAddress}...`);
    const queryReserves = `
      query ReservesByPool($poolId: ID!) {
        reserves(where: { pool: $poolId }, first: 5) {
          id
          underlyingAsset
          symbol
          name
        }
      }
    `;

    try {
      const dataReserves = await client.request<{
        reserves: Array<{
          id: string;
          underlyingAsset: string;
          symbol: string;
          name: string;
        }>;
      }>(queryReserves, {
        poolId: normalizeAddress(userMentionedAddress),
      });

      if (dataReserves.reserves.length > 0) {
        console.log(`✅ Found ${dataReserves.reserves.length} reserves for this pool ID:`);
        for (const reserve of dataReserves.reserves) {
          console.log(`   ${reserve.symbol} (${reserve.name})`);
        }
      } else {
        console.log(`❌ No reserves found for this pool ID`);
      }
    } catch (error) {
      console.log(`❌ Error querying reserves: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log(`   Current config uses pool address: ${market.poolAddress}`);
    console.log(`   Current pool entity ID: 0x89502c3731f69ddc95b65753708a07f8cd0373f4`);
    console.log(`   User mentioned address: ${userMentionedAddress}`);
    console.log(`\n   If ${userMentionedAddress} is a valid pool entity ID, we should use it instead.`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAlternativePool()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
