#!/usr/bin/env tsx

/**
 * Simple script to check latest data in database
 * 
 * Usage:
 *   tsx scripts/check-latest-db-data.ts
 */

// Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { prisma } from '@/lib/db/prisma';

async function checkLatestData() {
  const marketKey = 'ethereum-v3';
  
  console.log('🔍 Checking latest database data for ethereum-v3...\n');

  try {
    // Get last 5 records for each window
    const windows: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
    
    for (const window of windows) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 Window: ${window}`);
      console.log('='.repeat(60));
      
      const latest = await prisma.marketTimeseries.findMany({
        where: {
          marketKey,
          window,
        },
        orderBy: {
          date: 'desc',
        },
        take: 5,
        select: {
          date: true,
          updatedAt: true,
          totalSuppliedUSD: true,
          totalBorrowedUSD: true,
          availableLiquidityUSD: true,
        },
      });

      if (latest.length === 0) {
        console.log('❌ No data found');
        continue;
      }

      console.log(`\n📅 Last ${latest.length} records (newest first):\n`);
      
      for (const record of latest) {
        const calculatedAvailable = record.totalSuppliedUSD - record.totalBorrowedUSD;
        const diff = Math.abs(record.availableLiquidityUSD - calculatedAvailable);
        
        console.log(`Date: ${record.date.toISOString().split('T')[0]}`);
        console.log(`  Updated: ${record.updatedAt.toISOString()}`);
        console.log(`  Total Supplied: $${record.totalSuppliedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`  Total Borrowed: $${record.totalBorrowedUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`  Available (stored): $${record.availableLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        console.log(`  Available (calculated): $${calculatedAvailable.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
        
        if (diff > 0.01) {
          console.log(`  ⚠️  Difference: $${diff.toFixed(2)}`);
        } else {
          console.log(`  ✅ Values match`);
        }
        
        // Check if borrowed > supplied (should never happen)
        if (record.totalBorrowedUSD > record.totalSuppliedUSD) {
          console.log(`  ❌ ERROR: Borrowed (${record.totalBorrowedUSD}) > Supplied (${record.totalSuppliedUSD})!`);
        }
        
        // Check if available is negative
        if (record.availableLiquidityUSD < 0) {
          console.log(`  ❌ ERROR: Available liquidity is negative!`);
        }
        
        console.log('');
      }
    }

    // Check when data was last updated
    console.log(`\n${'='.repeat(60)}`);
    console.log('⏰ Last Update Times');
    console.log('='.repeat(60));
    
    for (const window of windows) {
      const latest = await prisma.marketTimeseries.findFirst({
        where: {
          marketKey,
          window,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          date: true,
          updatedAt: true,
        },
      });

      if (latest) {
        const hoursAgo = (Date.now() - latest.updatedAt.getTime()) / (1000 * 60 * 60);
        console.log(`${window}: Last updated ${hoursAgo.toFixed(2)} hours ago (${latest.updatedAt.toISOString()})`);
        console.log(`  Latest date in data: ${latest.date.toISOString().split('T')[0]}`);
      } else {
        console.log(`${window}: No data`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
