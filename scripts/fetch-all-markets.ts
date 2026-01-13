#!/usr/bin/env tsx
/**
 * Script to fetch all available Aave markets from AaveKit GraphQL API
 * and generate markets.json configuration file
 */

import { GraphQLClient } from "graphql-request";
import { writeFileSync } from "fs";
import { join } from "path";
import { env } from "../lib/config/env";

interface MarketConfig {
  marketKey: string;
  displayName: string;
  poolAddress: string;
  subgraphId: string;
  chainId: number;
  rpcUrls: string[];
  url?: string;
}

interface AaveKitChain {
  name: string;
  chainId: number;
  icon: string;
  explorerUrl: string;
  isTestnet: boolean;
}

interface AaveKitMarket {
  name: string;
  address: string;
  chain: {
    chainId: number;
    name: string;
  };
}

// Mapping of chainId to subgraph IDs and RPC URLs
// Based on known Aave v3 deployments
const CHAIN_CONFIG: Record<number, { subgraphId: string; rpcUrls: string[] }> = {
  // Ethereum Mainnet
  1: {
    subgraphId: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
    rpcUrls: [
      "https://eth.drpc.org",
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum-rpc.publicnode.com",
    ],
  },
  // Arbitrum V3
  // Source: https://github.com/aave/protocol-subgraphs
  42161: {
    subgraphId: "DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B",
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.drpc.org",
      "https://rpc.ankr.com/arbitrum",
    ],
  },
  // Optimism V3
  // Source: https://github.com/aave/protocol-subgraphs
  10: {
    subgraphId: "DSfLz8oQBUeU5atALgUFQKMTSYV9mZAVYp4noLSXAfvb",
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://optimism.drpc.org",
      "https://rpc.ankr.com/optimism",
    ],
  },
  // Polygon V3
  // Source: https://github.com/aave/protocol-subgraphs
  137: {
    subgraphId: "Co2URyXjnxaw8WqxKyVHdirq9Ahhm5vcTs4dMedAq211",
    rpcUrls: [
      "https://polygon-rpc.com",
      "https://polygon.drpc.org",
      "https://rpc.ankr.com/polygon",
    ],
  },
  // Avalanche V3
  // Source: https://github.com/aave/protocol-subgraphs
  43114: {
    subgraphId: "2h9woxy8RTjHu1HJsCEnmzpPHFArU33avmUh4f71JpVn",
    rpcUrls: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://avalanche.drpc.org",
      "https://rpc.ankr.com/avalanche",
    ],
  },
  // Base V3
  // Source: https://github.com/aave/protocol-subgraphs
  8453: {
    subgraphId: "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF",
    rpcUrls: [
      "https://mainnet.base.org",
      "https://base.drpc.org",
      "https://rpc.ankr.com/base",
    ],
  },
  // Scroll V3
  // Source: https://github.com/aave/protocol-subgraphs
  534352: {
    subgraphId: "74JwenoHZb2aAYVGCCSdPWzi9mm745dyHyQQVoZ7Sbub",
    rpcUrls: [
      "https://rpc.scroll.io",
      "https://scroll.drpc.org",
    ],
  },
  // Metis V3
  // Note: Uses custom endpoint: https://metisapi.0xgraph.xyz/subgraphs/name/aave/protocol-v3-metis
  // May not have deployed subgraph ID on The Graph Network
  1088: {
    subgraphId: "", // Custom endpoint, no deployed subgraph ID
    rpcUrls: [
      "https://andromeda.metis.io/?owner=1088",
      "https://metis.drpc.org",
    ],
  },
  // BNB Chain V3
  // Source: https://github.com/aave/protocol-subgraphs
  56: {
    subgraphId: "7Jk85XgkV1MQ7u56hD8rr65rfASbayJXopugWkUoBMnZ",
    rpcUrls: [
      "https://bsc-dataseed1.binance.org",
      "https://bsc.drpc.org",
      "https://rpc.ankr.com/bsc",
    ],
  },
  // Gnosis V3
  // Source: https://github.com/aave/protocol-subgraphs
  100: {
    subgraphId: "HtcDaL8L8iZ2KQNNS44EBVmLruzxuNAz1RkBYdui1QUT",
    rpcUrls: [
      "https://rpc.gnosischain.com",
      "https://gnosis.drpc.org",
    ],
  },
  // ZKsync Era V3
  // Source: https://github.com/aave/protocol-subgraphs
  324: {
    subgraphId: "ENYSc8G3WvrbhWH8UZHrqPWYRcuyCaNmaTmoVp7uzabM",
    rpcUrls: [
      "https://mainnet.era.zksync.io",
      "https://zksync.drpc.org",
      "https://rpc.ankr.com/zksync_era",
    ],
  },
  // Linea V3
  // Source: https://github.com/aave/protocol-subgraphs
  59144: {
    subgraphId: "Gz2kjnmRV1fQj3R8cssoZa5y9VTanhrDo4Mh7nWW1wHa",
    rpcUrls: [
      "https://rpc.linea.build",
      "https://linea.drpc.org",
    ],
  },
  // Sonic V3
  // Source: https://github.com/aave/protocol-subgraphs
  146: {
    subgraphId: "FQcacc4ZJaQVS9euWb76nvpSq2GxavBnUM6DU6tmspbi",
    rpcUrls: [
      "https://rpc.sonic.game",
      "https://sonic.drpc.org",
    ],
  },
  // Celo V3
  // Source: https://github.com/aave/protocol-subgraphs
  42220: {
    subgraphId: "GAVWZzGwQ6d6QbFojyFWxpZ2GB9Rf5hZgGyJHCEry8kn",
    rpcUrls: [
      "https://forno.celo.org",
      "https://celo.drpc.org",
    ],
  },
  // Soneium V3
  // Source: https://github.com/aave/protocol-subgraphs
  1868: {
    subgraphId: "5waxmqS3rkRtZPoV2mL5RCToupVxVbTd7hjicxMGebYm",
    rpcUrls: [
      "https://rpc.soneium.org",
    ],
  },
  // Ink V3
  // Source: https://github.com/aave/protocol-subgraphs
  57073: {
    subgraphId: "6AY9ccNwMwd3G27zp9vUKWCi9ugvNS6gkh5EEBY2xnPC",
    rpcUrls: [
      "https://rpc.ink.xyz",
    ],
  },
  // Plasma V3
  // Note: Not found in GitHub list, may not have deployed subgraph
  9745: {
    subgraphId: "", // Check: https://thegraph.com/explorer or Aave GitHub
    rpcUrls: [
      "https://rpc.plasma.dsolutions.build",
    ],
  },
};

