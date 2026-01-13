import { NextRequest, NextResponse } from "next/server";
import { queryReserves } from "@/lib/api/aavekit";
import { normalizeAddress } from "@/lib/utils/address";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  calculateMarketTotals,
  priceToUSD,
} from "@/lib/calculations/totals";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { withRetry } from "@/lib/utils/retry";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { BigNumber } from "@/lib/utils/big-number";

interface Reserve {
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
}

export async function GET(
  request: NextRequest,
  { params }: { params: { marketKey: string } }
) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(100, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { marketKey } = params;

  // Validate market key
  if (!validateMarketKey(marketKey)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_MARKET, "Invalid market key"),
      { status: 404 }
    );
  }

  const market = getMarket(marketKey);
  if (!market) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.MARKET_NOT_FOUND, "Market not found"),
      { status: 404 }
    );
  }

  // Check cache
  const cacheKey = `market:${marketKey}`;
  const cached = liveDataCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Fetch reserves with retry
    const aaveKitReserves = await withRetry(() => queryReserves(marketKey), {
      onRetry: (attempt, error) => {
        console.warn(`Retry ${attempt} for market ${marketKey}:`, error.message);
      },
    });

    // Transform to Reserve entities
    const reserves: Reserve[] = aaveKitReserves.map((r) => {
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
      // PercentValue.value is normalized (1.0 = 100%), so use directly
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
      };
    });

    // Calculate market totals
    const totals = calculateMarketTotals(reserves);

    const response = {
      reserves,
      totals,
    };

    // Cache response
    liveDataCache.set(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Error fetching market ${marketKey}:`, error);

    // Try to return stale cache
    const stale = liveDataCache.get(cacheKey);
    if (stale) {
      return NextResponse.json(stale);
    }

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to fetch market data",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
