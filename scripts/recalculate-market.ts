import { syncMarketTimeseries } from '@/lib/workers/market-data-sync';

const marketKey = 'ethereum-v3';

async function recalculateMarket() {
  console.log(`🔄 Recalculating market timeseries for ${marketKey}...\n`);

  try {
    await syncMarketTimeseries(marketKey, {
      deleteOldData: true,
      compareWithAaveKit: true,
      showProgress: true,
      batchSize: 100,
    });

    console.log('\n✅ Recalculation completed!');
  } catch (error) {
    console.error('❌ Recalculation failed:', error);
    throw error;
  }
}

// Run the script
recalculateMarket()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