// Special subgraph IDs for Ethereum markets
// Source: https://github.com/aave/protocol-subgraphs
const ETHEREUM_MARKET_SUBGRAPHS: Record<string, string> = {
  "ethereum-lido-v3": "5vxMbXRhG1oQr55MWC5j6qg78waWujx1wjeuEWDA6j3", // ETH Mainnet V3 Lido Market
  "ethereum-ether-fi-v3": "8o4HGApJkAqnvxAHShG4w5xiXihHyL7HkeDdQdRUYmqZ", // ETH Mainnet V3 Etherfi Market
};

const client = new GraphQLClient(env.AAVEKIT_GRAPHQL_URL, {
  headers: {
    "Content-Type": "application/json",
  },
});

async function queryChains(filter: "ALL" | "MAINNET_ONLY" | "TESTNET_ONLY" = "MAINNET_ONLY"): Promise<AaveKitChain[]> {
  const query = `
    query Chains($filter: ChainsFilter!) {
      chains(filter: $filter) {
        name
        chainId
        icon
        explorerUrl
        isTestnet
      }
    }
  `;

  const data = await client.request<{ chains: AaveKitChain[] }>(query, {
    filter,
  });
  return data.chains;
}

async function queryMarkets(chainIds: number[]): Promise<AaveKitMarket[]> {
  const query = `
    query Markets($request: MarketsRequest!) {
      markets(request: $request) {
        name
        address
        chain {
          chainId
          name
        }
      }
    }
  `;

  const data = await client.request<{ markets: AaveKitMarket[] }>(query, {
    request: {
      chainIds,
    },
  });
  return data.markets;
}

function generateMarketKey(marketName: string, chainName: string): string {
  // Extract a unique identifier from market name
  // Examples: 
  // "AaveV3Ethereum" -> "ethereum-v3"
  // "AaveV3EthereumEtherFi" -> "ethereum-etherfi-v3"
  // "AaveV3EthereumLido" -> "ethereum-lido-v3"
  
  // First, split camelCase/PascalCase into words before lowercasing
  let name = marketName
    .replace(/^AaveV3/, "") // Remove AaveV3 prefix
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen before capital letters
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  
  // If name is empty or just "ethereum", use chain name
  if (!name || name === "ethereum") {
    return chainName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-v3";
  }
  
  // Clean up multiple consecutive hyphens
  name = name.replace(/-+/g, "-").replace(/^-|-$/g, "");
  
  return name + "-v3";
}

