import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import type { MonthlySnapshot } from "@/lib/calculations/snapshots";

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function monthlySnapshotsToCSV(snapshots: MonthlySnapshot[]): string {
  const headers = [
    "Month",
    "Start Date",
    "End Date",
    "Avg Supply APR (%)",
    "Avg Borrow APR (%)",
    "Start Total Supplied (USD)",
    "End Total Supplied (USD)",
    "Start Total Borrowed (USD)",
    "End Total Borrowed (USD)",
    "Start Utilization Rate (%)",
    "End Utilization Rate (%)",
    "Avg Price (USD)",
  ];

  const rows = snapshots.map((snapshot) => [
    snapshot.month,
    snapshot.startDate,
    snapshot.endDate,
    (snapshot.avgSupplyAPR * 100).toFixed(4),
    (snapshot.avgBorrowAPR * 100).toFixed(4),
    snapshot.startTotalSuppliedUSD.toFixed(2),
    snapshot.endTotalSuppliedUSD.toFixed(2),
    snapshot.startTotalBorrowedUSD.toFixed(2),
    snapshot.endTotalBorrowedUSD.toFixed(2),
    (snapshot.startUtilizationRate * 100).toFixed(2),
    (snapshot.endUtilizationRate * 100).toFixed(2),
    snapshot.avgPrice.toFixed(2),
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
    // Fetch monthly snapshots
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/v1/reserve/${marketKey}/${normalizedAddress}/snapshots/monthly`,
      {
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch snapshots: ${response.statusText}`);
    }

    const snapshots = (await response.json()) as MonthlySnapshot[];
    const csv = monthlySnapshotsToCSV(snapshots);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="monthly-snapshots-${marketKey}-${normalizedAddress}.csv"`,
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
