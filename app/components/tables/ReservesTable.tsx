"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { normalizeAddress } from "@/lib/utils/address";
import { MicroBarChart, formatDelta30d } from "@/app/components/charts/MicroBarChart";
import { calculate30DayAPRSeries, calculate30DayAPRStats } from "@/lib/calculations/apr";

interface Reserve {
  underlyingAsset: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  currentState: {
    supplyAPR: number;
    borrowAPR: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    utilizationRate: number;
  };
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

interface ReservesTableProps {
  reserves: Reserve[];
  marketKey: string;
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

const columns = (marketKey: string): ColumnDef<Reserve>[] => [
  {
    accessorKey: "symbol",
    header: "Asset",
    cell: ({ row }) => {
      const reserve = row.original;
      let normalizedAddress: string;
      try {
        normalizedAddress = normalizeAddress(reserve.underlyingAsset);
      } catch (error) {
        // Fallback: use address as-is if normalization fails
        normalizedAddress = reserve.underlyingAsset.toLowerCase();
      }
      const assetUrl = `/${marketKey}/${normalizedAddress}`;
      return (
        <Link
          href={assetUrl}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer relative z-10"
        >
          {reserve.imageUrl && (
            <Image
              src={reserve.imageUrl}
              alt={reserve.symbol}
              width={24}
              height={24}
              className="rounded-full"
            />
          )}
          <div>
            <div className="font-medium">{reserve.symbol}</div>
            <div className="text-xs text-gray-500">{reserve.name}</div>
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "currentState.totalSuppliedUSD",
    header: "Supplied",
    cell: ({ row }) => formatUSD(row.original.currentState.totalSuppliedUSD),
  },
  {
    accessorKey: "currentState.totalBorrowedUSD",
    header: "Borrowed",
    cell: ({ row }) => formatUSD(row.original.currentState.totalBorrowedUSD),
  },
  {
    accessorKey: "currentState.supplyAPR",
    header: "Supply APR",
    cell: ({ row }) => formatPercent(row.original.currentState.supplyAPR),
  },
  {
    accessorKey: "currentState.borrowAPR",
    header: "Borrow APR",
    cell: ({ row }) => formatPercent(row.original.currentState.borrowAPR),
  },
  {
    accessorKey: "currentState.utilizationRate",
    header: "Utilization",
    cell: ({ row }) => formatPercent(row.original.currentState.utilizationRate),
  },
  {
    id: "30dAPR",
    header: "30d APR",
    cell: ({ row }) => {
      const reserve = row.original;
      const series = reserve.apr30dSeries;
      const stats = reserve.apr30dStats ?? (series ? calculate30DayAPRStats(series) : null);
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

export function ReservesTable({ reserves, marketKey }: ReservesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [reservesWithAPR, setReservesWithAPR] = useState<Reserve[]>(reserves);
  
  const tableColumns = columns(marketKey);

  // Load 30-day APR series for all reserves in one request (avoid N+1)
  useEffect(() => {
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    const cacheKey = `apr30d:${marketKey}`;
    const controller = new AbortController();

    const applySeries = (
      seriesByUnderlying: Record<string, Array<{ date: string; borrowAPR: number }>>,
      statsByUnderlying?: Record<string, any>
    ) => {
      const updated = reserves.map((reserve) => {
        const key = normalizeAddress(reserve.underlyingAsset);
        const series = seriesByUnderlying?.[key];
        const stats = statsByUnderlying ? (statsByUnderlying as any)[key] : undefined;
        return series ? { ...reserve, apr30dSeries: series, apr30dStats: stats ?? reserve.apr30dStats } : reserve;
      });
      setReservesWithAPR(updated);
    };

    const load = async () => {
      // Try session cache first
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              ts: number;
              seriesByUnderlying: Record<string, any>;
              statsByUnderlying?: Record<string, any>;
            };
            if (Date.now() - parsed.ts < CACHE_TTL_MS) {
              applySeries(parsed.seriesByUnderlying, parsed.statsByUnderlying);
              // Cache is fresh: skip background refresh to avoid re-rendering micro charts
              return;
            }
          } catch {
            // ignore
          }
        }
      }

      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const response = await fetch(`${baseUrl}/api/v1/market/${marketKey}/apr30d`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const json = await response.json();
        const seriesByUnderlying = (json?.seriesByUnderlying || {}) as Record<string, Array<{ date: string; borrowAPR: number }>>;
        const statsByUnderlying = (json?.statsByUnderlying || {}) as Record<string, any>;
        applySeries(seriesByUnderlying, statsByUnderlying);

        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), seriesByUnderlying, statsByUnderlying }));
          } catch {
            // ignore quota
          }
        }
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        console.warn("Failed to load bulk 30d APR series:", e);
      }
    };

    load();
    return () => controller.abort();
  }, [reserves, marketKey]);

  const table = useReactTable({
    data: reservesWithAPR,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
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
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
          {table.getRowModel().rows.map((row) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
