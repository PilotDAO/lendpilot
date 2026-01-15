/**
 * Cleanup script to remove duplicate MarketTimeseries records
 * 
 * This script removes all records except those with window="1y",
 * since we now store data once and filter by date on API level.
 * 
 * Run: npx tsx scripts/cleanup-duplicate-timeseries.ts
 */

import { prisma } from '@/lib/db/prisma';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🧹 Cleaning up duplicate MarketTimeseries records...');
  console.log('   Keeping only window="1y" records, removing duplicates for other windows\n');

  try {
    // Get count of records to delete
    const toDelete = await prisma.marketTimeseries.count({
      where: {
        window: {
          not: '1y',
        },
      },
    });

    const toKeep = await prisma.marketTimeseries.count({
      where: {
        window: '1y',
      },
    });

    console.log(`📊 Current state:`);
    console.log(`   Records with window="1y": ${toKeep}`);
    console.log(`   Records with other windows: ${toDelete}`);
    console.log(`   Total: ${toKeep + toDelete}\n`);

    if (toDelete === 0) {
      console.log('✅ No duplicate records found. Database is already clean.');
      return;
    }

    // Delete all records except window="1y"
    console.log(`🗑️  Deleting ${toDelete} duplicate records...`);
    const result = await prisma.marketTimeseries.deleteMany({
      where: {
        window: {
          not: '1y',
        },
      },
    });

    console.log(`✅ Deleted ${result.count} duplicate records`);
    console.log(`📊 Remaining records: ${toKeep} (all with window="1y")`);
    console.log(`\n💾 Database cleanup completed successfully!`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
