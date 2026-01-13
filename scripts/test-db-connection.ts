import { prisma } from '../lib/db/prisma';

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    
    // Test 1: Simple query
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as current_time`;
    console.log('✅ Connection successful!');
    console.log('📊 Test result:', result);
    
    // Test 2: Check if tables exist
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('\n📋 Available tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Test 3: Check if our tables exist
    const ourTables = ['market_timeseries', 'asset_snapshots'];
    const existingTables = tables.map(t => t.table_name);
    const missingTables = ourTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('💡 Run: npm run db:migrate');
    } else {
      console.log('\n✅ All required tables exist!');
    }
    
    await prisma.$disconnect();
    console.log('\n✨ Database connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
