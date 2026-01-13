import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { calculateMarketTrends } from "@/lib/calculations/trends";

/**
 * GET /api/v1/market/[marketKey]/timeseries
 * 
 * Returns market timeseries data for charts.
 * 
 * Tries to fetch from database first (fast, < 50ms).
 * Falls back to calculating from Subgraph if DB is empty (slow, 2-5s).
 * 
 * Query params:
 *   - window: "30d" | "6m" | "1y" (default: "30d")
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketKey: string }> | { marketKey: string } }
) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(20, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const resolvedParams = await Promise.resolve(params);
  const { marketKey } = resolvedParams;

  // Validate market key
  if (!validateMarketKey(marketKey)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_MARKET, "Invalid market key"),
      { status: 404 }
    );
  }

  // Get window parameter (30d, 6m, 1y)
  const searchParams = request.nextUrl.searchParams;
  const window = (searchParams.get("window") || "30d") as "30d" | "6m" | "1y";
  if (!["30d", "6m", "1y"].includes(window)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_PARAMETER, "Invalid window parameter"),
      { status: 400 }
    );
  }

  try {
    // Try to fetch from database first (fast path)
    const dbData = await prisma.marketTimeseries.findMany({
      where: {
        marketKey,
        window,
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
        totalSuppliedUSD: true,
        totalBorrowedUSD: true,
        availableLiquidityUSD: true,
      },
    });

    // If we have data in DB, return it immediately
    if (dbData.length > 0) {
      const transformed = dbData.map((row) => ({
        date: row.date.toISOString().split('T')[0],
        totalSuppliedUSD: row.totalSuppliedUSD,
        totalBorrowedUSD: row.totalBorrowedUSD,
        availableLiquidityUSD: row.availableLiquidityUSD,
      }));

      return NextResponse.json({
        data: transformed,
        marketKey,
        source: 'database',
      });
    }

    // Fallback: Calculate from Subgraph if DB is empty (slow path)
    // This happens on first request or if sync hasn't run yet
    console.warn(`⚠️  No DB data for ${marketKey} (${window}), falling back to Subgraph`);
    
    const trendsData = await calculateMarketTrends(marketKey, window);
    
    if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.UPSTREAM_ERROR,
          "No timeseries data available"
        ),
        { status: 503 }
      );
    }

    return NextResponse.json({
      data: trendsData.data,
      marketKey,
      source: 'subgraph',
    });
  } catch (error) {
    console.error(`Error fetching timeseries for ${marketKey}:`, error);

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to fetch timeseries data",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
