import { prisma } from '@/lib/db/prisma';
import { loadMarkets } from '@/lib/utils/market';

async function checkAllMarketsTimeseries() {
  console.log('🔍 Checking timeseries data for ALL markets...\n');

  const markets = loadMarkets();
  const windows: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
  
  console.log(`📊 Found ${markets.length} markets to check\n`);
  console.log('='.repeat(80));

  const results: Array<{
    marketKey: string;
    displayName: string;
    windows: {
      window: string;
      hasData: boolean;
      recordCount: number;
      firstDate: Date | null;
      lastDate: Date | null;
    }[];
  }> = [];

  for (const market of markets) {
    console.log(`\n📈 Checking: ${market.displayName} (${market.marketKey})`);
    console.log('-'.repeat(80));

    const marketResults = {
      marketKey: market.marketKey,
      displayName: market.displayName,
      windows: [] as Array<{
        window: string;
        hasData: boolean;
        recordCount: number;
        firstDate: Date | null;
        lastDate: Date | null;
      }>,
    };

    for (const window of windows) {
      const data = await prisma.marketTimeseries.findMany({
        where: {
          marketKey: market.marketKey,
          window,
        },
        orderBy: {
          date: 'asc',
        },
        select: {
          date: true,
        },
      });

      const hasData = data.length > 0;
      const firstDate = hasData ? data[0].date : null;
      const lastDate = hasData ? data[data.length - 1].date : null;

      marketResults.windows.push({
        window,
        hasData,
        recordCount: data.length,
        firstDate,
        lastDate,
      });

      if (hasData) {
        const daysDiff = firstDate && lastDate
          ? Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        // Calculate expected days
        let expectedDays = 0;
        if (window === '30d') {
          expectedDays = 30;
        } else if (window === '6m') {
          expectedDays = 180;
        } else if (window === '1y') {
          expectedDays = 365;
        }

        const coverage = expectedDays > 0 
          ? ((data.length / expectedDays) * 100).toFixed(1)
          : 'N/A';

        console.log(`  ${window.padEnd(4)}: ✅ ${data.length.toString().padStart(4)} records | Coverage: ${coverage}% | Range: ${firstDate?.toISOString().split('T')[0]} to ${lastDate?.toISOString().split('T')[0]} (${daysDiff} days)`);
      } else {
        console.log(`  ${window.padEnd(4)}: ❌ No data`);
      }
    }

    results.push(marketResults);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const summary: Record<string, { total: number; withData: number; missing: number }> = {
    '30d': { total: 0, withData: 0, missing: 0 },
    '6m': { total: 0, withData: 0, missing: 0 },
    '1y': { total: 0, withData: 0, missing: 0 },
  };

  for (const result of results) {
    for (const windowResult of result.windows) {
      summary[windowResult.window].total++;
      if (windowResult.hasData) {
        summary[windowResult.window].withData++;
      } else {
        summary[windowResult.window].missing++;
      }
    }
  }

  console.log('\n📈 Data availability by window:');
  for (const [window, stats] of Object.entries(summary)) {
    const percentage = ((stats.withData / stats.total) * 100).toFixed(1);
    const status = stats.missing === 0 ? '✅' : stats.withData === 0 ? '❌' : '⚠️';
    console.log(`  ${window.padEnd(4)}: ${status} ${stats.withData}/${stats.total} markets (${percentage}%)`);
  }

  // Markets missing data
  const marketsWithMissingData = results.filter(r => 
    r.windows.some(w => !w.hasData)
  );

  if (marketsWithMissingData.length > 0) {
    console.log('\n❌ Markets with missing data:');
    for (const market of marketsWithMissingData) {
      const missingWindows = market.windows
        .filter(w => !w.hasData)
        .map(w => w.window)
        .join(', ');
      console.log(`  - ${market.displayName} (${market.marketKey}): missing ${missingWindows}`);
    }
  } else {
    console.log('\n✅ All markets have data for all windows!');
  }

  // Markets with incomplete data (less than expected records)
  console.log('\n⚠️  Markets with potentially incomplete data:');
  let hasIncomplete = false;
  for (const market of results) {
    for (const windowResult of market.windows) {
      if (!windowResult.hasData) continue;

      let expectedDays = 0;
      if (windowResult.window === '30d') {
        expectedDays = 30;
      } else if (windowResult.window === '6m') {
        expectedDays = 180;
      } else if (windowResult.window === '1y') {
        expectedDays = 365;
      }

      const threshold = expectedDays * 0.8; // 80% threshold
      if (windowResult.recordCount < threshold) {
        hasIncomplete = true;
        const coverage = ((windowResult.recordCount / expectedDays) * 100).toFixed(1);
        console.log(`  - ${market.displayName} (${market.marketKey}) ${windowResult.window}: ${windowResult.recordCount}/${expectedDays} records (${coverage}%)`);
      }
    }
  }

  if (!hasIncomplete) {
    console.log('  (none)');
  }

  console.log('\n✨ Check completed!');
  await prisma.$disconnect();
  process.exit(0);
}

checkAllMarketsTimeseries().catch(async (error) => {
  console.error('❌ Error checking timeseries data:');
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
