import { loadStablecoins } from "@/lib/data/stablecoins";
import { loadMarkets } from "@/lib/utils/market";
import { queryReserves } from "@/lib/api/aavekit";
import { normalizeAddress } from "@/lib/utils/address";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  priceToUSD,
} from "@/lib/calculations/totals";
import { BigNumber } from "@/lib/utils/big-number";
import { withRetry } from "@/lib/utils/retry";

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
        // Fetch reserves for this market
        const reserves = await withRetry(
          () => queryReserves(marketKey),
          {
            onRetry: (attempt, error) => {
              console.warn(
                `Retry ${attempt} for stablecoin ${stablecoin.symbol} in market ${marketKey}:`,
                error.message
              );
            },
          }
        );

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

        // Transform reserve data
        const priceUSD = priceToUSD(
          reserve.price.priceInEth,
          reserve.symbol,
          normalizedAddress
        );
        const decimals = reserve.decimals;

        const suppliedTokens = new BigNumber(reserve.totalATokenSupply);
        const borrowedTokens = new BigNumber(reserve.totalCurrentVariableDebt);
        const availableLiquidity = new BigNumber(reserve.availableLiquidity);

        const totalSuppliedUSD = calculateTotalSuppliedUSD(
          reserve.totalATokenSupply,
          decimals,
          priceUSD
        );
        const totalBorrowedUSD = calculateTotalBorrowedUSD(
          reserve.totalCurrentVariableDebt,
          decimals,
          priceUSD
        );

        // Calculate utilization
        const utilizationRate =
          borrowedTokens.plus(availableLiquidity).eq(0)
            ? 0
            : borrowedTokens
                .div(borrowedTokens.plus(availableLiquidity))
                .toNumber();

        // AaveKit returns APY as decimal (e.g., 0.05 = 5%)
        // PercentValue.value is normalized (1.0 = 100%), so use directly
        const supplyAPR = new BigNumber(reserve.currentLiquidityRate).toNumber();
        const borrowAPR = reserve.currentVariableBorrowRate !== "0"
          ? new BigNumber(reserve.currentVariableBorrowRate).toNumber()
          : 0;

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
