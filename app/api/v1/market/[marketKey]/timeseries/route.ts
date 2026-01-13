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
      const transformed = dbData.map((row: { date: Date; totalSuppliedUSD: number; totalBorrowedUSD: number; availableLiquidityUSD: number }) => ({
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

    // For 1y window, don't try Subgraph fallback (too slow, 365 requests)
    // Return empty array instead of error - component will show appropriate message
    if (window === "1y") {
      console.warn(`⚠️  No DB data for ${marketKey} (${window}). 1y data requires database sync.`);
      return NextResponse.json({
        data: [],
        marketKey,
        source: 'database',
        message: '1y data is not available yet. Please run data sync.',
      });
    }

    // Fallback: Calculate from Subgraph if DB is empty (slow path)
    // This happens on first request or if sync hasn't run yet
    // Only for 30d and 6m windows (1y is too slow)
    console.warn(`⚠️  No DB data for ${marketKey} (${window}), falling back to Subgraph`);
    
    try {
      const trendsData = await calculateMarketTrends(marketKey, window);
      
      if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
        // Return empty array instead of error for better UX
        return NextResponse.json({
          data: [],
          marketKey,
          source: 'subgraph',
          message: `No timeseries data available for ${window}`,
        });
      }

      return NextResponse.json({
        data: trendsData.data,
        marketKey,
        source: 'subgraph',
      });
    } catch (subgraphError) {
      // If Subgraph fails, return empty array instead of error
      console.error(`Subgraph fallback failed for ${marketKey} (${window}):`, subgraphError);
      return NextResponse.json({
        data: [],
        marketKey,
        source: 'subgraph',
        message: `Failed to fetch data from Subgraph for ${window}`,
      });
    }
  } catch (error) {
    console.error(`Error fetching timeseries for ${marketKey}:`, error);

    // Return empty array instead of error for better UX
    return NextResponse.json({
      data: [],
      marketKey,
      source: 'error',
      message: error instanceof Error ? error.message : "Failed to fetch timeseries data",
    });
  }
}
