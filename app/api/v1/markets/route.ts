import { NextResponse } from "next/server";
import { loadMarkets } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";

export async function GET() {
  try {
    const markets = loadMarkets();
    return NextResponse.json({ markets });
  } catch (error) {
    console.error("Error loading markets:", error);
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to load markets",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 500 }
    );
  }
}
