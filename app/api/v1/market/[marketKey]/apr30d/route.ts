import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validateMarketKey } from "@/lib/utils/market";
import { normalizeAddress } from "@/lib/utils/address";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { calculate30DayAPRSeries, calculate30DayAPRStats } from "@/lib/calculations/apr";

type Apr30dSeriesPoint = { date: string; borrowAPR: number };

/**
 * GET /api/v1/market/[marketKey]/apr30d
 *
 * Returns 30d borrow APR series for ALL reserves in the market in one request.
 * This avoids N+1 requests from the table UI.
 *
 * Query params:
 *  - days: number (default 30) [used only to size the series; currently fixed by calculate30DayAPRSeries() logic]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketKey: string }> }
) {
  // Rate limiting: this endpoint is called once per page load, but keep a sensible limit
  const rl = rateLimitMiddleware(60, 60000)(request);
  if (rl) return rl;

  const { marketKey } = await params;
  if (!validateMarketKey(marketKey)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_MARKET, "Invalid market key"),
      { status: 404 }
    );
  }

  // Historical data (AssetSnapshot) can be from 'subgraph' or 'aavekit' source
  // Read last ~45 days to have enough points for the 30d series + interpolation
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 45);
  cutoffDate.setUTCHours(0, 0, 0, 0);

  try {
    // Historical data can be from 'subgraph' or 'aavekit' source
    const rows = await prisma.assetSnapshot.findMany({
      where: {
        marketKey,
        dataSource: { in: ['subgraph', 'aavekit'] }, // Check both sources
        date: { gte: cutoffDate },
      },
      orderBy: [{ underlyingAsset: "asc" }, { date: "asc" }],
      select: {
        underlyingAsset: true,
        date: true,
        borrowAPR: true,
        timestamp: true,
      },
    });

    // Group by underlyingAsset
    const byAsset = new Map<
      string,
      Array<{ date: string; borrowAPR: number; timestamp: number }>
    >();

    for (const r of rows) {
      const underlying = normalizeAddress(r.underlyingAsset);
      const list = byAsset.get(underlying) || [];
      list.push({
        date: r.date.toISOString().split("T")[0],
        borrowAPR: r.borrowAPR,
        timestamp: Number(r.timestamp),
      });
      byAsset.set(underlying, list);
    }

    const seriesByUnderlying: Record<string, Apr30dSeriesPoint[]> = {};
    const statsByUnderlying: Record<
      string,
      {
        last: number;
        min: number;
        max: number;
        delta30d: number;
        firstDate: string;
        lastDate: string;
      } | null
    > = {};
    const metaByUnderlying: Record<
      string,
      { snapshots: number; nonZeroBorrowApr: number }
    > = {};

    for (const [underlying, snaps] of byAsset.entries()) {
      const nonZero = snaps.filter((s) => s.borrowAPR > 0).length;
      metaByUnderlying[underlying] = { snapshots: snaps.length, nonZeroBorrowApr: nonZero };
      const series = calculate30DayAPRSeries(snaps);
      seriesByUnderlying[underlying] = series;
      statsByUnderlying[underlying] = calculate30DayAPRStats(series);
    }

    return NextResponse.json({
      marketKey,
      cutoffDate: cutoffDate.toISOString().split("T")[0],
      seriesByUnderlying,
      statsByUnderlying,
      metaByUnderlying,
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error) {
    console.error(`[apr30d] Failed for ${marketKey}:`, error);
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to fetch 30d APR series",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}

