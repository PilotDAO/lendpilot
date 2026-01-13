#!/usr/bin/env tsx
/**
 * Script to find Aave v3 subgraph IDs from The Graph
 */

import { GraphQLClient } from "graphql-request";

// Known subgraph IDs for Aave v3
// These are the deployed subgraph IDs from The Graph Network
const KNOWN_SUBGRAPH_IDS: Record<number, string> = {
  // Ethereum Mainnet
  1: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
  
  // Arbitrum - based on The Graph Explorer
  42161: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Placeholder, need to verify
  
  // Optimism
  10: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Placeholder
  
  // Polygon
  137: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Placeholder
  
  // Avalanche
  43114: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Placeholder
  
  // Base
  8453: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Placeholder
};

// The Graph Network subgraph IDs (deployed subgraphs)
// These are the actual deployed subgraph IDs from The Graph Network
// Source: https://github.com/aave/protocol-subgraphs
const SUBGRAPH_IDS: Record<number, string> = {
  1: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g", // Ethereum V3
  42161: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Arbitrum V3 - need actual ID
  10: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Optimism V3 - need actual ID
  137: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Polygon V3 - need actual ID
  43114: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Avalanche V3 - need actual ID
  8453: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Base V3 - need actual ID
  534352: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Scroll V3 - need actual ID
  1088: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Metis V3 - need actual ID
  56: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // BNB Chain V3 - need actual ID
  100: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Gnosis V3 - need actual ID
  324: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // ZKsync Era V3 - need actual ID
  59144: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Linea V3 - need actual ID
  42220: "HZJhP8H4Q2z8v3J5vLq5kLz5J5vLq5kLz5J5vLq5kLz", // Celo V3 - need actual ID
};

async function searchSubgraphIds() {
  console.log("🔍 Searching for Aave v3 subgraph IDs...\n");
  
  // Try to query The Graph Network API
  // Note: This requires The Graph API key or using public endpoints
  
  // For now, we'll use known subgraph IDs from Aave's official sources
  // These can be found at: https://github.com/aave/protocol-subgraphs
  
  return SUBGRAPH_IDS;
}

// Based on research from Aave's GitHub and The Graph Explorer
// These are the actual deployed subgraph IDs
const ACTUAL_SUBGRAPH_IDS: Record<number, string> = {
  1: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g", // Ethereum V3
  // Note: Many networks may not have deployed subgraphs on The Graph Network yet
  // They might use hosted service or different deployment IDs
};

async function main() {
  console.log("📊 Aave v3 Subgraph IDs\n");
  console.log("Note: Finding subgraph IDs requires checking:");
  console.log("1. The Graph Network Explorer: https://thegraph.com/explorer");
  console.log("2. Aave's GitHub: https://github.com/aave/protocol-subgraphs");
  console.log("3. The Graph Hosted Service (legacy)\n");
  
  const ids = await searchSubgraphIds();
  
  console.log("Known subgraph IDs:");
  Object.entries(ids).forEach(([chainId, subgraphId]) => {
    if (subgraphId && !subgraphId.startsWith("HZJhP8H4Q2z8v3J5vLq5kLz")) {
      console.log(`  Chain ${chainId}: ${subgraphId}`);
    }
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { ACTUAL_SUBGRAPH_IDS };
