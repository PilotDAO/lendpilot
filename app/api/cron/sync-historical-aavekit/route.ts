import { NextRequest, NextResponse } from "next/server";
import { AaveKitDailyCollector } from "@/lib/collectors/aavekit-daily-collector";
import { AaveKitMarketProcessor } from "@/lib/processors/aavekit-market-processor";
import { AaveKitAssetProcessor } from "@/lib/processors/aavekit-asset-processor";

/**
 * POST /api/cron/sync-historical-aavekit
 * 
 * Weekly background job for collecting missing historical AaveKit data.
 * 
 * This endpoint:
 * 1. Checks for missing data in the last 365 days
 * 2. Collects missing snapshots
 * 3. Processes raw data into MarketTimeseries and AssetSnapshots
 * 
 * This should be called:
 * - Weekly (recommended: Sunday at 3:00 UTC)
 * - Or manually when needed
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
    console.log('🔄 Starting weekly historical AaveKit data sync...');
    
    const collector = new AaveKitDailyCollector();
    const marketProcessor = new AaveKitMarketProcessor();
    const assetProcessor = new AaveKitAssetProcessor();
    
    // Step 1: Check and collect missing historical data (last 365 days)
    console.log('🔍 Checking for missing historical data (last 365 days)...');
    await collector.collectAllMissingData(365);
    
    // Step 2: Process all raw data
    console.log('\n🔄 Processing market timeseries data...');
    await marketProcessor.processAllPending();
    
    // Step 3: Process asset snapshots
    console.log('\n🔄 Processing asset snapshots...');
    await assetProcessor.processAllPending();
    
    return NextResponse.json({
      success: true,
      message: "Weekly historical AaveKit sync completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Weekly historical AaveKit sync failed:', error);
    
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
