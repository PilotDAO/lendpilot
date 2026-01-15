#!/usr/bin/env tsx

/**
 * Check Linea pool address and pool entity ID
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { queryPoolByAddress } from '@/lib/api/subgraph';
import { getMarket } from '@/lib/utils/market';
import { normalizeAddress } from '@/lib/utils/address';

const marketKey = 'linea-v3';
const userMentionedAddress = '0x638571c9a2b9ce88dbe3e40d8f385f69417922ac';

async function checkLineaPool() {
  console.log('🔍 Checking Linea pool configuration...\n');

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('❌ Market not found');
      return;
    }

    console.log(`Market: ${market.displayName}`);
    console.log(`Subgraph ID: ${market.subgraphId}`);
    console.log(`Pool Address (config): ${market.poolAddress}`);
    console.log(`User mentioned address: ${userMentionedAddress}\n`);

    // Check with current pool address
    console.log('📊 Querying pool with current pool address...');
    const pool1 = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(market.poolAddress)
    );

    if (pool1) {
      console.log(`✅ Pool found with current address:`);
      console.log(`   Pool Entity ID: ${pool1.id}`);
      console.log(`   Pool Address: ${pool1.pool}`);
    } else {
      console.log(`❌ Pool not found with current address`);
    }

    console.log('\n📊 Querying pool with user mentioned address...');
    const pool2 = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(userMentionedAddress)
    );

    if (pool2) {
      console.log(`✅ Pool found with user mentioned address:`);
      console.log(`   Pool Entity ID: ${pool2.id}`);
      console.log(`   Pool Address: ${pool2.pool}`);
    } else {
      console.log(`❌ Pool not found with user mentioned address`);
    }

    // Also try to query all pools
    console.log('\n📊 Querying all pools in subgraph...');
    const { GraphQLClient } = await import('graphql-request');
    const { env } = await import('@/lib/config/env');
    
    const apiKey = process.env.GRAPH_API_KEY || env.GRAPH_API_KEY;
    const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${market.subgraphId}`;
    const client = new GraphQLClient(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const query = `
      query AllPools {
        pools(first: 10) {
          id
          pool
          addressProviderId
        }
      }
    `;

    const data = await client.request<{
      pools: Array<{
        id: string;
        pool: string;
        addressProviderId: string;
      }>;
    }>(query);

    console.log(`\n📋 Found ${data.pools.length} pools in subgraph:`);
    for (const pool of data.pools) {
      console.log(`   Pool Entity ID: ${pool.id}`);
      console.log(`   Pool Address: ${pool.pool}`);
      console.log(`   Address Provider ID: ${pool.addressProviderId}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLineaPool()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
