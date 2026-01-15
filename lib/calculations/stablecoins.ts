import { loadStablecoins } from "@/lib/data/stablecoins";
import { loadMarkets } from "@/lib/utils/market";
import { getMarketReservesFromDB } from "@/lib/api/db-market-data";
import { normalizeAddress } from "@/lib/utils/address";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  priceToUSD,
} from "@/lib/calculations/totals";
import { BigNumber } from "@/lib/utils/big-number";

export interface StablecoinData {
  symbol: string;
  address: string;
  marketKey: string;
  marketName: string;
  suppliedTokens: string;
  borrowedTokens: string;
  availableLiquidity: string;
  supplyAPR: number;
  borrowAPR: number;
  utilizationRate: number;
  oraclePrice: number;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  imageUrl?: string;
  name: string;
  decimals: number;
}

export interface AggregatedStablecoinData {
  symbol: string;
  address: string;
  markets: Array<{
    marketKey: string;
    marketName: string;
    suppliedTokens: string;
    borrowedTokens: string;
    supplyAPR: number;
    borrowAPR: number;
    utilizationRate: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
  }>;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  imageUrl?: string;
  name: string;
  decimals: number;
}

/**
 * Aggregate stablecoin data across all markets
 */
export async function aggregateStablecoinsData(): Promise<
  AggregatedStablecoinData[]
> {
  const stablecoins = loadStablecoins();
  const markets = loadMarkets();

  // Group stablecoins by symbol/address (same stablecoin can be in multiple markets)
  const stablecoinMap = new Map<string, AggregatedStablecoinData>();

  // For each stablecoin, fetch data from all its markets
  for (const stablecoin of stablecoins) {
    const normalizedAddress = normalizeAddress(stablecoin.address);
    const key = `${stablecoin.symbol}-${normalizedAddress}`;

    // Initialize aggregated data if not exists
    if (!stablecoinMap.has(key)) {
      stablecoinMap.set(key, {
        symbol: stablecoin.symbol,
        address: normalizedAddress,
        markets: [],
        totalSuppliedUSD: 0,
        totalBorrowedUSD: 0,
        name: "",
        decimals: 18,
      });
    }

    const aggregated = stablecoinMap.get(key)!;

    // Fetch data from each market
    for (const marketKey of stablecoin.markets) {
      const market = markets.find((m) => m.marketKey === marketKey);
      if (!market) {
        console.warn(`Market ${marketKey} not found for stablecoin ${stablecoin.symbol}`);
        continue;
      }

      try {
        // Fetch reserves from database (collected from AaveKit API via daily cron)
        // This avoids Cloudflare blocking and uses cached data
        const reserves = await getMarketReservesFromDB(marketKey);

        // Find the stablecoin reserve
        const reserve = reserves.find(
          (r) => normalizeAddress(r.underlyingAsset) === normalizedAddress
        );

        if (!reserve) {
          console.warn(
            `Stablecoin ${stablecoin.symbol} not found in market ${marketKey}`
          );
          continue;
        }

        // Use data from currentState (already calculated in DB)
        const currentState = reserve.currentState;
        const decimals = reserve.decimals;
        const priceUSD = currentState.oraclePrice;

        const suppliedTokens = new BigNumber(currentState.suppliedTokens);
        const borrowedTokens = new BigNumber(currentState.borrowedTokens);
        const availableLiquidity = new BigNumber(currentState.availableLiquidity);

        const totalSuppliedUSD = currentState.totalSuppliedUSD;
        const totalBorrowedUSD = currentState.totalBorrowedUSD;

        // Use utilization rate from currentState
        const utilizationRate = currentState.utilizationRate;

        // Use APR from currentState (already in decimal format)
        const supplyAPR = currentState.supplyAPR;
        const borrowAPR = currentState.borrowAPR;

        // Update aggregated data
        aggregated.markets.push({
          marketKey,
          marketName: market.displayName,
          suppliedTokens: suppliedTokens.toString(),
          borrowedTokens: borrowedTokens.toString(),
          supplyAPR,
          borrowAPR,
          utilizationRate,
          totalSuppliedUSD,
          totalBorrowedUSD,
        });

        aggregated.totalSuppliedUSD += totalSuppliedUSD;
        aggregated.totalBorrowedUSD += totalBorrowedUSD;

        // Set metadata from first market
        if (!aggregated.name) {
          aggregated.name = reserve.name;
          aggregated.decimals = decimals;
          aggregated.imageUrl = reserve.imageUrl;
        }
      } catch (error) {
        console.error(
          `Error fetching stablecoin ${stablecoin.symbol} from market ${marketKey}:`,
          error
        );
        // Continue with other markets
      }
    }
  }

  return Array.from(stablecoinMap.values());
}
