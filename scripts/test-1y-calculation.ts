import { calculateMarketTrends } from '@/lib/calculations/trends';

async function test1yCalculation() {
  console.log('🧪 Testing 1y calculation for ethereum-v3...\n');

  try {
    const startTime = Date.now();
    console.log('⏳ Starting calculation (this may take a while - 365 requests to Subgraph)...\n');
    
    const result = await calculateMarketTrends('ethereum-v3', '1y');
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Calculation completed in ${elapsed}s`);
    console.log(`📊 Data points: ${result.data.length}`);
    
    if (result.data.length === 0) {
      console.log('❌ No data returned!');
      process.exit(1);
    }
    
    const firstDate = result.data[0]?.date;
    const lastDate = result.data[result.data.length - 1]?.date;
    
    console.log(`📅 Date range: ${firstDate} to ${lastDate}`);
    console.log(`\n✨ Test passed!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error calculating 1y data:');
    console.error(error);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

test1yCalculation();
