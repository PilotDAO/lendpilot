import { GraphQLClient } from "graphql-request";
import { env } from "@/lib/config/env";

const getSubgraphUrl = (subgraphId: string): string => {
  // Use process.env directly to avoid caching issues
  const apiKey = process.env.GRAPH_API_KEY || env.GRAPH_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GRAPH_API_KEY is not set. Please set it in .env.local");
  }
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
};

// Create GraphQL client
// Note: GraphQLClient doesn't support timeout in config, we'll use Promise.race wrapper
function createSubgraphClient(subgraphId: string) {
  const url = getSubgraphUrl(subgraphId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  // The Graph Gateway uses API key in URL, but also supports Authorization header
  // Using both for maximum compatibility
  const apiKey = process.env.GRAPH_API_KEY || env.GRAPH_API_KEY;
  if (apiKey && apiKey.trim() !== "") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  return new GraphQLClient(url, {
    headers,
  });
}

// Wrapper for GraphQL requests with timeout
async function requestWithTimeout<T>(
  client: GraphQLClient,
  query: string,
  variables: Record<string, unknown>,
  timeout: number = 15000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
  });

  return Promise.race([
    client.request<T>(query, variables),
    timeoutPromise,
  ]);
}

export interface SubgraphPool {
  id: string; // Pool entity ID (not pool address)
  pool: string; // Pool contract address
}

export interface SubgraphReserve {
  underlyingAsset: string;
  symbol: string;
  name: string;
  decimals: number;
  totalATokenSupply: string;
  availableLiquidity: string;
  totalCurrentVariableDebt: string;
  totalPrincipalStableDebt: string;
  liquidityIndex: string;
  variableBorrowIndex: string;
  liquidityRate: string;
  variableBorrowRate: string;
  price: {
    priceInEth: string;
  };
}

export async function queryPoolByAddress(
  subgraphId: string,
  poolAddress: string,
  timeout: number = 15000
): Promise<SubgraphPool | null> {
  const client = createSubgraphClient(subgraphId);
  const query = `
    query PoolByAddress($poolAddress: String!) {
      pools(where: { pool: $poolAddress }, first: 1) {
        id
        pool
      }
    }
  `;

  const data = await requestWithTimeout<{ pools: SubgraphPool[] }>(
    client,
    query,
    {
      poolAddress: poolAddress.toLowerCase(),
    },
    timeout
  );

  return data.pools[0] || null;
}

export async function queryReservesAtBlock(
  subgraphId: string,
  poolEntityId: string,
  blockNumber: number,
  timeout: number = 15000
): Promise<SubgraphReserve[]> {
  const client = createSubgraphClient(subgraphId);
  const query = `
    query ReservesAtBlock($poolId: ID!, $block: Block_height!) {
      reserves(where: { pool: $poolId }, block: $block) {
        underlyingAsset
        symbol
        name
        decimals
        totalATokenSupply
        availableLiquidity
        totalCurrentVariableDebt
        totalPrincipalStableDebt
        liquidityIndex
        variableBorrowIndex
        liquidityRate
        variableBorrowRate
        price {
          priceInEth
        }
      }
    }
  `;

  const data = await requestWithTimeout<{
    reserves: SubgraphReserve[];
  }>(
    client,
    query,
    {
      poolId: poolEntityId,
      block: { number: blockNumber },
    },
    timeout
  );

  return data.reserves || [];
}

export async function queryReserveAtBlock(
  subgraphId: string,
  poolEntityId: string,
  underlyingAsset: string,
  blockNumber: number,
  timeout: number = 15000
): Promise<SubgraphReserve | null> {
  const reserves = await queryReservesAtBlock(subgraphId, poolEntityId, blockNumber, timeout);
  return (
    reserves.find(
      (r) => r.underlyingAsset.toLowerCase() === underlyingAsset.toLowerCase()
    ) || null
  );
}
