import { NextRequest, NextResponse } from "next/server";
import { getMarketReservesFromDB } from "@/lib/api/db-market-data";
import { validateMarketKey, getMarket } from "@/lib/utils/market";
import { calculateMarketTotals } from "@/lib/calculations/totals";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

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
    // All markets now use DB for current data (collected from AaveKit API via daily cron)
    const reserves = await getMarketReservesFromDB(marketKey);

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
