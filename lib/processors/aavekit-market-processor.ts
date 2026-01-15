import { prisma } from '@/lib/db/prisma';
import { AaveKitRawSnapshot } from '@prisma/client';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { ALL_TIME_WINDOWS } from '@/lib/types/timeframes';
import { BigNumber } from '@/lib/utils/big-number';

/**
 * Processor for AaveKit raw snapshots
 * Processes raw data and creates MarketTimeseries entries
 */
export class AaveKitMarketProcessor {
  /**
   * Processes a raw snapshot and creates MarketTimeseries entries
   */
  async processSnapshot(rawSnapshot: AaveKitRawSnapshot): Promise<void> {
    const reserves = rawSnapshot.rawData as any[];
    
    if (!reserves || !Array.isArray(reserves) || reserves.length === 0) {
      console.warn(`⚠️  Empty or invalid raw data for ${rawSnapshot.marketKey} on ${rawSnapshot.date.toISOString()}`);
      return;
    }
    
    let totalSuppliedUSD = 0;
    let totalBorrowedUSD = 0;
    let availableLiquidityUSD = 0;
    
    // Process each reserve
    for (const reserve of reserves) {
      try {
        const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
        const priceUSD = priceToUSD(reserve.price.priceInEth, reserve.symbol, normalizedAddress);
        const decimals = reserve.decimals;
        
        const suppliedUSD = calculateTotalSuppliedUSD(
          reserve.totalATokenSupply,
          decimals,
          priceUSD
        );
        const borrowedUSD = calculateTotalBorrowedUSD(
          reserve.totalCurrentVariableDebt,
          decimals,
          priceUSD
        );
        
        const availableLiquidity = new BigNumber(reserve.availableLiquidity);
        const availableUSD = availableLiquidity.times(priceUSD).toNumber();
        
        totalSuppliedUSD += suppliedUSD;
        totalBorrowedUSD += borrowedUSD;
        availableLiquidityUSD += availableUSD;
      } catch (error) {
        console.warn(`⚠️  Error processing reserve ${reserve.symbol} in ${rawSnapshot.marketKey}:`, error);
        // Continue with other reserves
      }
    }
    
    // Use calculated value for consistency
    const calculatedAvailableLiquidity = totalSuppliedUSD - totalBorrowedUSD;
    
    // Save data once (using "1y" as default window for compatibility)
    // Filtering by date will be done on API level, not by window field
    // This avoids data duplication - one record per marketKey+date+dataSource
    try {
      await prisma.marketTimeseries.upsert({
        where: {
          marketKey_date_window: {
            marketKey: rawSnapshot.marketKey,
            date: rawSnapshot.date,
            window: '1y', // Use "1y" as default - window is just for compatibility, filtering is by date
          },
        },
        update: {
          totalSuppliedUSD,
          totalBorrowedUSD,
          availableLiquidityUSD: calculatedAvailableLiquidity,
          dataSource: 'aavekit',
          rawDataId: rawSnapshot.id,
          updatedAt: new Date(),
        },
        create: {
          marketKey: rawSnapshot.marketKey,
          date: rawSnapshot.date,
          window: '1y', // Use "1y" as default - window is just for compatibility, filtering is by date
          totalSuppliedUSD,
          totalBorrowedUSD,
          availableLiquidityUSD: calculatedAvailableLiquidity,
          dataSource: 'aavekit',
          rawDataId: rawSnapshot.id,
        },
      });
    } catch (error) {
      console.error(`❌ Failed to save MarketTimeseries for ${rawSnapshot.marketKey}:`, error);
      throw error;
    }
  }
  
  /**
   * Processes all pending snapshots (not yet processed)
   */
  async processAllPending(): Promise<void> {
    // Find all snapshots
    const allSnapshots = await prisma.aaveKitRawSnapshot.findMany({
      orderBy: {
        date: 'asc',
      },
    });
    
    // Filter snapshots that don't have corresponding MarketTimeseries entries
    const pending: typeof allSnapshots = [];
    for (const snapshot of allSnapshots) {
      const existing = await prisma.marketTimeseries.findFirst({
        where: {
          marketKey: snapshot.marketKey,
          date: snapshot.date,
          rawDataId: snapshot.id,
        },
      });
      
      if (!existing) {
        pending.push(snapshot);
      }
    }
    
    if (pending.length === 0) {
      console.log('✅ No pending snapshots to process');
      return;
    }
    
    console.log(`🔄 Processing ${pending.length} pending snapshots...`);
    
    let processed = 0;
    let failed = 0;
    
    for (const snapshot of pending) {
      try {
        await this.processSnapshot(snapshot);
        processed++;
        if (processed % 10 === 0) {
          console.log(`  📊 Progress: ${processed}/${pending.length} processed...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to process ${snapshot.marketKey} ${snapshot.date.toISOString()}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Processing completed: ${processed} succeeded, ${failed} failed`);
  }
  
  /**
   * Processes snapshots for a specific market
   */
  async processMarket(marketKey: string, date?: Date): Promise<void> {
    const where: any = {
      marketKey,
      dataSource: 'aavekit',
    };
    
    if (date) {
      where.date = date;
    }
    
    const snapshots = await prisma.aaveKitRawSnapshot.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });
    
    if (snapshots.length === 0) {
      console.log(`⚠️  No snapshots found for ${marketKey}`);
      return;
    }
    
    console.log(`🔄 Processing ${snapshots.length} snapshots for ${marketKey}...`);
    
    for (const snapshot of snapshots) {
      try {
        await this.processSnapshot(snapshot);
      } catch (error) {
        console.error(`❌ Failed to process ${snapshot.date.toISOString()}:`, error);
      }
    }
    
    console.log(`✅ Completed processing for ${marketKey}`);
  }
}
