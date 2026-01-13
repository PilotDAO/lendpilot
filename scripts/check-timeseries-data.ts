import { prisma } from '@/lib/db/prisma';

async function checkTimeseriesData() {
  console.log('🔍 Checking market_timeseries data for ethereum-v3...\n');

  try {
    const marketKey = 'ethereum-v3';
    const windows: Array<'30d' | '6m' | '1y'> = ['30d', '6m', '1y'];
    
    // Check if table exists and has any data
    const totalCount = await prisma.marketTimeseries.count({
      where: {
        marketKey,
      },
    });

    if (totalCount === 0) {
      console.log('❌ No data found in market_timeseries table for ethereum-v3');
      console.log('💡 Run: npm run recalculate-market');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`📊 Total records for ${marketKey}: ${totalCount}\n`);

    for (const window of windows) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📈 Window: ${window}`);
      console.log('='.repeat(60));

      const data = await prisma.marketTimeseries.findMany({
        where: {
          marketKey,
          window,
        },
        orderBy: {
          date: 'asc',
        },
        select: {
          date: true,
          totalSuppliedUSD: true,
          totalBorrowedUSD: true,
          availableLiquidityUSD: true,
        },
      });

      if (data.length === 0) {
        console.log(`❌ No data for ${window}`);
        continue;
      }

      const firstDate = data[0].date;
      const lastDate = data[data.length - 1].date;
      const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate expected number of days
      let expectedDays = 0;
      if (window === '30d') {
        expectedDays = 30;
      } else if (window === '6m') {
        expectedDays = 180; // ~6 months
      } else if (window === '1y') {
        expectedDays = 365; // 1 year
      }

      const coverage = expectedDays > 0 
        ? ((data.length / expectedDays) * 100).toFixed(1)
        : 'N/A';

      console.log(`✅ Records: ${data.length}`);
      console.log(`   First date: ${firstDate.toISOString().split('T')[0]}`);
      console.log(`   Last date: ${lastDate.toISOString().split('T')[0]}`);
      console.log(`   Date range: ${daysDiff} days`);
      console.log(`   Expected: ~${expectedDays} days`);
      console.log(`   Coverage: ${coverage}%`);

      // Check for gaps
      const gaps: string[] = [];
      for (let i = 1; i < data.length; i++) {
        const prevDate = data[i - 1].date;
        const currDate = data[i].date;
        const diff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diff > 1) {
          gaps.push(`${prevDate.toISOString().split('T')[0]} → ${currDate.toISOString().split('T')[0]} (${diff} days)`);
        }
      }

      if (gaps.length > 0) {
        console.log(`   ⚠️  Gaps found: ${gaps.length}`);
        if (gaps.length <= 10) {
          gaps.forEach(gap => console.log(`      - ${gap}`));
        } else {
          gaps.slice(0, 10).forEach(gap => console.log(`      - ${gap}`));
          console.log(`      ... and ${gaps.length - 10} more`);
        }
      } else {
        console.log(`   ✅ No gaps detected`);
      }

      // Check latest data
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const hasToday = data.some(d => {
        const dDate = new Date(d.date);
        dDate.setUTCHours(0, 0, 0, 0);
        return dDate.getTime() === today.getTime();
      });

      if (hasToday) {
        console.log(`   ✅ Has today's data`);
      } else {
        const daysSinceLast = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ⚠️  Latest data is ${daysSinceLast} day(s) old`);
      }

      // For 1y window, show more details
      if (window === '1y') {
        console.log(`\n   📊 Detailed analysis for 1y:`);
        
        // Check if we have at least 365 days
        if (data.length < 300) {
          console.log(`   ❌ Only ${data.length} records - should have ~365 for full year`);
          console.log(`   💡 Missing approximately ${365 - data.length} days of data`);
        } else if (data.length < 365) {
          console.log(`   ⚠️  ${data.length} records - close to full year but missing ${365 - data.length} days`);
        } else {
          console.log(`   ✅ ${data.length} records - good coverage for 1 year`);
        }

        // Check date range
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        oneYearAgo.setUTCHours(0, 0, 0, 0);

        const firstDateTime = firstDate.getTime();
        const oneYearAgoTime = oneYearAgo.getTime();
        const diffFromExpected = Math.floor((firstDateTime - oneYearAgoTime) / (1000 * 60 * 60 * 24));

        if (diffFromExpected > 7) {
          console.log(`   ⚠️  First date is ${diffFromExpected} days before expected (1 year ago)`);
        } else if (diffFromExpected < -7) {
          console.log(`   ⚠️  First date is ${Math.abs(diffFromExpected)} days after expected (missing older data)`);
        } else {
          console.log(`   ✅ Date range starts close to 1 year ago`);
        }
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Final Summary');
    console.log('='.repeat(60));
    
    const data1y = await prisma.marketTimeseries.findMany({
      where: {
        marketKey,
        window: '1y',
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (data1y.length === 0) {
      console.log('\n❌ No 1y data found!');
      console.log('💡 Run: npm run recalculate-market');
    } else {
      const firstDate = data1y[0].date;
      const lastDate = data1y[data1y.length - 1].date;
      const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      const coverage = ((data1y.length / 365) * 100).toFixed(1);
      
      console.log(`\n✅ 1y window status:`);
      console.log(`   Records: ${data1y.length}`);
      console.log(`   Date range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
      console.log(`   Span: ${daysDiff} days`);
      console.log(`   Coverage: ${coverage}%`);
      
      if (data1y.length < 300) {
        console.log(`\n❌ INCOMPLETE: Less than 300 records - data is incomplete`);
        console.log(`   Missing approximately ${365 - data1y.length} days of data`);
        console.log(`\n💡 To fix, run: npm run recalculate-market`);
      } else if (data1y.length < 365) {
        console.log(`\n⚠️  PARTIAL: ${data1y.length} records - missing ${365 - data1y.length} days`);
        console.log(`   Coverage is ${coverage}%`);
      } else {
        console.log(`\n✅ COMPLETE: ${data1y.length} records - good coverage for 1 year`);
      }
    }

    console.log('\n✨ Check completed!');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking timeseries data:');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkTimeseriesData();
