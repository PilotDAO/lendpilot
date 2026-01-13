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
              src={item.imageUrl}
              alt={item.symbol}
              width={24}
              height={24}
              className="rounded-full"
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
    cell: ({ row }) => row.original.marketName,
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
      const stats = series ? calculate30DayAPRStats(series) : null;
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

  // Load 30-day APR series for each stablecoin-market combination (lazy loading)
  // Load sequentially to avoid overwhelming the server with parallel requests
  useEffect(() => {
    const loadAPRSeries = async () => {
      const updatedRows = [...initialRows];
      
      // Load sequentially with small delay to avoid overwhelming the server
      for (let i = 0; i < updatedRows.length; i++) {
        const row = updatedRows[i];
        
        if (row.apr30dSeries) {
          continue; // Already loaded
        }

        try {
          const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
          // Normalize address before making request
          const normalizedAddress = normalizeAddress(row.address);
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 65000); // 65 seconds
          
          const response = await fetch(
            `${baseUrl}/api/v1/reserve/${row.marketKey}/${normalizedAddress}/snapshots/daily`,
            {
              signal: controller.signal,
            }
          );
          
          clearTimeout(timeoutId);

          if (response.ok) {
            const snapshots = await response.json();
            
            // Check if we have enough snapshots
            if (!snapshots || snapshots.length === 0) {
              console.debug(`No snapshots for ${row.symbol} in ${row.marketKey}`);
              continue;
            }

            const series = calculate30DayAPRSeries(
              snapshots.map((s: any) => ({
                date: s.date,
                borrowAPR: s.borrowAPR,
                timestamp: s.timestamp,
              }))
            );

            // Log if series is empty (insufficient data)
            if (!series || series.length === 0) {
              console.debug(`Insufficient data for 30d APR series for ${row.symbol} in ${row.marketKey}: ${snapshots.length} snapshots, ${snapshots.filter((s: any) => s.borrowAPR > 0).length} with valid APR`);
            } else {
              // Update the row with series
              updatedRows[i] = { ...row, apr30dSeries: series };
              // Update state incrementally to show progress
              setRows([...updatedRows]);
            }
          } else {
            // Log error with status and response
            let errorText = "";
            try {
              errorText = await response.text();
            } catch {
              errorText = "Could not read error response";
            }
            console.warn(
              `Failed to fetch snapshots for ${row.symbol} in ${row.marketKey}: ${response.status} ${response.statusText}`,
              errorText ? ` - ${errorText.substring(0, 200)}` : ""
            );
          }
        } catch (error) {
          if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
            console.warn(`Request timeout for ${row.symbol} in ${row.marketKey} (snapshot generation may take > 60s)`);
          } else {
            console.warn(`Failed to load APR series for ${row.symbol} in ${row.marketKey}:`, error);
          }
        }
        
        // Small delay between requests to avoid overwhelming the server
        if (i < updatedRows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    };

    loadAPRSeries();
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
      <div className="overflow-x-auto">
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
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
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
