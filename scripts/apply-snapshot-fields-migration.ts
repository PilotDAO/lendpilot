#!/usr/bin/env tsx

/**
 * Manual migration script to add snapshot fields to asset_snapshots table
 */

import { prisma } from '@/lib/db/prisma';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🔄 Applying snapshot fields migration...');

  try {
    // Check if columns already exist
    const checkColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'asset_snapshots' 
      AND column_name IN ('blockNumber', 'timestamp', 'liquidityIndex', 'variableBorrowIndex')
    `;

    const existingColumns = checkColumns.map(c => c.column_name);
    console.log('Existing columns:', existingColumns);

    // Add missing columns
    if (!existingColumns.includes('blockNumber')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "asset_snapshots" 
        ADD COLUMN IF NOT EXISTS "blockNumber" BIGINT NOT NULL DEFAULT 0
      `);
      console.log('✅ Added blockNumber column');
    } else {
      console.log('⚠️  blockNumber column already exists');
    }

    if (!existingColumns.includes('timestamp')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "asset_snapshots" 
        ADD COLUMN IF NOT EXISTS "timestamp" BIGINT NOT NULL DEFAULT 0
      `);
      console.log('✅ Added timestamp column');
    } else {
      console.log('⚠️  timestamp column already exists');
    }

    if (!existingColumns.includes('liquidityIndex')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "asset_snapshots" 
        ADD COLUMN IF NOT EXISTS "liquidityIndex" TEXT NOT NULL DEFAULT '0'
      `);
      console.log('✅ Added liquidityIndex column');
    } else {
      console.log('⚠️  liquidityIndex column already exists');
    }

    if (!existingColumns.includes('variableBorrowIndex')) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "asset_snapshots" 
        ADD COLUMN IF NOT EXISTS "variableBorrowIndex" TEXT NOT NULL DEFAULT '0'
      `);
      console.log('✅ Added variableBorrowIndex column');
    } else {
      console.log('⚠️  variableBorrowIndex column already exists');
    }

    // Create index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "asset_snapshots_marketKey_underlyingAsset_idx" 
      ON "asset_snapshots"("marketKey", "underlyingAsset")
    `);
    console.log('✅ Created index');

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
