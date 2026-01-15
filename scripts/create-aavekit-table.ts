#!/usr/bin/env tsx

import { prisma } from '@/lib/db/prisma';

async function main() {
  console.log('🔄 Creating aavekit_raw_snapshots table...');

  try {
    // Check if table exists
    const checkTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'aavekit_raw_snapshots'
    `;

    if (checkTable.length > 0) {
      console.log('✅ Table aavekit_raw_snapshots already exists');
      return;
    }

    // Create table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "aavekit_raw_snapshots" (
        "id" TEXT NOT NULL,
        "marketKey" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "timestamp" BIGINT NOT NULL,
        "rawData" JSONB NOT NULL,
        "dataSource" TEXT NOT NULL DEFAULT 'aavekit',
        "blockNumber" BIGINT,
        "collectionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "aavekit_raw_snapshots_pkey" PRIMARY KEY ("id")
      );
    `);

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "aavekit_raw_snapshots_marketKey_idx" ON "aavekit_raw_snapshots"("marketKey");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX "aavekit_raw_snapshots_marketKey_date_idx" ON "aavekit_raw_snapshots"("marketKey", "date");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX "aavekit_raw_snapshots_date_idx" ON "aavekit_raw_snapshots"("date");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "aavekit_raw_snapshots_marketKey_date_dataSource_key" 
      ON "aavekit_raw_snapshots"("marketKey", "date", "dataSource");
    `);

    // Create indexes for rawDataId if they don't exist
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "market_timeseries_rawDataId_idx" 
        ON "market_timeseries"("rawDataId");
      `);
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        throw e;
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "asset_snapshots_rawDataId_idx" 
        ON "asset_snapshots"("rawDataId");
      `);
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        throw e;
      }
    }

    console.log('✅ Table and indexes created successfully!');
  } catch (error) {
    console.error('❌ Failed to create table:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
