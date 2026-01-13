import { queryReserves } from '@/lib/api/aavekit';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'ethereum-v3';

async function verifyData() {
  console.log('🔍 Verifying graph data against real Aave data...\n');

  // Get current real data from AaveKit
  const reserves = await queryReserves(marketKey);
  
  let totalSuppliedUSD = 0;
  let totalBorrowedUSD = 0;
  let availableLiquidityUSD = 0;

  for (const reserve of reserves) {
    const normalizedAddress = normalizeAddress(reserve.underlyingAsset);
    const priceUSD = priceToUSD(reserve.price.priceInEth, reserve.symbol, normalizedAddress);
    const decimals = reserve.decimals;

    const suppliedUSD = calculateTotalSuppliedUSD(
      reserve.totalATokenSupply,
      decimals,
      priceUSD
    );
    const borrowedUSD = calculateTotalBorrowedUSD(
      reserve.totalCurrentVariableDebt,
      decimals,
      priceUSD
    );
    
    const availableLiquidity = new BigNumber(reserve.availableLiquidity);
    const availableUSD = availableLiquidity.times(priceUSD).toNumber();

    totalSuppliedUSD += suppliedUSD;
    totalBorrowedUSD += borrowedUSD;
    availableLiquidityUSD += availableUSD;
  }

  const calculatedAvailable = totalSuppliedUSD - totalBorrowedUSD;

  console.log('📊 Real Data from AaveKit API (Current):');
  console.log(`  Total Supply: $${totalSuppliedUSD.toLocaleString()}`);
  console.log(`  Total Borrowed: $${totalBorrowedUSD.toLocaleString()}`);
  console.log(`  Available Liquidity: $${calculatedAvailable.toLocaleString()}\n`);

  // Fetch from API
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/v1/market/${marketKey}/timeseries?window=30d`);
  
  if (!response.ok) {
    console.error(`❌ API request failed: ${response.statusText}`);
    return;
  }

  const apiData = await response.json();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const todayData = apiData.data?.find((d: any) => d.date === todayStr);
  
  if (!todayData) {
    console.log(`⚠️  No data found for today (${todayStr}) in API response`);
    console.log(`   Available dates: ${apiData.data?.map((d: any) => d.date).slice(-5).join(', ')}`);
    return;
  }

  console.log('📈 Data from Graph API (Today):');
  console.log(`  Date: ${todayData.date}`);
  console.log(`  Total Supply: $${todayData.totalSuppliedUSD.toLocaleString()}`);
  console.log(`  Total Borrowed: $${todayData.totalBorrowedUSD.toLocaleString()}`);
  console.log(`  Available Liquidity: $${todayData.availableLiquidityUSD.toLocaleString()}\n`);

  // Compare
  const supplyDiff = Math.abs(todayData.totalSuppliedUSD - totalSuppliedUSD);
  const supplyDiffPercent = (supplyDiff / totalSuppliedUSD) * 100;
  const borrowDiff = Math.abs(todayData.totalBorrowedUSD - totalBorrowedUSD);
  const borrowDiffPercent = (borrowDiff / totalBorrowedUSD) * 100;
  const availableDiff = Math.abs(todayData.availableLiquidityUSD - calculatedAvailable);
  const availableDiffPercent = (availableDiff / calculatedAvailable) * 100;

  console.log('🔍 Comparison:');
  console.log(`  Supply:`);
  console.log(`    Difference: $${supplyDiff.toLocaleString()} (${supplyDiffPercent.toFixed(2)}%)`);
  console.log(`    Status: ${supplyDiffPercent < 1 ? '✅ Match' : supplyDiffPercent < 5 ? '⚠️  Close' : '❌ Mismatch'}`);
  console.log(`  Borrow:`);
  console.log(`    Difference: $${borrowDiff.toLocaleString()} (${borrowDiffPercent.toFixed(2)}%)`);
  console.log(`    Status: ${borrowDiffPercent < 1 ? '✅ Match' : borrowDiffPercent < 5 ? '⚠️  Close' : '❌ Mismatch'}`);
  console.log(`  Available Liquidity:`);
  console.log(`    Difference: $${availableDiff.toLocaleString()} (${availableDiffPercent.toFixed(2)}%)`);
  console.log(`    Status: ${availableDiffPercent < 1 ? '✅ Match' : availableDiffPercent < 5 ? '⚠️  Close' : '❌ Mismatch'}\n`);

  if (supplyDiffPercent < 1 && borrowDiffPercent < 1 && availableDiffPercent < 1) {
    console.log('✅ All data matches perfectly!');
  } else if (supplyDiffPercent < 5 && borrowDiffPercent < 5 && availableDiffPercent < 5) {
    console.log('⚠️  Data is close but has some differences (likely due to timing)');
  } else {
    console.log('❌ Significant differences detected!');
  }
}

verifyData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
