#!/usr/bin/env tsx

/**
 * Compare AaveKit API values vs aavescan.com market page table (current state).
 *
 * We parse HTML rows: <tr id="0x..."> and read <td data-value="..."> values.
 * Observed columns (as of 2026-01):
 *   [0] symbol
 *   [1] totalSupplyUSD
 *   [2] supplyAPR (percent, as number, e.g. 2.34 means 2.34%)
 *   [3] totalBorrowUSD
 *   [4] borrowAPR (percent)
 *   [5] extra column (e.g., 30d borrow rate metric / sparkline helper) - not compared
 *
 * Usage:
 *   npx tsx scripts/compare-aavekit-vs-aavescan-market.ts            # all markets
 *   npx tsx scripts/compare-aavekit-vs-aavescan-market.ts base-v3    # single market
 */

import markets from "@/data/markets.json";
import { queryReserves } from "@/lib/api/aavekit";
import { normalizeAddress } from "@/lib/utils/address";
import { BigNumber } from "@/lib/utils/big-number";

type Row = {
  underlying: string;
  values: string[];
};

function toNum(x: string): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function approxEqual(a: number, b: number, rel: number, abs: number) {
  const diff = Math.abs(a - b);
  if (diff <= abs) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff / denom <= rel;
}

async function fetchAaveScanMarket(marketKey: string): Promise<Row[]> {
  const url = `https://aavescan.com/${marketKey}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
  if (!res.ok) throw new Error(`aavescan fetch failed ${marketKey}: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const rows: Row[] = [];
  const trRe = /<tr id="(0x[a-fA-F0-9]{40})">([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const underlying = normalizeAddress(m[1]);
    const inner = m[2];
    const vals = [...inner.matchAll(/<td[^>]*data-value="([^"]*)"[^>]*>/g)].map((x) => x[1]);
    if (vals.length > 0) rows.push({ underlying, values: vals });
  }
  return rows;
}

async function main() {
  const onlyMarket = process.argv[2];
  const list = (markets as any[])
    .map((m) => m.marketKey as string)
    .filter((k) => !onlyMarket || k === onlyMarket);

  const bad: Array<any> = [];
  const okSummary: Array<any> = [];

  for (const marketKey of list) {
    // aavescan only has pages for main markets (including ethereum-v3)
    let scanRows: Row[];
    try {
      scanRows = await fetchAaveScanMarket(marketKey);
    } catch (e: any) {
      bad.push({ marketKey, error: e?.message || String(e) });
      continue;
    }

    const scanMap = new Map(scanRows.map((r) => [r.underlying, r]));

    let reserves;
    try {
      reserves = await queryReserves(marketKey);
    } catch (e: any) {
      bad.push({ marketKey, error: `AaveKit failed: ${e?.message || String(e)}` });
      continue;
    }

    let mismatches = 0;
    let compared = 0;

    for (const r of reserves) {
      const underlying = normalizeAddress(r.underlyingAsset);
      const scan = scanMap.get(underlying);
      if (!scan) continue;

      // Parse aavescan values
      const [symbol, supplyUSDs, supplyAPRps, borrowUSDs, borrowAPRps] = scan.values;
      const scanSupplyUSD = toNum(supplyUSDs);
      const scanBorrowUSD = toNum(borrowUSDs);
      const scanSupplyAPR = toNum(supplyAPRps) / 100; // percent -> decimal
      const scanBorrowAPR = toNum(borrowAPRps) / 100;

      // Compute from AaveKit
      const priceUSD = new BigNumber(r.price.priceInEth).toNumber();
      const supplied = new BigNumber(r.totalATokenSupply).times(priceUSD).toNumber();
      const borrowed = new BigNumber(r.totalCurrentVariableDebt).times(priceUSD).toNumber();
      const supplyAPR = new BigNumber(r.currentLiquidityRate).toNumber();
      const borrowAPR = new BigNumber(r.currentVariableBorrowRate).toNumber();

      compared++;

      const okSupplyUSD = approxEqual(supplied, scanSupplyUSD, 0.01, 10); // 1% or $10
      const okBorrowUSD = approxEqual(borrowed, scanBorrowUSD, 0.01, 10);
      const okSupplyAPR = approxEqual(supplyAPR, scanSupplyAPR, 0.05, 0.0005); // 5% rel, 5 bps abs
      const okBorrowAPR = approxEqual(borrowAPR, scanBorrowAPR, 0.05, 0.0005);

      if (!(okSupplyUSD && okBorrowUSD && okSupplyAPR && okBorrowAPR)) {
        mismatches++;
        if (mismatches <= 10) {
          bad.push({
            marketKey,
            underlying,
            symbol: r.symbol,
            scanSymbol: symbol,
            scan: { supplyUSD: scanSupplyUSD, borrowUSD: scanBorrowUSD, supplyAPR: scanSupplyAPR, borrowAPR: scanBorrowAPR },
            aavekit: { supplyUSD: supplied, borrowUSD: borrowed, supplyAPR, borrowAPR },
          });
        }
      }
    }

    okSummary.push({
      marketKey,
      aavescanRows: scanRows.length,
      aavekitReserves: reserves.length,
      compared,
      mismatches,
    });
  }

  console.log("=== Summary ===");
  console.table(okSummary);

  if (bad.length > 0) {
    console.log("\n=== Sample mismatches / errors (first N) ===");
    for (const x of bad.slice(0, 25)) console.log(x);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

