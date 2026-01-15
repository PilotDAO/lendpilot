import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { getReserveFromDB } from "@/lib/api/db-market-data";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * GET /api/v1/asset-icon/[marketKey]/[underlying]
 * 
 * Proxies asset icon from database (originally from AaveKit API)
 * This endpoint allows us to serve icons from our backend, avoiding CORS issues
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketKey: string; underlying: string }> }
) {
  const rateLimitResponse = rateLimitMiddleware(100, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { marketKey, underlying } = await params;

  if (!validateMarketKey(marketKey) || !validateAddress(underlying)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_ADDRESS, "Invalid market or address"),
      { status: 404 }
    );
  }

  const normalizedAddress = normalizeAddress(underlying);

  try {
    const reserve = await getReserveFromDB(marketKey, normalizedAddress);
    
    if (!reserve || !reserve.imageUrl) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.RESERVE_NOT_FOUND, "Reserve or icon not found"),
        { status: 404 }
      );
    }

    // Fetch the image from the original URL and proxy it
    // This allows Next.js Image component to work properly
    try {
      const imageResponse = await fetch(reserve.imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/png';

      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (fetchError) {
      console.error(`Error fetching image from ${reserve.imageUrl}:`, fetchError);
      // Fallback: redirect if fetch fails
      return NextResponse.redirect(reserve.imageUrl, 307);
    }
  } catch (error) {
    console.error(`Error fetching icon for ${marketKey}/${normalizedAddress}:`, error);
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UPSTREAM_ERROR, "Failed to fetch icon"),
      { status: 503 }
    );
  }
}
