import { queryReservesAtBlock, queryPoolByAddress } from "@/lib/api/subgraph";
import { getBlockByTimestamp } from "@/lib/api/rpc";
import { getMarket } from "@/lib/utils/market";
import { normalizeAddress } from "@/lib/utils/address";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  calculateTotalSuppliedUSDFromSubgraph,
  calculateTotalBorrowedUSDFromSubgraph,
  priceFromSubgraphToUSD,
} from "@/lib/calculations/totals";
import { BigNumber } from "@/lib/utils/big-number";

export interface MarketTrendsDataPoint {
  date: string; // ISO date (YYYY-MM-DD)
  timestamp: number;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  availableLiquidityUSD: number;
}

export interface AssetChange {
  supplied: number; // USD change
  borrowed: number; // USD change
  suppliedPercent: number; // Percentage change
  borrowedPercent: number; // Percentage change
}

export interface AssetTrendsData {
  underlyingAsset: string;
  symbol: string;
  name: string;
  currentSuppliedUSD: number;
  currentBorrowedUSD: number;
  change1d: AssetChange | null;
  change7d: AssetChange | null;
  change30d: AssetChange | null;
}

export interface MarketTrendsResponse {
  marketKey: string;
  data: MarketTrendsDataPoint[];
  assetChanges: AssetTrendsData[];
  totals: {
    currentTotalSuppliedUSD: number;
    currentTotalBorrowedUSD: number;
    change1d: AssetChange | null;
    change7d: AssetChange | null;
    change30d: AssetChange | null;
  };
}

/**
 * Calculate market totals time series from daily snapshots
 */
