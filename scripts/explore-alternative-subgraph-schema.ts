#!/usr/bin/env tsx

/**
 * Explore alternative Subgraph schema for Linea
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { GraphQLClient } from 'graphql-request';
import { env } from '@/lib/config/env';

const alternativeSubgraphId = 'BGqexPsTuknE9sVfTprnGw4fNTENDD74WybN61DX68ye';

async function exploreSchema() {
  console.log('🔍 Exploring alternative Subgraph schema...\n');
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

    // Try to get introspection schema
    console.log('📊 Fetching schema introspection...');
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType {
            name
            fields {
              name
              type {
                name
                kind
              }
            }
          }
        }
      }
    `;

    try {
      const schema = await client.request(introspectionQuery) as any;
      console.log('✅ Schema fields:');
      if (schema?.__schema?.queryType?.fields) {
        for (const field of schema.__schema.queryType.fields.slice(0, 20)) {
          console.log(`   - ${field.name} (${field.type?.kind || 'unknown'})`);
        }
      }
    } catch (error) {
      console.log(`❌ Error fetching schema: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Try common queries
    console.log('\n📊 Trying common queries...\n');

    // Try protocols
    const tryQuery = async (name: string, query: string) => {
      try {
        const result = await client.request(query);
        console.log(`✅ ${name}: Found data`);
        if (result && typeof result === 'object') {
          const keys = Object.keys(result);
          if (keys.length > 0) {
            const firstKey = keys[0];
            const firstValue = (result as any)[firstKey];
            if (Array.isArray(firstValue)) {
              console.log(`   Count: ${firstValue.length}`);
              if (firstValue.length > 0) {
                console.log(`   Sample keys: ${Object.keys(firstValue[0]).slice(0, 5).join(', ')}`);
              }
            }
          }
        }
        return true;
      } catch (error) {
        console.log(`❌ ${name}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        return false;
      }
    };

    // Try different query patterns
    await tryQuery('protocols', `
      query {
        protocols(first: 1) {
          id
        }
      }
    `);

    await tryQuery('markets', `
      query {
        markets(first: 1) {
          id
        }
      }
    `);

    await tryQuery('lendingPools', `
      query {
        lendingPools(first: 1) {
          id
        }
      }
    `);

    await tryQuery('pools (lowercase)', `
      query {
        pools(first: 1) {
          id
        }
      }
    `);

    await tryQuery('reserves', `
      query {
        reserves(first: 1) {
          id
        }
      }
    `);

    await tryQuery('assets', `
      query {
        assets(first: 1) {
          id
        }
      }
    `);

    // Try to find pool by address in different ways
    console.log('\n📊 Trying to find pool by address...\n');
    const poolAddress = '0xc47b8c00b0f69a36fa203ffeac0334874574a8ac';

    await tryQuery('protocols with address filter', `
      query {
        protocols(where: { id: "${poolAddress}" }, first: 1) {
          id
        }
      }
    `);

    await tryQuery('markets with address filter', `
      query {
        markets(where: { id: "${poolAddress}" }, first: 1) {
          id
        }
      }
    `);

    await tryQuery('lendingPools with address filter', `
      query {
        lendingPools(where: { id: "${poolAddress}" }, first: 1) {
          id
        }
      }
    `);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

exploreSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
