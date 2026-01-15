import { prisma } from '@/lib/db/prisma';
import { AaveKitRawSnapshot } from '@prisma/client';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { calculateAPRFromIndices } from '@/lib/calculations/apr';
import { BigNumber } from '@/lib/utils/big-number';

/**
 * Processor for creating AssetSnapshot entries from AaveKit raw snapshots
 * Processes raw market snapshots and creates individual asset snapshots
 */
export class AaveKitAssetProcessor {
  /**
   * Processes a raw snapshot and creates AssetSnapshot entries for all reserves
   */
  async processSnapshot(rawSnapshot: AaveKitRawSnapshot): Promise<void> {
    const reserves = rawSnapshot.rawData as any[];
    
    if (!reserves || !Array.isArray(reserves) || reserves.length === 0) {
      console.warn(`⚠️  Empty or invalid raw data for ${rawSnapshot.marketKey} on ${rawSnapshot.date.toISOString()}`);
      return;
    }
    
    let processed = 0;
    let failed = 0;
    
    // Process each reserve in the snapshot
    for (const reserve of reserves) {
      try {
        const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
        
        // Check if snapshot already exists
        const existing = await prisma.assetSnapshot.findUnique({
          where: {
            marketKey_underlyingAsset_date: {
              marketKey: rawSnapshot.marketKey,
              underlyingAsset: normalizedAddress,
              date: rawSnapshot.date,
            },
          },
        });
        
        if (existing) {
          // Update existing snapshot with new data source
          if (existing.dataSource !== 'aavekit') {
            await this.updateAssetSnapshot(existing.id, reserve, rawSnapshot);
            processed++;
          }
          continue;
        }
        
        // Calculate values
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
        
        const suppliedTokens = new BigNumber(reserve.totalATokenSupply);
        const borrowedTokens = new BigNumber(reserve.totalCurrentVariableDebt);
        const availableLiquidity = new BigNumber(reserve.availableLiquidity);
        
        const utilizationRate =
          borrowedTokens.plus(availableLiquidity).eq(0)
            ? 0
            : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();
        
        // Get previous snapshot for APR calculation
        const prevSnapshot = await prisma.assetSnapshot.findFirst({
          where: {
            marketKey: rawSnapshot.marketKey,
            underlyingAsset: normalizedAddress,
            date: {
              lt: rawSnapshot.date,
            },
          },
          orderBy: {
            date: 'desc',
          },
        });
        
        let supplyAPR = 0;
        let borrowAPR = 0;
        
        // AaveKit doesn't provide indices directly, so we use rates
        // For historical APR, we need to calculate from previous snapshots
        if (prevSnapshot) {
          const daysDiff = (Number(rawSnapshot.timestamp) - Number(prevSnapshot.timestamp)) / 86400;
          if (daysDiff > 0 && daysDiff <= 2) { // Only if within 2 days (daily snapshots)
            // Use current rates as approximation (AaveKit provides current rates, not historical)
            supplyAPR = new BigNumber(reserve.currentLiquidityRate).toNumber();
            borrowAPR = reserve.currentVariableBorrowRate !== "0"
              ? new BigNumber(reserve.currentVariableBorrowRate).toNumber()
              : 0;
          }
        } else {
          // First snapshot - use current rates
          supplyAPR = new BigNumber(reserve.currentLiquidityRate).toNumber();
          borrowAPR = reserve.currentVariableBorrowRate !== "0"
            ? new BigNumber(reserve.currentVariableBorrowRate).toNumber()
            : 0;
        }
        
        // Get block number if available (from raw snapshot)
        const blockNumber = rawSnapshot.blockNumber || BigInt(0);
        
        // Save to database
        await prisma.assetSnapshot.upsert({
          where: {
            marketKey_underlyingAsset_date: {
              marketKey: rawSnapshot.marketKey,
              underlyingAsset: normalizedAddress,
              date: rawSnapshot.date,
            },
          },
          update: {
            blockNumber,
            timestamp: rawSnapshot.timestamp,
            suppliedTokens: reserve.totalATokenSupply,
            borrowedTokens: reserve.totalCurrentVariableDebt,
            availableLiquidity: reserve.availableLiquidity,
            supplyAPR,
            borrowAPR,
            utilizationRate,
            oraclePrice: priceUSD,
            totalSuppliedUSD: suppliedUSD,
            totalBorrowedUSD: borrowedUSD,
            liquidityIndex: reserve.liquidityIndex || "0",
            variableBorrowIndex: reserve.variableBorrowIndex || "0",
            dataSource: 'aavekit',
            rawDataId: rawSnapshot.id,
            updatedAt: new Date(),
          },
          create: {
            marketKey: rawSnapshot.marketKey,
            underlyingAsset: normalizedAddress,
            date: rawSnapshot.date,
            blockNumber,
            timestamp: rawSnapshot.timestamp,
            suppliedTokens: reserve.totalATokenSupply,
            borrowedTokens: reserve.totalCurrentVariableDebt,
            availableLiquidity: reserve.availableLiquidity,
            supplyAPR,
            borrowAPR,
            utilizationRate,
            oraclePrice: priceUSD,
            totalSuppliedUSD: suppliedUSD,
            totalBorrowedUSD: borrowedUSD,
            liquidityIndex: reserve.liquidityIndex || "0",
            variableBorrowIndex: reserve.variableBorrowIndex || "0",
            dataSource: 'aavekit',
            rawDataId: rawSnapshot.id,
          },
        });
        
        processed++;
      } catch (error) {
        console.warn(`⚠️  Error processing reserve ${reserve.symbol} in ${rawSnapshot.marketKey}:`, error);
        failed++;
      }
    }
    
    if (processed > 0 || failed > 0) {
      console.log(`  📊 Processed ${processed} assets, ${failed} failed for ${rawSnapshot.marketKey} on ${rawSnapshot.date.toISOString().split('T')[0]}`);
    }
  }
  
