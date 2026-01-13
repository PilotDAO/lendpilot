"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { AssetTrendsData } from "@/lib/calculations/trends";

interface TrendsChangesTableProps {
  data: AssetTrendsData[];
  mode: "supply" | "borrow";
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

function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatChangeUSD(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatUSD(Math.abs(value))}`;
}

const columns = (mode: "supply" | "borrow"): ColumnDef<AssetTrendsData>[] => [
  {
    accessorKey: "symbol",
    header: "Asset",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.symbol}</div>
        <div className="text-xs text-gray-500">{row.original.name}</div>
      </div>
    ),
  },
  {
    accessorKey: mode === "supply" ? "currentSuppliedUSD" : "currentBorrowedUSD",
    header: mode === "supply" ? "Current Supplied" : "Current Borrowed",
    cell: ({ row }) =>
      formatUSD(
        mode === "supply"
          ? row.original.currentSuppliedUSD
          : row.original.currentBorrowedUSD
      ),
  },
  {
    id: "change1d",
    header: "Change (1d)",
    cell: ({ row }) => {
      const change = mode === "supply" ? row.original.change1d?.suppliedPercent : row.original.change1d?.borrowedPercent;
      if (!change) return <span className="text-gray-400">-</span>;
      const color = change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
      return <span className={color}>{formatChange(change)}</span>;
    },
  },
  {
    id: "change7d",
    header: "Change (7d)",
    cell: ({ row }) => {
      const change = mode === "supply" ? row.original.change7d?.suppliedPercent : row.original.change7d?.borrowedPercent;
      if (!change) return <span className="text-gray-400">-</span>;
      const color = change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
      return <span className={color}>{formatChange(change)}</span>;
    },
  },
  {
    id: "change30d",
    header: "Change (30d)",
    cell: ({ row }) => {
      const change = mode === "supply" ? row.original.change30d?.suppliedPercent : row.original.change30d?.borrowedPercent;
      if (!change) return <span className="text-gray-400">-</span>;
      const color = change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
      return <span className={color}>{formatChange(change)}</span>;
    },
  },
];

export function TrendsChangesTable({ data, mode }: TrendsChangesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: mode === "supply" ? "currentSuppliedUSD" : "currentBorrowedUSD",
      desc: true,
    },
  ]);

  const table = useReactTable({
    data,
    columns: columns(mode),
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
                colSpan={columns(mode).length}
                className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                No data available
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
  );
}
