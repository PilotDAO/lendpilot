import { NextRequest, NextResponse } from "next/server";
import { syncAllAssetSnapshots } from "@/lib/workers/asset-snapshots-sync";

/**
 * POST /api/cron/sync-asset-snapshots
 * 
 * Background job endpoint for syncing asset snapshots to database.
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
    console.log('🔄 Starting asset snapshots sync via cron...');
    await syncAllAssetSnapshots(90);
    
    return NextResponse.json({
      success: true,
      message: "Asset snapshots sync completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Asset snapshots sync failed:', error);
    
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
