import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { prisma } from "@/lib/db/prisma";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import type { DailySnapshot } from "@/lib/calculations/snapshots";

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

  // Validate inputs
  if (!validateMarketKey(marketKey) || !validateAddress(underlying)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_ADDRESS, "Invalid market or address"),
      { status: 404 }
    );
  }

  const normalizedAddress = normalizeAddress(underlying);

  try {
    // Get snapshots from database (last 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

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

    // Transform to API format
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

    return NextResponse.json(dailySnapshots);
  } catch (error) {
    console.error(
      `Error fetching daily snapshots from DB for ${marketKey}/${normalizedAddress}:`,
      error
    );

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to fetch snapshots",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
