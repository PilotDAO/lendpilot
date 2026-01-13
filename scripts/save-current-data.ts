import { prisma } from '@/lib/db/prisma';
import { queryReserves } from '@/lib/api/aavekit';
import { calculateTotalSuppliedUSD, calculateTotalBorrowedUSD, priceToUSD } from '@/lib/calculations/totals';
import { normalizeAddress } from '@/lib/utils/address';
import { BigNumber } from '@/lib/utils/big-number';

const marketKey = 'ethereum-v3';

async function saveCurrentData() {
  console.log(`📊 Fetching current market data for ${marketKey}...\n`);

  // Get current data from AaveKit
  const reserves = await queryReserves(marketKey);
  
  let totalSuppliedUSD = 0;
  let totalBorrowedUSD = 0;
  let availableLiquidityUSD = 0;

  console.log('Calculating totals from reserves:');
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

  // Use calculated available liquidity for consistency
  const calculatedAvailableLiquidity = totalSuppliedUSD - totalBorrowedUSD;

  console.log('\n📈 Market Totals:');
  console.log(`  Total Supply: $${totalSuppliedUSD.toLocaleString()}`);
  console.log(`  Total Borrowed: $${totalBorrowedUSD.toLocaleString()}`);
  console.log(`  Available Liquidity (sum): $${availableLiquidityUSD.toLocaleString()}`);
  console.log(`  Available Liquidity (calculated): $${calculatedAvailableLiquidity.toLocaleString()}`);
  console.log(`  Difference: $${Math.abs(availableLiquidityUSD - calculatedAvailableLiquidity).toLocaleString()}\n`);

  // Get today's date
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Save for all windows
  const windows: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
  
  for (const window of windows) {
    try {
      await prisma.marketTimeseries.upsert({
        where: {
          marketKey_date_window: {
            marketKey,
            date: today,
            window,
          },
        },
        update: {
          totalSuppliedUSD,
          totalBorrowedUSD,
          availableLiquidityUSD: calculatedAvailableLiquidity,
          updatedAt: new Date(),
        },
        create: {
          marketKey,
          date: today,
          window,
          totalSuppliedUSD,
          totalBorrowedUSD,
          availableLiquidityUSD: calculatedAvailableLiquidity,
        },
      });
      console.log(`✅ Saved today's data (${todayStr}) for window ${window}`);
    } catch (error) {
      console.error(`❌ Error saving data for ${window}:`, error);
    }
  }

  // Verify saved data
  console.log('\n🔍 Verifying saved data:');
  const savedData = await prisma.marketTimeseries.findMany({
    where: {
      marketKey,
      date: today,
    },
  });

  for (const data of savedData) {
    console.log(`  ${data.window}:`);
    console.log(`    Total Supply: $${data.totalSuppliedUSD.toLocaleString()}`);
    console.log(`    Total Borrowed: $${data.totalBorrowedUSD.toLocaleString()}`);
    console.log(`    Available Liquidity: $${data.availableLiquidityUSD.toLocaleString()}`);
    console.log(`    Calculated: $${(data.totalSuppliedUSD - data.totalBorrowedUSD).toLocaleString()}`);
    console.log('');
  }

  console.log('✨ Done!');
}

saveCurrentData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
