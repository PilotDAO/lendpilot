import { NextRequest, NextResponse } from "next/server";
import { queryReserve } from "@/lib/api/aavekit";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import {
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  priceToUSD,
} from "@/lib/calculations/totals";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { withRetry } from "@/lib/utils/retry";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { BigNumber } from "@/lib/utils/big-number";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketKey: string; underlying: string }> }
) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(100, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { marketKey, underlying } = await params;

  // Validate market key
  if (!validateMarketKey(marketKey)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_MARKET, "Invalid market key"),
      { status: 404 }
    );
  }

  // Validate and normalize address
  if (!validateAddress(underlying)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_ADDRESS, "Invalid asset address"),
      { status: 404 }
    );
  }

  const normalizedAddress = normalizeAddress(underlying);
  const market = getMarket(marketKey);
  if (!market) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.MARKET_NOT_FOUND, "Market not found"),
      { status: 404 }
    );
  }

  // Check cache
  const cacheKey = `reserve:${marketKey}:${normalizedAddress}`;
  const cached = liveDataCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Fetch reserve with retry
    const aaveKitReserve = await withRetry(
      () => queryReserve(marketKey, normalizedAddress),
      {
        onRetry: (attempt, error) => {
          console.warn(
            `Retry ${attempt} for reserve ${marketKey}/${normalizedAddress}:`,
            error.message
          );
        },
      }
    );

    if (!aaveKitReserve) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.RESERVE_NOT_FOUND, "Reserve not found"),
        { status: 404 }
      );
    }

    const priceUSD = priceToUSD(
      aaveKitReserve.price.priceInEth,
      aaveKitReserve.symbol,
      normalizedAddress
    );
    const decimals = aaveKitReserve.decimals;

    const suppliedTokens = new BigNumber(aaveKitReserve.totalATokenSupply);
    const borrowedTokens = new BigNumber(aaveKitReserve.totalCurrentVariableDebt);
    const availableLiquidity = new BigNumber(aaveKitReserve.availableLiquidity);

    const totalSuppliedUSD = calculateTotalSuppliedUSD(
      aaveKitReserve.totalATokenSupply,
      decimals,
      priceUSD
    );
    const totalBorrowedUSD = calculateTotalBorrowedUSD(
      aaveKitReserve.totalCurrentVariableDebt,
      decimals,
      priceUSD
    );

    // Calculate utilization
    const utilizationRate =
      borrowedTokens.plus(availableLiquidity).eq(0)
        ? 0
        : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();

    // AaveKit returns APY as decimal (e.g., 0.05 = 5%)
    // Convert to number directly (no Ray conversion needed)
    const supplyAPR = new BigNumber(aaveKitReserve.currentLiquidityRate).toNumber();
    const borrowAPR = aaveKitReserve.currentVariableBorrowRate !== "0"
      ? new BigNumber(aaveKitReserve.currentVariableBorrowRate).toNumber()
      : 0;

    const response = {
      underlyingAsset: normalizedAddress,
      symbol: aaveKitReserve.symbol,
      name: aaveKitReserve.name,
      decimals,
      imageUrl: aaveKitReserve.imageUrl,
      currentState: {
        supplyAPR,
        borrowAPR,
        suppliedTokens: suppliedTokens.toString(),
        borrowedTokens: borrowedTokens.toString(),
        availableLiquidity: availableLiquidity.toString(),
        totalSuppliedUSD,
        totalBorrowedUSD,
        utilizationRate,
        oraclePrice: priceUSD,
        liquidityIndex: aaveKitReserve.liquidityIndex,
        variableBorrowIndex: aaveKitReserve.variableBorrowIndex,
        lastUpdateTimestamp: aaveKitReserve.lastUpdateTimestamp,
      },
    };

    // Cache response
    liveDataCache.set(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      `Error fetching reserve ${marketKey}/${normalizedAddress}:`,
      error
    );

    // Try to return stale cache
    const stale = liveDataCache.get(cacheKey);
    if (stale) {
      return NextResponse.json(stale);
    }

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to fetch reserve data",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
