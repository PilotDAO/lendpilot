import { prisma } from "@/lib/db/prisma";
import { normalizeAddress } from "@/lib/utils/address";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  calculateMarketTotals,
  priceToUSD,
} from "@/lib/calculations/totals";
import { BigNumber } from "@/lib/utils/big-number";
import { getDataSourceForMarket } from "@/lib/utils/data-source";

export interface Reserve {
  underlyingAsset: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl?: string;
  currentState: {
    suppliedTokens: string;
    borrowedTokens: string;
    availableLiquidity: string;
    supplyAPR: number;
    borrowAPR: number;
    utilizationRate: number;
    oraclePrice: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
  };
  // Reserve parameters for liquidity impact calculations
  optimalUsageRate?: string;
  baseVariableBorrowRate?: string;
  variableRateSlope1?: string;
  variableRateSlope2?: string;
  reserveFactor?: string;
}

/**
 * Get market reserves from database (latest snapshot)
 * All markets now store current data from AaveKit API in DB
 */
export async function getMarketReservesFromDB(marketKey: string): Promise<Reserve[]> {
  // Get the latest snapshot from database
  const latestSnapshot = await prisma.aaveKitRawSnapshot.findFirst({
    where: {
      marketKey,
      dataSource: 'aavekit',
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (!latestSnapshot) {
    // Temporary fallback for ethereum-v3 if no data in DB (until cron collects it)
    // This is needed because Cloudflare blocks direct API calls from server
    if (marketKey === 'ethereum-v3') {
      console.warn(`⚠️  No DB data for ${marketKey}, this is expected until cron job collects it.`);
      throw new Error(`No data found in database for market ${marketKey}. Data will be available after cron job runs.`);
    }
    throw new Error(`No data found in database for market ${marketKey}. Please run data sync.`);
  }

  const reserves = latestSnapshot.rawData as any[];
  
  if (!reserves || !Array.isArray(reserves) || reserves.length === 0) {
    throw new Error(`Invalid or empty data in database for market ${marketKey}`);
  }

  // Transform to Reserve format (same as AaveKit format)
  return reserves.map((r) => {
    const normalizedAddress = normalizeAddress(r.underlyingAsset);
    const priceUSD = priceToUSD(r.price.priceInEth, r.symbol, normalizedAddress);
    const decimals = r.decimals;

    const suppliedTokens = new BigNumber(r.totalATokenSupply);
    const borrowedTokens = new BigNumber(r.totalCurrentVariableDebt);
    const availableLiquidity = new BigNumber(r.availableLiquidity);

    const totalSuppliedUSD = calculateTotalSuppliedUSD(
      r.totalATokenSupply,
      decimals,
      priceUSD
    );
    const totalBorrowedUSD = calculateTotalBorrowedUSD(
      r.totalCurrentVariableDebt,
      decimals,
      priceUSD
    );

    // Calculate utilization
    const utilizationRate =
      borrowedTokens.plus(availableLiquidity).eq(0)
        ? 0
        : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();

    // AaveKit returns APY as decimal (e.g., 0.05 = 5%)
    const supplyAPR = new BigNumber(r.currentLiquidityRate).toNumber();
    const borrowAPR = r.currentVariableBorrowRate !== "0"
      ? new BigNumber(r.currentVariableBorrowRate).toNumber()
      : 0;

    return {
      underlyingAsset: normalizedAddress,
      symbol: r.symbol,
      name: r.name,
      decimals,
      imageUrl: r.imageUrl,
      currentState: {
        suppliedTokens: suppliedTokens.toString(),
        borrowedTokens: borrowedTokens.toString(),
        availableLiquidity: availableLiquidity.toString(),
        supplyAPR,
        borrowAPR,
        utilizationRate,
        oraclePrice: priceUSD,
        totalSuppliedUSD,
        totalBorrowedUSD,
      },
      // Include reserve parameters if available in DB
      optimalUsageRate: r.optimalUsageRate,
      baseVariableBorrowRate: r.baseVariableBorrowRate,
      variableRateSlope1: r.variableRateSlope1,
      variableRateSlope2: r.variableRateSlope2,
      reserveFactor: r.reserveFactor,
    };
  });
}

/**
 * Get single reserve from database (latest snapshot)
 * All markets now store current data from AaveKit API in DB
 * 
 * Uses caching to reduce DB load when multiple requests for the same reserve occur
 */
// Cache for reserves (by marketKey + underlyingAsset)
const reserveCache = new Map<string, { reserve: Reserve; timestamp: number }>();
const RESERVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getReserveFromDB(
  marketKey: string,
  underlyingAsset: string
): Promise<Reserve | null> {
  const normalizedAddress = normalizeAddress(underlyingAsset);
  const cacheKey = `${marketKey}:${normalizedAddress}`;
  
  // Check cache first
  const cached = reserveCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RESERVE_CACHE_TTL_MS) {
    return cached.reserve;
  }
  
  // Get the latest snapshot from database
  const latestSnapshot = await prisma.aaveKitRawSnapshot.findFirst({
    where: {
      marketKey,
      dataSource: 'aavekit',
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (!latestSnapshot) {
    throw new Error(`No data found in database for market ${marketKey}. Please run data sync.`);
  }

  const reserves = latestSnapshot.rawData as any[];
  
  if (!reserves || !Array.isArray(reserves)) {
    throw new Error(`Invalid data in database for market ${marketKey}`);
  }

  // Find the specific reserve
  const reserve = reserves.find(
    (r) => normalizeAddress(r.underlyingAsset) === normalizedAddress
  );

  if (!reserve) {
    return null;
  }

  // Transform to Reserve format
  const priceUSD = priceToUSD(reserve.price.priceInEth, reserve.symbol, normalizedAddress);
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

  const utilizationRate =
    borrowedTokens.plus(availableLiquidity).eq(0)
      ? 0
      : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();

  const supplyAPR = new BigNumber(reserve.currentLiquidityRate).toNumber();
  const borrowAPR = reserve.currentVariableBorrowRate !== "0"
    ? new BigNumber(reserve.currentVariableBorrowRate).toNumber()
    : 0;

  const result: Reserve = {
    underlyingAsset: normalizedAddress,
    symbol: reserve.symbol,
    name: reserve.name,
    decimals,
    imageUrl: reserve.imageUrl,
    currentState: {
      suppliedTokens: suppliedTokens.toString(),
      borrowedTokens: borrowedTokens.toString(),
      availableLiquidity: availableLiquidity.toString(),
      supplyAPR,
      borrowAPR,
      utilizationRate,
      oraclePrice: priceUSD,
      totalSuppliedUSD,
      totalBorrowedUSD,
    },
    // Include reserve parameters if available in DB
    optimalUsageRate: reserve.optimalUsageRate,
    baseVariableBorrowRate: reserve.baseVariableBorrowRate,
    variableRateSlope1: reserve.variableRateSlope1,
    variableRateSlope2: reserve.variableRateSlope2,
    reserveFactor: reserve.reserveFactor,
  };

  // Cache the result
  reserveCache.set(cacheKey, {
    reserve: result,
    timestamp: Date.now(),
  });

  return result;
}
