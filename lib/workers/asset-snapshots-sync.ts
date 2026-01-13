import { prisma } from '@/lib/db/prisma';
import { loadMarkets } from '@/lib/utils/market';
import { queryPoolByAddress, queryReservesAtBlock } from '@/lib/api/subgraph';
import { resolveDateToBlock } from '@/lib/utils/block-resolver';
import { normalizeAddress } from '@/lib/utils/address';
import {
  calculateTotalSuppliedUSDFromSubgraph,
  calculateTotalBorrowedUSDFromSubgraph,
  priceFromSubgraphToUSD,
  calculateUtilizationRate,
} from '@/lib/calculations/totals';
import { calculateAPRFromIndices } from '@/lib/calculations/apr';
import { withRetry } from '@/lib/utils/retry';
import { queryReserves } from '@/lib/api/aavekit';

/**
 * Sync daily snapshots for a specific asset to database
 */
export async function syncAssetSnapshots(
  marketKey: string,
  underlyingAsset: string,
  days: number = 365
): Promise<number> {
  const normalizedAddress = normalizeAddress(underlyingAsset);
  const markets = loadMarkets();
  const market = markets.find(m => m.marketKey === marketKey);
  
  if (!market) {
    throw new Error(`Market ${marketKey} not found`);
  }

  console.log(`🔄 Syncing snapshots for ${marketKey}/${normalizedAddress} (${days} days)...`);

  try {
    // Get pool entity ID
    const pool = await withRetry(
      () => queryPoolByAddress(market.subgraphId, market.poolAddress, 10000),
      {
        onRetry: (attempt, error) => {
          console.warn(`Retry ${attempt} for pool mapping:`, error.message);
        },
      }
    );

    if (!pool) {
      throw new Error(`Pool not found in subgraph for ${marketKey}`);
    }

    // Generate dates for last N days
    const now = new Date();
    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setUTCHours(23, 59, 59, 999);
      dates.push(date);
    }

    let saved = 0;
    const batchSize = 10;

    // Process dates in batches
    for (let batchStart = 0; batchStart < dates.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, dates.length);
      const batch = dates.slice(batchStart, batchEnd);

      const batchResults = await Promise.allSettled(
        batch.map(async (date) => {
          try {
            const blockNumber = await resolveDateToBlock(date);
            const reserves = await queryReservesAtBlock(
              market.subgraphId,
              pool.id,
              blockNumber,
              10000
            );

            const reserve = reserves.find(
              (r) => r.underlyingAsset.toLowerCase() === normalizedAddress
            );

            if (!reserve) {
              return null;
            }

            // Calculate values
            const priceUSD = priceFromSubgraphToUSD(
              reserve.price.priceInEth,
              reserve.symbol
            );
            const decimals = reserve.decimals;

            const suppliedUSD = calculateTotalSuppliedUSDFromSubgraph(
              reserve.totalATokenSupply,
              decimals,
              priceUSD
            );
            const borrowedUSD = calculateTotalBorrowedUSDFromSubgraph(
              reserve.totalCurrentVariableDebt,
              decimals,
              priceUSD
            );

            const utilizationRate = calculateUtilizationRate(
              reserve.totalCurrentVariableDebt,
              reserve.availableLiquidity
            );

            // Get previous snapshot for APR calculation
            const prevSnapshot = await prisma.assetSnapshot.findFirst({
              where: {
                marketKey,
                underlyingAsset: normalizedAddress,
                date: {
                  lt: date,
                },
              },
              orderBy: {
                date: 'desc',
              },
            });

            let supplyAPR = 0;
            let borrowAPR = 0;

            if (prevSnapshot) {
              const daysDiff = (date.getTime() / 1000 - Number(prevSnapshot.timestamp)) / 86400;
              if (daysDiff > 0) {
                supplyAPR = calculateAPRFromIndices(
                  prevSnapshot.liquidityIndex,
                  reserve.liquidityIndex,
                  daysDiff
                );
                borrowAPR = calculateAPRFromIndices(
                  prevSnapshot.variableBorrowIndex,
                  reserve.variableBorrowIndex,
                  daysDiff
                );
              }
            }

            // Save to database
            await prisma.assetSnapshot.upsert({
              where: {
                marketKey_underlyingAsset_date: {
                  marketKey,
                  underlyingAsset: normalizedAddress,
                  date: date,
                },
              },
              update: {
                blockNumber: BigInt(blockNumber),
                timestamp: BigInt(Math.floor(date.getTime() / 1000)),
                suppliedTokens: reserve.totalATokenSupply,
                borrowedTokens: reserve.totalCurrentVariableDebt,
                availableLiquidity: reserve.availableLiquidity,
                supplyAPR,
                borrowAPR,
                utilizationRate,
                oraclePrice: priceUSD,
                totalSuppliedUSD: suppliedUSD,
                totalBorrowedUSD: borrowedUSD,
                liquidityIndex: reserve.liquidityIndex,
                variableBorrowIndex: reserve.variableBorrowIndex,
                updatedAt: new Date(),
              },
              create: {
                marketKey,
                underlyingAsset: normalizedAddress,
                date: date,
                blockNumber: BigInt(blockNumber),
                timestamp: BigInt(Math.floor(date.getTime() / 1000)),
                suppliedTokens: reserve.totalATokenSupply,
                borrowedTokens: reserve.totalCurrentVariableDebt,
                availableLiquidity: reserve.availableLiquidity,
                supplyAPR,
                borrowAPR,
                utilizationRate,
                oraclePrice: priceUSD,
                totalSuppliedUSD: suppliedUSD,
                totalBorrowedUSD: borrowedUSD,
                liquidityIndex: reserve.liquidityIndex,
                variableBorrowIndex: reserve.variableBorrowIndex,
              },
            });

            return true;
          } catch (error) {
            console.warn(`Failed to sync snapshot for ${date.toISOString()}:`, error);
            return null;
          }
        })
      );

      saved += batchResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
    }

    console.log(`✅ Synced ${saved}/${dates.length} snapshots for ${marketKey}/${normalizedAddress}`);
    return saved;
  } catch (error) {
    console.error(`❌ Error syncing snapshots for ${marketKey}/${normalizedAddress}:`, error);
    throw error;
  }
}

/**
 * Sync snapshots for all assets in a market
 */
export async function syncMarketAssetSnapshots(marketKey: string, days: number = 365): Promise<void> {
  console.log(`🔄 Syncing all asset snapshots for ${marketKey}...`);

  try {
    // Get all reserves for this market
    const reserves = await withRetry(() => queryReserves(marketKey));
    
    for (const reserve of reserves) {
      try {
        await syncAssetSnapshots(marketKey, reserve.underlyingAsset, days);
        // Small delay to avoid overwhelming subgraph
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to sync ${reserve.symbol} in ${marketKey}:`, error);
        // Continue with other assets
      }
    }

    console.log(`✅ Completed syncing asset snapshots for ${marketKey}`);
  } catch (error) {
    console.error(`❌ Error syncing market asset snapshots for ${marketKey}:`, error);
    throw error;
  }
}

/**
 * Sync snapshots for all markets and assets
 */
export async function syncAllAssetSnapshots(days: number = 365): Promise<void> {
  const markets = loadMarkets();
  console.log(`🔄 Starting sync for ${markets.length} markets...`);

  for (const market of markets) {
    try {
      await syncMarketAssetSnapshots(market.marketKey, days);
    } catch (error) {
      console.error(`❌ Failed to sync ${market.marketKey}:`, error);
      // Continue with other markets
    }
  }

  console.log(`✅ All asset snapshots sync completed`);
}
