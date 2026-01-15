#!/usr/bin/env tsx

/**
 * Test Subgraph API connection
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { queryPoolByAddress } from '@/lib/api/subgraph';
import { getMarket } from '@/lib/utils/market';
import { normalizeAddress } from '@/lib/utils/address';

const marketKey = 'ethereum-v3';

async function testSubgraphAPI() {
  console.log('🔍 Testing Subgraph API connection...\n');

  try {
    const market = getMarket(marketKey);
    if (!market) {
      console.error('❌ Market not found');
      return;
    }

    console.log(`Market: ${market.displayName}`);
    console.log(`Subgraph ID: ${market.subgraphId}`);
    console.log(`Pool Address: ${market.poolAddress}\n`);

    // Test queryPoolByAddress
    console.log('📊 Testing queryPoolByAddress...');
    const pool = await queryPoolByAddress(
      market.subgraphId,
      normalizeAddress(market.poolAddress)
    );

    if (pool) {
      console.log('✅ API работает!');
      console.log(`Pool ID: ${pool.id}`);
      console.log(`Pool Address: ${pool.pool}`);
    } else {
      console.log('⚠️  Pool not found (but API responded)');
    }

  } catch (error: any) {
    console.error('❌ API Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
  }
}

testSubgraphAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
