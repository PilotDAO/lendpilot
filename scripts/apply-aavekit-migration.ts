#!/usr/bin/env tsx

/**
 * Apply AaveKit raw data storage migration
 */

import { prisma } from '@/lib/db/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔄 Applying AaveKit raw data storage migration...');

  try {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260114145027_add_aavekit_raw_data/migration.sql'),
      'utf-8'
    );

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ Executed: ${statement.substring(0, 80)}...`);
        } catch (error: any) {
          // Ignore "already exists" errors
          if (
            error.message?.includes('already exists') ||
            error.message?.includes('duplicate') ||
            error.message?.includes('column') && error.message?.includes('already')
          ) {
            console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 80)}...`);
          } else {
            console.error(`❌ Error executing: ${statement.substring(0, 80)}...`);
            console.error(`   Error: ${error.message}`);
            throw error;
          }
        }
      }
    }

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
