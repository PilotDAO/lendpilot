import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { getDataSourceForMarket } from "@/lib/utils/data-source";
import { calculate30DayAPRSeries, calculate30DayAPRStats } from "@/lib/calculations/apr";

type Item = { marketKey: string; underlying: string };
type SeriesPoint = { date: string; borrowAPR: number };
type Stats = {
  last: number;
  min: number;
  max: number;
  delta30d: number;
  firstDate: string;
  lastDate: string;
} | null;

/**
 * POST /api/v1/apr30d/bulk
 *
 * Body:
 *  { items: Array<{ marketKey: string; underlying: string }> }
 *
 * Returns:
 *  {
 *    seriesByKey: { "<marketKey>:<underlying>": SeriesPoint[] },
 *    statsByKey:  { "<marketKey>:<underlying>": Stats },
 *    metaByKey:   { "<marketKey>:<underlying>": { snapshots: number; nonZeroBorrowApr: number } }
 *  }
 */
export async function POST(request: NextRequest) {
  const rl = rateLimitMiddleware(30, 60000)(request);
  if (rl) return rl;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_PARAMETER, "Invalid JSON body"),
      { status: 400 }
    );
  }

  const items = (body?.items || []) as Item[];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_PARAMETER, "items[] is required"),
      { status: 400 }
    );
  }

  // Hard cap to protect DB
  if (items.length > 500) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_PARAMETER, "Too many items (max 500)"),
      { status: 400 }
    );
  }

  // Validate + normalize
  const normalized: Array<{ marketKey: string; underlying: string; dataSource: "subgraph" | "aavekit" }> = [];
  for (const it of items) {
    if (!it?.marketKey || !it?.underlying) continue;
    if (!validateMarketKey(it.marketKey)) continue;
    if (!validateAddress(it.underlying)) continue;
    normalized.push({
      marketKey: it.marketKey,
      underlying: normalizeAddress(it.underlying),
      dataSource: getDataSourceForMarket(it.marketKey),
    });
  }

  if (normalized.length === 0) {
    return NextResponse.json({ seriesByKey: {}, statsByKey: {}, metaByKey: {} });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 45);
  cutoffDate.setUTCHours(0, 0, 0, 0);

  // Group queries by marketKey+dataSource for fewer roundtrips
  const groups = new Map<string, { marketKey: string; dataSource: "subgraph" | "aavekit"; underlyings: Set<string> }>();
  for (const it of normalized) {
    const key = `${it.marketKey}:${it.dataSource}`;
    const g = groups.get(key) || { marketKey: it.marketKey, dataSource: it.dataSource, underlyings: new Set<string>() };
    g.underlyings.add(it.underlying);
    groups.set(key, g);
  }

  const seriesByKey: Record<string, SeriesPoint[]> = {};
  const statsByKey: Record<string, Stats> = {};
  const metaByKey: Record<string, { snapshots: number; nonZeroBorrowApr: number }> = {};

  for (const g of groups.values()) {
    const underlyings = Array.from(g.underlyings);
    const rows = await prisma.assetSnapshot.findMany({
      where: {
        marketKey: g.marketKey,
        dataSource: g.dataSource,
        underlyingAsset: { in: underlyings },
        date: { gte: cutoffDate },
      },
      orderBy: [{ underlyingAsset: "asc" }, { date: "asc" }],
      select: { underlyingAsset: true, date: true, borrowAPR: true, timestamp: true },
    });

    const byUnderlying = new Map<string, Array<{ date: string; borrowAPR: number; timestamp: number }>>();
    for (const r of rows) {
      const u = normalizeAddress(r.underlyingAsset);
      const list = byUnderlying.get(u) || [];
      list.push({
        date: r.date.toISOString().split("T")[0],
        borrowAPR: r.borrowAPR,
        timestamp: Number(r.timestamp),
      });
      byUnderlying.set(u, list);
    }

    for (const u of underlyings) {
      const snaps = byUnderlying.get(u) || [];
      const series = calculate30DayAPRSeries(snaps);
      const stats = calculate30DayAPRStats(series);
      const key = `${g.marketKey}:${u}`;
      seriesByKey[key] = series;
      statsByKey[key] = stats;
      metaByKey[key] = { snapshots: snaps.length, nonZeroBorrowApr: snaps.filter((s) => s.borrowAPR > 0).length };
    }
  }

  return NextResponse.json(
    { seriesByKey, statsByKey, metaByKey, cutoffDate: cutoffDate.toISOString().split("T")[0] },
    {
      headers: {
        // allow CDN caching in prod
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    }
  );
}

