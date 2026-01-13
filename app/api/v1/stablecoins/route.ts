import { NextRequest, NextResponse } from "next/server";
import {
  aggregateStablecoinsData,
  AggregatedStablecoinData,
} from "@/lib/calculations/stablecoins";
import { liveDataCache } from "@/lib/cache/cache-instances";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(100, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Check cache
  const cacheKey = "stablecoins:aggregated";
  const cached = liveDataCache.get(cacheKey);
  if (cached) {
    const cachedData = cached as unknown as { data: AggregatedStablecoinData[] };
    return NextResponse.json(cachedData.data);
  }

  try {
    const data = await aggregateStablecoinsData();

    // Cache response (wrap in object to satisfy cache type)
    liveDataCache.set(cacheKey, { data } as Record<string, unknown>);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error aggregating stablecoins data:", error);

    // Try to return stale cache
    const stale = liveDataCache.get(cacheKey);
    if (stale) {
      const staleData = stale as unknown as { data: AggregatedStablecoinData[] };
      return NextResponse.json(staleData.data);
    }

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to aggregate stablecoins data",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