  /**
   * Updates existing asset snapshot with AaveKit data
   */
  private async updateAssetSnapshot(
    snapshotId: string,
    reserve: any,
    rawSnapshot: AaveKitRawSnapshot
  ): Promise<void> {
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
    
    const suppliedTokens = new BigNumber(reserve.totalATokenSupply);
    const borrowedTokens = new BigNumber(reserve.totalCurrentVariableDebt);
    const availableLiquidity = new BigNumber(reserve.availableLiquidity);
    
    const utilizationRate =
      borrowedTokens.plus(availableLiquidity).eq(0)
        ? 0
        : borrowedTokens.div(borrowedTokens.plus(availableLiquidity)).toNumber();
    
    await prisma.assetSnapshot.update({
      where: { id: snapshotId },
      data: {
        blockNumber: rawSnapshot.blockNumber || BigInt(0),
        timestamp: rawSnapshot.timestamp,
        suppliedTokens: reserve.totalATokenSupply,
        borrowedTokens: reserve.totalCurrentVariableDebt,
        availableLiquidity: reserve.availableLiquidity,
        supplyAPR: new BigNumber(reserve.currentLiquidityRate).toNumber(),
        borrowAPR: reserve.currentVariableBorrowRate !== "0"
          ? new BigNumber(reserve.currentVariableBorrowRate).toNumber()
          : 0,
        utilizationRate,
        oraclePrice: priceUSD,
        totalSuppliedUSD: suppliedUSD,
        totalBorrowedUSD: borrowedUSD,
        liquidityIndex: reserve.liquidityIndex || "0",
        variableBorrowIndex: reserve.variableBorrowIndex || "0",
        dataSource: 'aavekit',
        rawDataId: rawSnapshot.id,
        updatedAt: new Date(),
      },
    });
  }
  
  /**
   * Processes all pending snapshots (not yet processed into AssetSnapshots)
   */
  async processAllPending(): Promise<void> {
    // Process ALL raw snapshots that haven't been transformed into AssetSnapshot yet.
    // NOTE: A single raw snapshot contains many reserves, so we mark processing by presence of any AssetSnapshot with rawDataId = snapshot.id.
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    cutoffDate.setUTCHours(0, 0, 0, 0);

    const snapshots = await prisma.aaveKitRawSnapshot.findMany({
      where: {
        marketKey: {
          not: 'ethereum-v3', // Skip Ethereum V3 (uses Subgraph)
        },
        dataSource: 'aavekit',
        date: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
    
    if (snapshots.length === 0) {
      console.log('✅ No AaveKit snapshots to process');
      return;
    }

    // Determine which raw snapshots have already been processed into AssetSnapshot
    const snapshotIds = snapshots.map((s) => s.id);
    const processed = await prisma.assetSnapshot.findMany({
      where: {
        rawDataId: { in: snapshotIds },
        dataSource: 'aavekit',
      },
      distinct: ['rawDataId'],
      select: { rawDataId: true },
    });
    const processedIds = new Set(processed.map((p) => p.rawDataId).filter(Boolean) as string[]);
    const pending = snapshots.filter((s) => !processedIds.has(s.id));

    if (pending.length === 0) {
      console.log('✅ No pending AaveKit snapshots to process (assets)');
      return;
    }
    
    console.log(`🔄 Processing ${pending.length}/${snapshots.length} pending AaveKit snapshots for asset snapshots...`);
    
    let processedCount = 0;
    let failed = 0;
    
    for (const snapshot of pending) {
      try {
        await this.processSnapshot(snapshot);
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`  📊 Progress: ${processedCount}/${pending.length} processed...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to process ${snapshot.marketKey} ${snapshot.date.toISOString()}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Asset snapshots processing completed: ${processedCount} succeeded, ${failed} failed`);
  }
  
  /**
   * Processes snapshots for a specific market
   */
  async processMarket(marketKey: string): Promise<void> {
    if (marketKey === 'ethereum-v3') {
      console.log(`⚠️  Skipping ${marketKey} (uses Subgraph)`);
      return;
    }
    
    const snapshots = await prisma.aaveKitRawSnapshot.findMany({
      where: {
        marketKey,
        dataSource: 'aavekit',
      },
      orderBy: {
        date: 'desc',
      },
    });
    
    if (snapshots.length === 0) {
      console.log(`⚠️  No AaveKit snapshots found for ${marketKey}`);
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
    
    console.log(`✅ Completed processing asset snapshots for ${marketKey}`);
  }
}
