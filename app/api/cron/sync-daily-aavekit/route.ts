import { NextRequest, NextResponse } from "next/server";
import { AaveKitDailyCollector } from "@/lib/collectors/aavekit-daily-collector";
import { AaveKitMarketProcessor } from "@/lib/processors/aavekit-market-processor";

/**
 * POST /api/cron/sync-daily-aavekit
 * 
 * Background job endpoint for syncing daily AaveKit data to database.
 * 
 * This endpoint:
 * 1. Collects raw data from AaveKit API for all markets (except Ethereum V3)
 * 2. Processes raw data and creates MarketTimeseries entries
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
    console.log('🔄 Starting daily AaveKit sync via cron...');
    
    const collector = new AaveKitDailyCollector();
    const processor = new AaveKitMarketProcessor();
    
    // Step 1: Collect today's data
    await collector.collectDailySnapshots();
    
    // Step 2: Check for missing historical data (first 365 days)
    // This ensures we have at least 1 year of data for charts
    console.log('\n🔍 Checking for missing historical data (last 365 days)...');
    const missingDataResult = await collector.collectAllMissingData(365);
    
    if (missingDataResult.collected > 0) {
      console.log(`📊 Collected ${missingDataResult.collected} missing historical snapshots`);
    }
    
    // Step 3: Process all raw data (including newly collected)
    console.log('\n🔄 Processing raw data...');
    await processor.processAllPending();
    
    return NextResponse.json({
      success: true,
      message: "Daily AaveKit sync completed",
      historicalCollected: missingDataResult.collected,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Daily AaveKit sync failed:', error);
    
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
