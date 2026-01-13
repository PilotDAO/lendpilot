import { GraphQLClient } from "graphql-request";
import { env } from "@/lib/config/env";
import { getMarket } from "@/lib/utils/market";

// Create GraphQL client
// Note: GraphQLClient supports timeout via request options, not client config
const client = new GraphQLClient(env.AAVEKIT_GRAPHQL_URL, {
  headers: {
    "Content-Type": "application/json",
  },
});

export interface AaveKitMarket {
  id: string;
  name: string;
  poolAddress: string;
}

export interface AaveKitChain {
  name: string;
  chainId: number;
  icon: string;
  explorerUrl: string;
  isTestnet: boolean;
}

export interface AaveKitReserve {
  underlyingAsset: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl?: string;
  currentLiquidityRate: string;
  currentVariableBorrowRate: string;
  totalATokenSupply: string;
  totalCurrentVariableDebt: string;
  availableLiquidity: string;
  liquidityIndex: string;
  variableBorrowIndex: string;
  price: {
    priceInEth: string;
  };
  lastUpdateTimestamp: number;
  // Reserve parameters for liquidity impact calculations
  optimalUsageRate?: string;
  baseVariableBorrowRate?: string;
  variableRateSlope1?: string;
  variableRateSlope2?: string;
  reserveFactor?: string;
}

export async function queryChains(filter: "ALL" | "MAINNET_ONLY" | "TESTNET_ONLY" = "MAINNET_ONLY"): Promise<AaveKitChain[]> {
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

export async function queryMarkets(chainIds?: number[]): Promise<AaveKitMarket[]> {
  // If no chainIds provided, get all mainnet chains first
  let targetChainIds = chainIds;
  if (!targetChainIds || targetChainIds.length === 0) {
    const chains = await queryChains("MAINNET_ONLY");
    targetChainIds = chains.map(c => c.chainId);
  }

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

  const data = await client.request<{ markets: Array<{
    name: string;
    address: string;
    chain: {
      chainId: number;
      name: string;
    };
  }> }>(query, {
    request: {
      chainIds: targetChainIds,
    },
  });
  
  return data.markets.map(m => ({
    id: `${m.chain.name.toLowerCase().replace(/\s+/g, "-")}-v3`,
    name: m.name,
    poolAddress: m.address,
  }));
}

export async function queryMarket(marketKey: string): Promise<AaveKitMarket | null> {
  const markets = await queryMarkets();
  return markets.find((m) => m.id === marketKey) || null;
}

export async function queryReserves(marketKey: string): Promise<AaveKitReserve[]> {
  // Get market config to get poolAddress and chainId
  const market = getMarket(marketKey);
  if (!market) {
    throw new Error(`Market ${marketKey} not found`);
  }

  const query = `
    query Reserves($request: MarketRequest!) {
      market(request: $request) {
        reserves {
          underlyingToken {
            address
            symbol
            name
            decimals
            imageUrl
          }
          supplyInfo {
            apy {
              value
            }
            total {
              value
            }
          }
          borrowInfo {
            apy {
              value
            }
            total {
              amount {
                value
              }
            }
            availableLiquidity {
              amount {
                value
              }
            }
          }
          size {
            amount {
              value
            }
          }
          usdExchangeRate
        }
      }
    }
  `;

  const data = await client.request<{
    market: { reserves: Array<{
      underlyingToken: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        imageUrl?: string;
      };
      supplyInfo: {
        apy: { value: string };
        total: { value: string };
      };
      borrowInfo: {
        apy: { value: string };
        total: { amount: { value: string } };
        availableLiquidity: { amount: { value: string } };
      } | null;
      size: {
        amount: { value: string };
      };
      usdExchangeRate: string;
    }> } | null;
  }>(query, {
    request: {
      address: market.poolAddress,
      chainId: market.chainId,
    },
  });

  if (!data.market) {
    return [];
  }

  // Transform to AaveKitReserve format
  return data.market.reserves.map((r) => ({
    underlyingAsset: r.underlyingToken.address,
    symbol: r.underlyingToken.symbol,
    name: r.underlyingToken.name,
    decimals: r.underlyingToken.decimals,
    imageUrl: r.underlyingToken.imageUrl,
    currentLiquidityRate: r.supplyInfo.apy.value,
    currentVariableBorrowRate: r.borrowInfo?.apy.value || "0",
    totalATokenSupply: r.supplyInfo.total.value,
    totalCurrentVariableDebt: r.borrowInfo?.total.amount.value || "0",
    availableLiquidity: r.borrowInfo?.availableLiquidity.amount.value || r.size.amount.value,
    liquidityIndex: "0", // Not available in new schema
    variableBorrowIndex: "0", // Not available in new schema
    price: {
      priceInEth: r.usdExchangeRate,
    },
    lastUpdateTimestamp: 0, // Not available in new schema
  }));
}

