import { NextRequest, NextResponse } from "next/server";
import { getReserveFromDB } from "@/lib/api/db-market-data";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

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
    // All markets now use DB for current data (collected from AaveKit API via daily cron)
    const reserve = await getReserveFromDB(marketKey, normalizedAddress);

    if (!reserve) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.RESERVE_NOT_FOUND, "Reserve not found"),
        { status: 404 }
      );
    }

    // Transform to response format (add missing fields if needed)
    const response = {
      underlyingAsset: reserve.underlyingAsset,
      symbol: reserve.symbol,
      name: reserve.name,
      decimals: reserve.decimals,
      imageUrl: reserve.imageUrl,
      currentState: {
        ...reserve.currentState,
        // These fields are not in DB currentState, set defaults
        liquidityIndex: "0",
        variableBorrowIndex: "0",
        lastUpdateTimestamp: 0,
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