function getSubgraphId(chainId: number, marketKey?: string): string {
  // Check for special Ethereum market subgraphs first
  if (marketKey && ETHEREUM_MARKET_SUBGRAPHS[marketKey]) {
    return ETHEREUM_MARKET_SUBGRAPHS[marketKey];
  }
  
  const config = CHAIN_CONFIG[chainId];
  if (!config || !config.subgraphId) {
    return "";
  }
  return config.subgraphId;
}

function getRpcUrls(chainId: number): string[] {
  const config = CHAIN_CONFIG[chainId];
  if (!config || !config.rpcUrls || config.rpcUrls.length === 0) {
    // Default RPC URLs based on common patterns
    const defaultRpcUrls: Record<number, string[]> = {
      42161: ["https://arb1.arbitrum.io/rpc"],
      10: ["https://mainnet.optimism.io"],
      137: ["https://polygon-rpc.com"],
      43114: ["https://api.avax.network/ext/bc/C/rpc"],
      8453: ["https://mainnet.base.org"],
      534352: ["https://rpc.scroll.io"],
      1088: ["https://andromeda.metis.io/?owner=1088"],
      56: ["https://bsc-dataseed1.binance.org"],
      100: ["https://rpc.gnosischain.com"],
      324: ["https://mainnet.era.zksync.io", "https://zksync.drpc.org"],
      146: ["https://rpc.sonic.game"],
      1868: ["https://rpc.soneium.org"],
      9745: ["https://rpc.plasma.dsolutions.build"],
      42220: ["https://forno.celo.org"],
      57073: ["https://rpc.ink.xyz"],
      59144: ["https://rpc.linea.build"],
    };
    return defaultRpcUrls[chainId] || [];
  }
  return config.rpcUrls;
}

async function main() {
  console.log("🔍 Fetching all Aave markets from AaveKit GraphQL API...\n");

  try {
    // Step 1: Get all mainnet chains
    console.log("📡 Fetching chains...");
    const chains = await queryChains("MAINNET_ONLY");
    console.log(`✓ Found ${chains.length} chains: ${chains.map(c => c.name).join(", ")}\n`);

    // Step 2: Get all markets
    console.log("📊 Fetching markets...");
    const chainIds = chains.map(c => c.chainId);
    const markets = await queryMarkets(chainIds);
    console.log(`✓ Found ${markets.length} markets\n`);

    // Step 3: Transform to MarketConfig format
    console.log("🔄 Transforming to MarketConfig format...");
    const marketConfigs: MarketConfig[] = markets.map((market) => {
      const chainId = market.chain.chainId;
      const marketKey = generateMarketKey(market.name, market.chain.name);
      
      return {
        marketKey,
        displayName: market.name || `${market.chain.name} V3`,
        poolAddress: market.address.toLowerCase(),
        subgraphId: getSubgraphId(chainId, marketKey),
        chainId,
        rpcUrls: getRpcUrls(chainId),
        url: `https://aavescan.com/markets/${marketKey}`,
      };
    });

    // Step 4: Sort by chainId for consistency
    marketConfigs.sort((a, b) => a.chainId - b.chainId);

    // Step 5: Display results
    console.log("\n📋 Markets found:\n");
    marketConfigs.forEach((market) => {
      console.log(`  ${market.displayName} (${market.marketKey})`);
      console.log(`    Chain ID: ${market.chainId}`);
      console.log(`    Pool: ${market.poolAddress}`);
      console.log(`    Subgraph: ${market.subgraphId || "⚠️  MISSING"}`);
      console.log(`    RPC URLs: ${market.rpcUrls.length} configured\n`);
    });

    // Step 6: Check for missing subgraph IDs
    const missingSubgraphs = marketConfigs.filter(m => !m.subgraphId);
    if (missingSubgraphs.length > 0) {
      console.log("⚠️  WARNING: Some markets are missing subgraph IDs:");
      missingSubgraphs.forEach(m => {
        console.log(`  - ${m.displayName} (chainId: ${m.chainId})`);
      });
      console.log("\n💡 You can find subgraph IDs at:");
      console.log("   https://thegraph.com/explorer/subgraphs?query=aave");
      console.log("   or check aavescan.com for each market\n");
    }

    // Step 7: Save to file
    const marketsPath = join(process.cwd(), "data", "markets.json");
    writeFileSync(marketsPath, JSON.stringify(marketConfigs, null, 2));
    console.log(`✅ Saved ${marketConfigs.length} markets to ${marketsPath}`);

  } catch (error) {
    console.error("❌ Error fetching markets:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      if ((error as any).response) {
        console.error("Response:", JSON.stringify((error as any).response, null, 2));
      }
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
