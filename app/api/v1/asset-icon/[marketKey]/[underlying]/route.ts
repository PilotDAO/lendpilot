import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { getReserveFromDB } from "@/lib/api/db-market-data";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { liveDataCache } from "@/lib/cache/cache-instances";

/**
 * GET /api/v1/asset-icon/[marketKey]/[underlying]
 * 
 * Proxies asset icon from database (originally from AaveKit API)
 * This endpoint allows us to serve icons from our backend, avoiding CORS issues
 * 
 * Optimizations:
 * - Uses liveDataCache to avoid multiple DB queries for the same reserve
 * - Caches icon URLs to reduce DB load
 */
// Cache for icon URLs (cache for 1 hour)
const iconUrlCache = new Map<string, { imageUrl: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  const cacheKey = `icon:${marketKey}:${normalizedAddress}`;

  // Check icon URL cache first
  const cached = iconUrlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    try {
      const imageResponse = await fetch(cached.imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch (error) {
      // Cache miss or fetch failed, continue to DB lookup
    }
  }

  try {
    // Use liveDataCache to avoid multiple DB queries for the same reserve
    const reserveCacheKey = `reserve:${marketKey}:${normalizedAddress}`;
    let reserve = liveDataCache.get(reserveCacheKey) as any;
    
    if (!reserve) {
      reserve = await getReserveFromDB(marketKey, normalizedAddress);
      if (reserve) {
        liveDataCache.set(reserveCacheKey, reserve as Record<string, unknown>);
      }
    }
    
    if (!reserve || !reserve.imageUrl) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.RESERVE_NOT_FOUND, "Reserve or icon not found"),
        { status: 404 }
      );
    }

    // Cache the imageUrl
    iconUrlCache.set(cacheKey, {
      imageUrl: reserve.imageUrl,
      timestamp: Date.now(),
    });

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
