#!/usr/bin/env tsx

/**
 * Manual migration script to apply SQL directly to database
 * Use this if prisma migrate doesn't work due to connection issues
 */

import { prisma } from '@/lib/db/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔄 Applying migration manually...');

  try {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/init_migration.sql'),
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
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error: any) {
          // Ignore "already exists" errors
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
          } else {
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
