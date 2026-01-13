"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { AssetTrendsData } from "@/lib/calculations/trends";

interface TrendsByAssetChartProps {
  assets: AssetTrendsData[];
  mode: "supply" | "borrow";
  limit?: number; // Limit number of assets to show
}

export function TrendsByAssetChart({
  assets,
  mode,
  limit = 10,
}: TrendsByAssetChartProps) {
  const option = useMemo(() => {
    // Sort by current value and take top N
    const sorted = [...assets].sort((a, b) => {
      const aValue = mode === "supply" ? a.currentSuppliedUSD : a.currentBorrowedUSD;
      const bValue = mode === "supply" ? b.currentSuppliedUSD : b.currentBorrowedUSD;
      return bValue - aValue;
    });

    const topAssets = sorted.slice(0, limit);
    const symbols = topAssets.map((a) => a.symbol);
    const values = topAssets.map((a) =>
      mode === "supply" ? a.currentSuppliedUSD : a.currentBorrowedUSD
    );

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          const point = params[0];
          const asset = topAssets[point.dataIndex];
          return `
            <div>
              <div><strong>${asset.symbol}</strong> - ${asset.name}</div>
              <div>${mode === "supply" ? "Supplied" : "Borrowed"}: ${formatUSD(point.value)}</div>
            </div>
          `;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: symbols,
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: (value: number) => formatUSD(value),
        },
      },
      series: [
        {
          name: mode === "supply" ? "Supplied" : "Borrowed",
          type: "bar",
          data: values,
          itemStyle: {
            color: mode === "supply" ? "#3b82f6" : "#ef4444",
          },
        },
      ],
    };
  }, [assets, mode, limit]);

  return (
    <div className="w-full h-96">
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
    </div>
  );
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
