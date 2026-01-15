#!/usr/bin/env tsx

import { prisma } from '@/lib/db/prisma';

async function main() {
  console.log('🔄 Adding dataSource columns...');

  try {
    // Check market_timeseries
    const marketColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'market_timeseries' 
      AND column_name IN ('dataSource', 'rawDataId')
    `;

    const marketCols = marketColumns.map(c => c.column_name);
    console.log('MarketTimeseries columns:', marketCols);

    if (!marketCols.includes('dataSource')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "market_timeseries" 
        ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'subgraph';
      `);
      console.log('✅ Added dataSource to market_timeseries');
    }

    if (!marketCols.includes('rawDataId')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "market_timeseries" 
        ADD COLUMN "rawDataId" TEXT;
      `);
      console.log('✅ Added rawDataId to market_timeseries');
    }

    // Check asset_snapshots
    const assetColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'asset_snapshots' 
      AND column_name IN ('dataSource', 'rawDataId')
    `;

    const assetCols = assetColumns.map(c => c.column_name);
    console.log('AssetSnapshot columns:', assetCols);

    if (!assetCols.includes('dataSource')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "asset_snapshots" 
        ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'subgraph';
      `);
      console.log('✅ Added dataSource to asset_snapshots');
    }

    if (!assetCols.includes('rawDataId')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "asset_snapshots" 
        ADD COLUMN "rawDataId" TEXT;
      `);
      console.log('✅ Added rawDataId to asset_snapshots');
    }

    // Create indexes if they don't exist
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "market_timeseries_rawDataId_idx" 
        ON "market_timeseries"("rawDataId");
      `);
      console.log('✅ Created index for market_timeseries.rawDataId');
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        console.warn('⚠️  Index might already exist:', e.message);
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "asset_snapshots_rawDataId_idx" 
        ON "asset_snapshots"("rawDataId");
      `);
      console.log('✅ Created index for asset_snapshots.rawDataId');
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        console.warn('⚠️  Index might already exist:', e.message);
      }
    }

    console.log('✅ All columns and indexes added!');
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
