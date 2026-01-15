import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { calculateMarketTrends } from "@/lib/calculations/trends";
import { getDataSourceForMarket } from "@/lib/utils/data-source";
import { getDaysForWindow, TimeWindow } from "@/lib/types/timeframes";

function expectedDaysForWindow(window: "7d" | "30d" | "3m" | "6m" | "1y"): number {
  return getDaysForWindow(window);
}

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
  // Rate limiting: keep in prod, but avoid throttling local dev (many parallel requests)
  if (process.env.NODE_ENV === "production") {
    const rateLimitResponse = rateLimitMiddleware(100, 60000)(request); // 100 req/min per IP in prod
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
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

  // Get window parameter (7d, 30d, 3m, 6m, 1y)
  const searchParams = request.nextUrl.searchParams;
  const window = (searchParams.get("window") || "30d") as "7d" | "30d" | "3m" | "6m" | "1y";
  if (!["7d", "30d", "3m", "6m", "1y"].includes(window)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_PARAMETER, "Invalid window parameter. Must be one of: 7d, 30d, 3m, 6m, 1y"),
      { status: 400 }
    );
  }

  try {
    const dataSource = getDataSourceForMarket(marketKey);

    // Calculate cutoff date for the window (only last N days)
    const expectedDays = expectedDaysForWindow(window);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - expectedDays);
    cutoffDate.setUTCHours(0, 0, 0, 0);

    // Strategy: Data is stored once (with window="1y" for compatibility)
    // Filter by date only - window parameter is just for filtering, not for storage
    // This avoids data duplication: one record per marketKey+date+dataSource
    const allDbData = await prisma.marketTimeseries.findMany({
      where: {
        marketKey,
        window: '1y', // All data is stored with window="1y" - filtering is by date only
        dataSource,
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

    // Filter by date based on requested window
    const dbData = allDbData.filter(row => {
      const rowDate = new Date(row.date);
      rowDate.setUTCHours(0, 0, 0, 0);
      return rowDate >= cutoffDate;
    });

    // If we have data in DB, return it immediately
    if (dbData.length > 0) {
      const transformed = dbData.map((row: { date: Date; totalSuppliedUSD: number; totalBorrowedUSD: number; availableLiquidityUSD: number }) => ({
        date: row.date.toISOString().split('T')[0],
        totalSuppliedUSD: row.totalSuppliedUSD,
        totalBorrowedUSD: row.totalBorrowedUSD,
        availableLiquidityUSD: row.availableLiquidityUSD,
      }));

      const expectedDays = expectedDaysForWindow(window);
      const firstDate = dbData[0]?.date;
      const lastDate = dbData[dbData.length - 1]?.date;
      
      // Calculate actual days based on number of data points, not date range
      // This gives more accurate coverage (e.g., if we have 6 points but they span 90 days, coverage is 6/90, not 100%)
      const actualDays = dbData.length;
      const coveragePercent = Math.min(100, Math.round((actualDays / expectedDays) * 100));

      return NextResponse.json({
        data: transformed,
        marketKey,
        source: 'database',
        dataSourceUsed: dataSource,
        metadata: {
          window,
          expectedDays,
          actualDays,
          coveragePercent,
          dateRange: {
            from: firstDate.toISOString().split("T")[0],
            to: lastDate.toISOString().split("T")[0],
          },
        },
      });
    }

    // Fallback logic based on data source
    if (dataSource === 'subgraph') {
      // For Ethereum V3: fallback to Subgraph
      // For 1y window, don't try Subgraph fallback (too slow, 365 requests)
      if (window === "1y") {
        console.warn(`⚠️  No DB data for ${marketKey} (${window}). 1y data requires database sync.`);
        return NextResponse.json({
          data: [],
          marketKey,
          source: 'database',
          dataSourceUsed: dataSource,
          message: '1y data is not available yet. Please run data sync.',
        });
      }

      // Fallback: Calculate from Subgraph if DB is empty (slow path)
      console.warn(`⚠️  No DB data for ${marketKey} (${window}), falling back to Subgraph`);
      
      try {
        const trendsData = await calculateMarketTrends(marketKey, window);
      
      if (!trendsData || !trendsData.data || trendsData.data.length === 0) {
        // Return empty array instead of error for better UX
        return NextResponse.json({
          data: [],
          marketKey,
          source: 'subgraph',
          dataSourceUsed: 'subgraph',
          message: `No timeseries data available for ${window}`,
        });
      }

        return NextResponse.json({
          data: trendsData.data,
          marketKey,
          source: 'subgraph',
          dataSourceUsed: 'subgraph',
        });
      } catch (subgraphError) {
        // If Subgraph fails, return empty array instead of error
        console.error(`Subgraph fallback failed for ${marketKey} (${window}):`, subgraphError);
        return NextResponse.json({
          data: [],
          marketKey,
          source: 'subgraph',
          dataSourceUsed: 'subgraph',
          message: `Failed to fetch data from Subgraph for ${window}`,
        });
      }
    } else {
      // For AaveKit markets: data should be collected via cron
      // Return empty array - data will be available after first sync
      console.warn(`⚠️  No DB data for ${marketKey} (${window}). Data will be available after AaveKit sync runs.`);
      return NextResponse.json({
        data: [],
        marketKey,
        source: 'aavekit',
        dataSourceUsed: dataSource,
        metadata: {
          window,
          expectedDays: expectedDaysForWindow(window),
          actualDays: 0,
          coveragePercent: 0,
          dateRange: null,
        },
        message: `Data will be available after AaveKit sync runs.`,
      });
    }
  } catch (error) {
    console.error(`Error fetching timeseries for ${marketKey}:`, error);

    // Return empty array instead of error for better UX
    return NextResponse.json({
      data: [],
      marketKey,
      source: 'error',
      metadata: {
        window,
        expectedDays: expectedDaysForWindow(window),
        actualDays: 0,
        coveragePercent: 0,
        dateRange: null,
      },
      message: error instanceof Error ? error.message : "Failed to fetch timeseries data",
    });
  }
}