export async function calculateMarketTrends(
  marketKey: string,
  window: "30d" | "6m" | "1y" = "30d"
): Promise<MarketTrendsResponse> {
  const market = getMarket(marketKey);
  if (!market) {
    throw new Error(`Market ${marketKey} not found`);
  }

  // Get pool entity ID
  const pool = await queryPoolByAddress(
    market.subgraphId,
    normalizeAddress(market.poolAddress)
  );
  if (!pool) {
    throw new Error(`Pool entity not found for market ${marketKey}`);
  }
  const poolEntityId = pool.id;

  // Calculate date range
  const now = new Date();
  const days = window === "30d" ? 30 : window === "6m" ? 180 : 365;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setUTCHours(23, 59, 59, 999); // End of day UTC

  // Get block numbers for date range
  // Note: getBlockByTimestamp uses env.ETH_RPC_URLS, not market.rpcUrls
  // This is acceptable as all markets on same chain share RPC
  const endBlockResult = await getBlockByTimestamp(Math.floor(now.getTime() / 1000));
  const endBlock = endBlockResult.blockNumber;
  const startBlockResult = await getBlockByTimestamp(
    Math.floor(startDate.getTime() / 1000)
  );
  const startBlock = startBlockResult.blockNumber;

  // Fetch daily snapshots for all reserves
  const dataPoints: MarketTrendsDataPoint[] = [];
  const assetSnapshots = new Map<
    string,
    Array<{ date: string; suppliedUSD: number; borrowedUSD: number }>
  >();

  // Get current reserves to know which assets to track
  const currentReserves = await queryReservesAtBlock(
    market.subgraphId,
    poolEntityId,
    endBlock
  );

  // For each day, aggregate totals
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setUTCHours(23, 59, 59, 999);

    const timestamp = Math.floor(date.getTime() / 1000);
    const blockResult = await getBlockByTimestamp(timestamp);
    const blockNumber = blockResult.blockNumber;

    try {
      const reserves = await queryReservesAtBlock(
        market.subgraphId,
        poolEntityId,
        blockNumber
      );

      let totalSuppliedUSD = 0;
      let totalBorrowedUSD = 0;
      let availableLiquidityUSD = 0;

      for (const reserve of reserves) {
        const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
        const priceUSD = priceFromSubgraphToUSD(reserve.price.priceInEth, reserve.symbol);
        const decimals = reserve.decimals;

        // Subgraph returns on-chain format, so use FromSubgraph functions
        const suppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
          reserve.totalATokenSupply,
          decimals,
          priceUSD
        );
        const borrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
          reserve.totalCurrentVariableDebt,
          decimals,
          priceUSD
        );
        const availableUSD =
          new BigNumber(reserve.availableLiquidity)
            .div(new BigNumber(10).pow(decimals))
            .times(priceUSD)
            .toNumber();

        totalSuppliedUSD += suppliedUSD;
        totalBorrowedUSD += borrowedUSD;
        availableLiquidityUSD += availableUSD;
        
        // Validate: totalSupplied should equal availableLiquidity + borrowed (with small tolerance for rounding)
        const calculatedAvailable = suppliedUSD - borrowedUSD;
        const diff = Math.abs(availableUSD - calculatedAvailable);
        if (diff > 0.01) { // Allow 1 cent tolerance for rounding errors
          console.warn(
            `[calculateMarketTrends] Available liquidity mismatch for ${reserve.symbol}: ` +
            `direct=${availableUSD}, calculated=${calculatedAvailable}, diff=${diff}`
          );
        }

        // Track per-asset snapshots
        if (!assetSnapshots.has(normalizedAddress)) {
          assetSnapshots.set(normalizedAddress, []);
        }
        assetSnapshots.get(normalizedAddress)!.push({
          date: date.toISOString().split("T")[0],
          suppliedUSD,
          borrowedUSD,
        });
      }

      // Ensure data consistency: availableLiquidity should equal totalSupplied - totalBorrowed
      // Use calculated value to avoid rounding errors from summing individual reserves
      const calculatedAvailableLiquidity = totalSuppliedUSD - totalBorrowedUSD;
      
      // Use the more accurate calculated value, but log if there's a significant difference
      if (Math.abs(availableLiquidityUSD - calculatedAvailableLiquidity) > 100) {
        console.warn(
          `[calculateMarketTrends] Significant difference in available liquidity for ${date.toISOString()}: ` +
          `summed=${availableLiquidityUSD}, calculated=${calculatedAvailableLiquidity}`
        );
      }
      
      dataPoints.push({
        date: date.toISOString().split("T")[0],
        timestamp,
        totalSuppliedUSD,
        totalBorrowedUSD,
        availableLiquidityUSD: calculatedAvailableLiquidity, // Use calculated value for consistency
      });
    } catch (error) {
      console.warn(`Failed to get snapshot for ${date.toISOString()}:`, error);
      // Continue with next date
    }
  }

  // Calculate asset changes (1d, 7d, 30d)
  const assetChanges: AssetTrendsData[] = [];
  for (const reserve of currentReserves) {
    const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
    const snapshots = assetSnapshots.get(normalizedAddress) || [];
    if (snapshots.length === 0) continue;

    const current = snapshots[snapshots.length - 1];
    const priceUSD = priceFromSubgraphToUSD(reserve.price.priceInEth, reserve.symbol);
    const decimals = reserve.decimals;

    // Subgraph returns on-chain format, so use FromSubgraph functions
    const currentSuppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
      reserve.totalATokenSupply,
      decimals,
      priceUSD
    );
    const currentBorrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
      reserve.totalCurrentVariableDebt,
      decimals,
      priceUSD
    );

    // Find snapshots for 1d, 7d, 30d ago
    const nowDate = new Date();
    const date1d = new Date(nowDate);
    date1d.setDate(date1d.getDate() - 1);
    const date7d = new Date(nowDate);
    date7d.setDate(date7d.getDate() - 7);
    const date30d = new Date(nowDate);
    date30d.setDate(date30d.getDate() - 30);

    const findSnapshot = (targetDate: Date) => {
      const targetDateStr = targetDate.toISOString().split("T")[0];
      return snapshots.find((s) => s.date === targetDateStr);
    };

    const snapshot1d = findSnapshot(date1d);
    const snapshot7d = findSnapshot(date7d);
    const snapshot30d = findSnapshot(date30d);

    const calculateChange = (
      old: { suppliedUSD: number; borrowedUSD: number } | undefined
    ): AssetChange | null => {
      if (!old) return null;

      const suppliedChange = currentSuppliedUSD - old.suppliedUSD;
      const borrowedChange = currentBorrowedUSD - old.borrowedUSD;
      const suppliedPercent =
        old.suppliedUSD === 0
          ? 0
          : (suppliedChange / old.suppliedUSD) * 100;
      const borrowedPercent =
        old.borrowedUSD === 0 ? 0 : (borrowedChange / old.borrowedUSD) * 100;

      return {
        supplied: suppliedChange,
        borrowed: borrowedChange,
        suppliedPercent,
        borrowedPercent,
      };
    };

    assetChanges.push({
      underlyingAsset: normalizedAddress,
      symbol: reserve.symbol,
      name: reserve.name,
      currentSuppliedUSD,
      currentBorrowedUSD,
      change1d: calculateChange(snapshot1d),
      change7d: calculateChange(snapshot7d),
      change30d: calculateChange(snapshot30d),
    });
  }

  // Calculate market totals changes
  if (dataPoints.length === 0) {
    throw new Error("No data points available");
  }

  const currentTotal = dataPoints[dataPoints.length - 1];
  const total1d =
    dataPoints.length > 1 ? dataPoints[dataPoints.length - 2] : null;
  const total7d =
    dataPoints.length > 7 ? dataPoints[dataPoints.length - 8] : null;
  const total30d =
    dataPoints.length > 30 ? dataPoints[dataPoints.length - 31] : null;

  const calculateTotalChange = (
    old: MarketTrendsDataPoint | null
  ): AssetChange | null => {
    if (!old) return null;

    const suppliedChange = currentTotal.totalSuppliedUSD - old.totalSuppliedUSD;
    const borrowedChange = currentTotal.totalBorrowedUSD - old.totalBorrowedUSD;
    const suppliedPercent =
      old.totalSuppliedUSD === 0
        ? 0
        : (suppliedChange / old.totalSuppliedUSD) * 100;
    const borrowedPercent =
      old.totalBorrowedUSD === 0
        ? 0
        : (borrowedChange / old.totalBorrowedUSD) * 100;

    return {
      supplied: suppliedChange,
      borrowed: borrowedChange,
      suppliedPercent,
      borrowedPercent,
    };
  };

  return {
    marketKey,
    data: dataPoints,
    assetChanges,
    totals: {
      currentTotalSuppliedUSD: currentTotal.totalSuppliedUSD,
      currentTotalBorrowedUSD: currentTotal.totalBorrowedUSD,
      change1d: calculateTotalChange(total1d),
      change7d: calculateTotalChange(total7d),
      change30d: calculateTotalChange(total30d),
    },
  };
}
