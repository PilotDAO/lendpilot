import { queryReserves } from '@/lib/api/aavekit';
import { loadMarkets } from '@/lib/utils/market';
import { prisma } from '@/lib/db/prisma';

/**
 * Collector for daily AaveKit API snapshots
 * Collects raw data from AaveKit API for all markets (except Ethereum V3 which uses Subgraph)
 */
export class AaveKitDailyCollector {
  /**
   * Collects daily snapshots for all markets (except Ethereum V3)
   */
  async collectDailySnapshots(): Promise<void> {
    const markets = loadMarkets();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Exclude Ethereum V3 (uses Subgraph)
    const marketsToCollect = markets.filter(m => m.marketKey !== 'ethereum-v3');
    
    console.log(`🔄 Collecting daily snapshots for ${marketsToCollect.length} markets...`);
    
    let collected = 0;
    let failed = 0;
    
    for (const market of marketsToCollect) {
      try {
        console.log(`  📊 Collecting ${market.marketKey}...`);
        
        // Get data from AaveKit
        const reserves = await queryReserves(market.marketKey);
        
        if (!reserves || reserves.length === 0) {
          console.warn(`  ⚠️  No reserves found for ${market.marketKey}`);
          failed++;
          continue;
        }
        
        // Save raw data
        await prisma.aaveKitRawSnapshot.upsert({
          where: {
            marketKey_date_dataSource: {
              marketKey: market.marketKey,
              date: today,
              dataSource: 'aavekit',
            },
          },
          update: {
            rawData: reserves as any,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            updatedAt: new Date(),
          },
          create: {
            marketKey: market.marketKey,
            date: today,
            rawData: reserves as any,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            dataSource: 'aavekit',
          },
        });
        
        collected++;
        console.log(`  ✅ Collected ${market.marketKey} (${reserves.length} reserves)`);
      } catch (error) {
        console.error(`  ❌ Failed to collect ${market.marketKey}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Daily snapshots collection completed: ${collected} succeeded, ${failed} failed`);
  }
  
  /**
   * Collects snapshots for a specific market
   */
  async collectMarketSnapshot(marketKey: string, date?: Date): Promise<void> {
    const targetDate = date || new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    
    // Skip Ethereum V3
    if (marketKey === 'ethereum-v3') {
      console.log(`⚠️  Skipping ${marketKey} (uses Subgraph)`);
      return;
    }
    
    try {
      console.log(`📊 Collecting snapshot for ${marketKey} on ${targetDate.toISOString().split('T')[0]}...`);
      
      const reserves = await queryReserves(marketKey);
      
      if (!reserves || reserves.length === 0) {
        throw new Error(`No reserves found for ${marketKey}`);
      }
      
      await prisma.aaveKitRawSnapshot.upsert({
        where: {
          marketKey_date_dataSource: {
            marketKey,
            date: targetDate,
            dataSource: 'aavekit',
          },
        },
        update: {
          rawData: reserves as any,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          updatedAt: new Date(),
        },
        create: {
          marketKey,
          date: targetDate,
          rawData: reserves as any,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          dataSource: 'aavekit',
        },
      });
      
      console.log(`✅ Collected ${marketKey} (${reserves.length} reserves)`);
    } catch (error) {
      console.error(`❌ Failed to collect ${marketKey}:`, error);
      throw error;
    }
  }

  /**
   * Finds missing dates for a market within the last N days
   * Returns array of dates that need to be collected
   */
  async findMissingDates(marketKey: string, days: number = 365): Promise<Date[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Generate all dates for last N days
    const allDates: Date[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setUTCHours(0, 0, 0, 0);
      allDates.push(date);
    }
    
    // Get existing snapshots
    const existing = await prisma.aaveKitRawSnapshot.findMany({
      where: {
        marketKey,
        date: {
          gte: new Date(today.getTime() - days * 24 * 60 * 60 * 1000),
          lte: today,
        },
        dataSource: 'aavekit',
      },
      select: {
        date: true,
      },
    });
    
    const existingDates = new Set(
      existing.map(s => s.date.toISOString().split('T')[0])
    );
    
    // Find missing dates
    const missingDates = allDates.filter(date => {
      const dateStr = date.toISOString().split('T')[0];
      return !existingDates.has(dateStr);
    });
    
    return missingDates;
  }

  /**
   * Collects missing historical data for a market
   * Checks for missing dates and collects them
   */
  async collectMissingData(marketKey: string, days: number = 365): Promise<{ collected: number; skipped: number }> {
    console.log(`🔍 Checking for missing data for ${marketKey} (last ${days} days)...`);
    
    const missingDates = await this.findMissingDates(marketKey, days);
    
    if (missingDates.length === 0) {
      console.log(`  ✅ No missing data for ${marketKey}`);
      return { collected: 0, skipped: 0 };
    }
    
    console.log(`  📊 Found ${missingDates.length} missing dates for ${marketKey}`);
    
    let collected = 0;
    let skipped = 0;
    
    // Collect missing dates (with rate limiting)
    for (let i = 0; i < missingDates.length; i++) {
      const date = missingDates[i];
      
      try {
        await this.collectMarketSnapshot(marketKey, date);
        collected++;
        
        // Small delay to avoid rate limiting (every 10 requests)
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`  ❌ Failed to collect ${marketKey} for ${date.toISOString().split('T')[0]}:`, error);
        skipped++;
      }
    }
    
    console.log(`  ✅ Collected ${collected} snapshots for ${marketKey} (${skipped} failed)`);
    return { collected, skipped };
  }

  /**
   * Collects missing historical data for all markets
   * Checks each market and collects missing dates
   * Returns summary of collected data
   */
  async collectAllMissingData(days: number = 365): Promise<{ collected: number; skipped: number }> {
    const markets = loadMarkets();
    const marketsToCollect = markets.filter(m => m.marketKey !== 'ethereum-v3');
    
    console.log(`🔄 Collecting missing historical data for ${marketsToCollect.length} markets (last ${days} days)...\n`);
    
    let totalCollected = 0;
    let totalSkipped = 0;
    
    for (const market of marketsToCollect) {
      try {
        const result = await this.collectMissingData(market.marketKey, days);
        totalCollected += result.collected;
        totalSkipped += result.skipped;
        
        // Delay between markets to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Failed to collect missing data for ${market.marketKey}:`, error);
      }
    }
    
    console.log(`\n✅ Missing data collection completed:`);
    console.log(`   Collected: ${totalCollected} snapshots`);
    console.log(`   Failed: ${totalSkipped} snapshots`);
    
    return { collected: totalCollected, skipped: totalSkipped };
  }
}
