import { NextRequest, NextResponse } from "next/server";
import { syncAllMarkets } from "@/lib/workers/market-data-sync";

/**
 * POST /api/cron/sync-market-data
 * 
 * Background job endpoint for syncing market data to database.
 * 
 * This endpoint should be called by:
 * - Vercel Cron (recommended for production)
 * - External cron service
 * - Manual trigger
 * 
 * Security: Should be protected with authentication in production.
 * For Vercel Cron, use CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  // Optional: Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log('🔄 Starting market data sync via cron...');
    await syncAllMarkets();
    
    return NextResponse.json({
      success: true,
      message: "Market data sync completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Market data sync failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggers
export async function GET(request: NextRequest) {
  return POST(request);
}
