import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { prisma } from "@/lib/db/prisma";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { aggregateMonthlySnapshots } from "@/lib/calculations/snapshots";
import type { DailySnapshot } from "@/lib/calculations/snapshots";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketKey: string; underlying: string }> }
) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(20, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { marketKey, underlying } = await params;

  // Validate inputs
  if (!validateMarketKey(marketKey) || !validateAddress(underlying)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_ADDRESS, "Invalid market or address"),
      { status: 404 }
    );
  }

  const normalizedAddress = normalizeAddress(underlying);

  try {
    // Get daily snapshots from database (last 2 years for monthly aggregation)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    const snapshots = await prisma.assetSnapshot.findMany({
      where: {
        marketKey,
        underlyingAsset: normalizedAddress,
        date: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (snapshots.length === 0) {
      return NextResponse.json([]);
    }

    // Transform to DailySnapshot format
    const dailySnapshots: DailySnapshot[] = snapshots.map((snapshot: {
      date: Date;
      timestamp: bigint;
      blockNumber: bigint;
      supplyAPR: number;
      borrowAPR: number;
      totalSuppliedUSD: number;
      totalBorrowedUSD: number;
      utilizationRate: number;
      oraclePrice: number;
      liquidityIndex: string;
      variableBorrowIndex: string;
    }) => ({
      date: snapshot.date.toISOString().split("T")[0],
      timestamp: Number(snapshot.timestamp),
      blockNumber: Number(snapshot.blockNumber),
      supplyAPR: snapshot.supplyAPR,
      borrowAPR: snapshot.borrowAPR,
      totalSuppliedUSD: snapshot.totalSuppliedUSD,
      totalBorrowedUSD: snapshot.totalBorrowedUSD,
      utilizationRate: snapshot.utilizationRate,
      price: snapshot.oraclePrice,
      liquidityIndex: snapshot.liquidityIndex,
      variableBorrowIndex: snapshot.variableBorrowIndex,
    }));

    // Aggregate into monthly
    const monthlySnapshots = aggregateMonthlySnapshots(dailySnapshots);

    return NextResponse.json(monthlySnapshots);
  } catch (error) {
    console.error(
      `Error fetching monthly snapshots for ${marketKey}/${normalizedAddress}:`,
      error
    );

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to fetch monthly snapshots",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