export async function queryReserve(
  marketKey: string,
  underlyingAsset: string
): Promise<AaveKitReserve | null> {
  // Get market config to get poolAddress and chainId
  const market = getMarket(marketKey);
  if (!market) {
    throw new Error(`Market ${marketKey} not found`);
  }

  // First, get basic reserve info from queryReserves
  const reserves = await queryReserves(marketKey);
  const basicReserve = reserves.find(
    (r) => r.underlyingAsset.toLowerCase() === underlyingAsset.toLowerCase()
  );

  if (!basicReserve) {
    return null;
  }

  // Then, query reserve parameters separately
  // Note: Parameters are in borrowInfo, not directly in Reserve
  const paramsQuery = `
    query ReserveParams($reserveRequest: ReserveRequest!) {
      reserve(request: $reserveRequest) {
        borrowInfo {
          optimalUsageRate {
            value
          }
          baseVariableBorrowRate {
            value
          }
          variableRateSlope1 {
            value
          }
          variableRateSlope2 {
            value
          }
          reserveFactor {
            value
          }
        }
      }
    }
  `;

  try {
    const paramsData = await client.request<{
      reserve: {
        borrowInfo: {
          optimalUsageRate: { value: string };
          baseVariableBorrowRate: { value: string };
          variableRateSlope1: { value: string };
          variableRateSlope2: { value: string };
          reserveFactor: { value: string };
        } | null;
      } | null;
    }>(paramsQuery, {
      reserveRequest: {
        market: market.poolAddress,
        underlyingToken: underlyingAsset,
        chainId: market.chainId,
      },
    });

    if (paramsData.reserve?.borrowInfo) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[queryReserve] Successfully fetched reserve parameters for ${underlyingAsset}:`, {
          optimalUsageRate: paramsData.reserve.borrowInfo.optimalUsageRate.value,
          baseVariableBorrowRate: paramsData.reserve.borrowInfo.baseVariableBorrowRate.value,
          variableRateSlope1: paramsData.reserve.borrowInfo.variableRateSlope1.value,
          variableRateSlope2: paramsData.reserve.borrowInfo.variableRateSlope2.value,
          reserveFactor: paramsData.reserve.borrowInfo.reserveFactor.value,
        });
      }
      return {
        ...basicReserve,
        optimalUsageRate: paramsData.reserve.borrowInfo.optimalUsageRate.value,
        baseVariableBorrowRate: paramsData.reserve.borrowInfo.baseVariableBorrowRate.value,
        variableRateSlope1: paramsData.reserve.borrowInfo.variableRateSlope1.value,
        variableRateSlope2: paramsData.reserve.borrowInfo.variableRateSlope2.value,
        reserveFactor: paramsData.reserve.borrowInfo.reserveFactor.value,
      };
    } else {
      console.warn(`[queryReserve] Reserve or borrowInfo not found for ${underlyingAsset}`);
    }
  } catch (error: any) {
    // Log detailed error information only in development
    if (process.env.NODE_ENV === 'development') {
      if (error?.response?.errors) {
        console.error(`[queryReserve] GraphQL errors for ${underlyingAsset}:`, JSON.stringify(error.response.errors, null, 2));
      }
      if (error?.response?.data) {
        console.error(`[queryReserve] GraphQL data for ${underlyingAsset}:`, JSON.stringify(error.response.data, null, 2));
      }
      console.error(`[queryReserve] Failed to fetch reserve parameters for ${underlyingAsset}:`, error.message || error);
    } else {
      console.warn(`[queryReserve] Failed to fetch reserve parameters for ${underlyingAsset}, using defaults`);
    }
    // Return basic reserve without parameters (will use defaults)
  }

  return basicReserve;
}
