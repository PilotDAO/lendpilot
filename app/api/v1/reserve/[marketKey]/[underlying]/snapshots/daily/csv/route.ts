import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import type { DailySnapshot } from "@/lib/calculations/snapshots";

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function snapshotsToCSV(snapshots: DailySnapshot[]): string {
  const headers = [
    "Date",
    "Supply APR (%)",
    "Borrow APR (%)",
    "Total Supplied (USD)",
    "Total Borrowed (USD)",
    "Utilization Rate (%)",
    "Price (USD)",
  ];

  const rows = snapshots.map((snapshot) => [
    snapshot.date,
    (snapshot.supplyAPR * 100).toFixed(4),
    (snapshot.borrowAPR * 100).toFixed(4),
    snapshot.totalSuppliedUSD.toFixed(2),
    snapshot.totalBorrowedUSD.toFixed(2),
    (snapshot.utilizationRate * 100).toFixed(2),
    snapshot.price.toFixed(2),
  ]);

  const csvRows = [headers.map(formatCSVValue), ...rows.map((row) => row.map(formatCSVValue))];
  return csvRows.map((row) => row.join(",")).join("\n");
}

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
    // Fetch daily snapshots
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/v1/reserve/${marketKey}/${normalizedAddress}/snapshots/daily`,
      {
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch snapshots: ${response.statusText}`);
    }

    const snapshots = (await response.json()) as DailySnapshot[];
    const csv = snapshotsToCSV(snapshots);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="daily-snapshots-${marketKey}-${normalizedAddress}.csv"`,
      },
    });
  } catch (error) {
    console.error(`Error generating CSV for ${marketKey}/${normalizedAddress}:`, error);
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to generate CSV",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
