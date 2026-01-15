"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { normalizeAddress } from "@/lib/utils/address";
import { AggregatedStablecoinData } from "@/lib/calculations/stablecoins";
import { MicroBarChart, formatDelta30d } from "@/app/components/charts/MicroBarChart";
import { calculate30DayAPRSeries, calculate30DayAPRStats } from "@/lib/calculations/apr";
import { getChainLogoUrl, getChainName } from "@/lib/utils/chain-logo";

interface StablecoinsTableProps {
  data: AggregatedStablecoinData[];
}

function formatUSD(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// Flatten aggregated data for table display
interface StablecoinRow {
  symbol: string;
  address: string;
  marketKey: string;
  marketName: string;
  suppliedTokens: string;
  borrowedTokens: string;
  supplyAPR: number;
  borrowAPR: number;
  utilizationRate: number;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  imageUrl?: string;
  name: string;
  apr30dSeries?: Array<{ date: string; borrowAPR: number }>;
  apr30dStats?: {
    last: number;
    min: number;
    max: number;
    delta30d: number;
    firstDate: string;
    lastDate: string;
  } | null;
}

const columns: ColumnDef<StablecoinRow>[] = [
  {
    accessorKey: "symbol",
    header: "Asset",
    cell: ({ row }) => {
      const item = row.original;
      let normalizedAddress: string;
      try {
        normalizedAddress = normalizeAddress(item.address);
      } catch (error) {
        // Fallback: use address as-is if normalization fails
        normalizedAddress = item.address.toLowerCase();
      }
      const assetUrl = `/${item.marketKey}/${normalizedAddress}`;
      return (
        <Link
          href={assetUrl}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer relative z-10"
        >
          {item.imageUrl && (
            <Image
              src={`/api/v1/asset-icon/${item.marketKey}/${normalizedAddress}`}
              alt={item.symbol}
              width={24}
              height={24}
              className="rounded-full"
              unoptimized
              loading="lazy"
              onError={(e) => {
                // Hide image if it fails to load
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div>
            <div className="font-medium">{item.symbol}</div>
            <div className="text-xs text-gray-500">{item.name}</div>
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "marketKey",
    header: "Market",
    cell: ({ row }) => {
      const item = row.original;
      const marketUrl = `/${item.marketKey}`;
      const chainLogoUrl = getChainLogoUrl(item.marketKey);
      const chainName = getChainName(item.marketKey);

      // Format market name: remove "Aave", move "V3" to end with space
      // Example: "AaveV3Ethereum" -> "Ethereum V3"
      // Example: "AaveV3EthereumEtherFi" -> "Ethereum EtherFi V3"
      let formattedMarketName = item.marketName
        .replace(/^Aave\s*/i, "") // Remove Aave from start
        .replace(/\s*Aave\s*/i, " ") // Remove Aave from middle
        .trim();
      
      // Remove V3 from anywhere
      const hasV3 = /V3/i.test(formattedMarketName);
      formattedMarketName = formattedMarketName
        .replace(/\s*V3\s*/i, "") // Remove V3 from anywhere
        .trim();
      
      // Add spaces before capital letters (camelCase to Words)
      // Example: "EthereumEtherFi" -> "Ethereum EtherFi"
      formattedMarketName = formattedMarketName.replace(/([a-z])([A-Z])/g, "$1 $2");
      
      // Add V3 at the end if it was present or if marketKey suggests V3
      if (hasV3 || item.marketKey.includes("-v3")) {
        formattedMarketName = formattedMarketName + " V3";
      }

      return (
        <Link
          href={marketUrl}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
        >
          {/* Aave logo with tooltip */}
          <div className="relative group flex-shrink-0">
            <Image
              src="/aave-logo.svg"
              alt="Aave"
              width={16}
              height={10}
              className="inline-block"
              style={{
                width: "16px",
                height: "10px",
                display: "inline-block",
              }}
            />
            {/* Tooltip on hover */}
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              Aave
            </span>
          </div>
          {/* Chain logo */}
          {chainLogoUrl ? (
            <Image
              src={chainLogoUrl}
              alt={chainName}
              width={16}
              height={16}
              className="rounded-full flex-shrink-0"
              style={{
                width: "16px",
                height: "16px",
                display: "inline-block",
              }}
              unoptimized
              onError={(e) => {
                // Hide image if it fails to load
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          {/* Market name text formatted */}
          <span className="text-sm whitespace-nowrap">{formattedMarketName}</span>
        </Link>
      );
    },
  },
  {
    accessorKey: "totalSuppliedUSD",
    header: "Supplied",
    cell: ({ row }) => formatUSD(row.original.totalSuppliedUSD),
  },
  {
    accessorKey: "totalBorrowedUSD",
    header: "Borrowed",
    cell: ({ row }) => formatUSD(row.original.totalBorrowedUSD),
  },
  {
    accessorKey: "supplyAPR",
    header: "Supply APR",
    cell: ({ row }) => formatPercent(row.original.supplyAPR),
  },
  {
    accessorKey: "borrowAPR",
    header: "Borrow APR",
    cell: ({ row }) => formatPercent(row.original.borrowAPR),
  },
  {
    accessorKey: "utilizationRate",
    header: "Utilization",
    cell: ({ row }) => formatPercent(row.original.utilizationRate),
  },
  {
    id: "30dAPR",
    header: "30d APR",
    cell: ({ row }) => {
      const item = row.original;
      const series = item.apr30dSeries;
      const stats = item.apr30dStats ?? (series ? calculate30DayAPRStats(series) : null);
      const delta = stats ? formatDelta30d(stats.delta30d) : null;

      return (
        <div className="flex items-center gap-2">
          <MicroBarChart data={series || []} stats={stats} width={100} height={20} />
          {delta && (
            <span className={`text-xs font-medium ${delta.color}`}>
              {delta.text}
            </span>
          )}
        </div>
      );
    },
  },
];

export function StablecoinsTable({ data }: StablecoinsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "totalSuppliedUSD", desc: true },
  ]);
  const [marketFilter, setMarketFilter] = useState<string>("all");

  // Flatten aggregated data: one row per stablecoin-market combination
  const initialRows: StablecoinRow[] = useMemo(() => {
    return data.flatMap((stablecoin) =>
      stablecoin.markets.map((market) => ({
        symbol: stablecoin.symbol,
        address: stablecoin.address,
        marketKey: market.marketKey,
        marketName: market.marketName,
        suppliedTokens: market.suppliedTokens,
        borrowedTokens: market.borrowedTokens,
        supplyAPR: market.supplyAPR,
        borrowAPR: market.borrowAPR,
        utilizationRate: market.utilizationRate,
        totalSuppliedUSD: market.totalSuppliedUSD,
        totalBorrowedUSD: market.totalBorrowedUSD,
        imageUrl: stablecoin.imageUrl,
        name: stablecoin.name,
      }))
    );
  }, [data]);

  const [rows, setRows] = useState<StablecoinRow[]>(initialRows);

  // Load 30-day APR series for all stablecoin-market rows in one request (avoid N+1 / sequential waterfall)
  useEffect(() => {
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const cacheKey = `apr30d:stablecoins`;
    const controller = new AbortController();

    const applyBulk = (payload: any) => {
      const seriesByKey = (payload?.seriesByKey || {}) as Record<string, Array<{ date: string; borrowAPR: number }>>;
      const statsByKey = (payload?.statsByKey || {}) as Record<string, any>;
      const updated = initialRows.map((row) => {
        const key = `${row.marketKey}:${normalizeAddress(row.address)}`;
        const series = seriesByKey[key];
        const stats = statsByKey[key];
        return series ? { ...row, apr30dSeries: series, apr30dStats: stats ?? null } : row;
      });
      setRows(updated);
    };

    const load = async () => {
      // cache
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { ts: number; payload: any };
            if (Date.now() - parsed.ts < CACHE_TTL_MS) {
              applyBulk(parsed.payload);
              // Cache is fresh: skip background refresh to avoid re-rendering micro charts
              return;
            }
          } catch {}
        }
      }

      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const items = initialRows.map((r) => ({ marketKey: r.marketKey, underlying: normalizeAddress(r.address) }));
        const resp = await fetch(`${baseUrl}/api/v1/apr30d/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          signal: controller.signal,
        });
        if (!resp.ok) return;
        const payload = await resp.json();
        applyBulk(payload);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload }));
          } catch {}
        }
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        console.warn("Failed to load stablecoins bulk 30d APR:", e);
      }
    };

    load();
    return () => controller.abort();
  }, [initialRows]);

  // Get unique markets for filter
  const uniqueMarkets = useMemo(() => {
    const markets = new Set<string>();
    data.forEach((stablecoin) => {
      stablecoin.markets.forEach((market) => {
        markets.add(market.marketKey);
      });
    });
    return Array.from(markets).sort();
  }, [data]);

  // Filter rows before passing to table
  const filteredRows = useMemo(() => {
    if (marketFilter === "all") {
      return rows;
    }
    return rows.filter((row) => row.marketKey === marketFilter);
  }, [rows, marketFilter]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });


  return (
    <div className="space-y-4">
      {/* Market Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Market:
        </label>
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Markets</option>
          {uniqueMarkets.map((marketKey) => (
            <option key={marketKey} value={marketKey}>
              {marketKey}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="relative z-10 isolate overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() && (
                        <span>
                          {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No stablecoins found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 group-hover:bg-gray-50 dark:group-hover:bg-gray-800"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
