"use client";

import { useMemo, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { formatUSD, formatNumber } from "@/lib/utils/format";

interface MarketTotalsChartProps {
  data: Array<{
    date: string;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    availableLiquidityUSD: number;
  }>;
}

export function MarketTotalsChart({ data }: MarketTotalsChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          const instance = chartRef.current.getEchartsInstance();
          if (instance && typeof instance.dispose === "function") {
            instance.dispose();
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  const option = useMemo(() => {
    const dates = data.map((d) => d.date);
    // Stacked bar chart showing:
    // - Bottom (green): Available liquidity (what can be borrowed)
    // - Top (orange): Borrowed amount
    // - Total height = Total Supply (availableLiquidity + borrowed = totalSupplied)
    // Note: totalSuppliedUSD = availableLiquidityUSD + totalBorrowedUSD
    const supplyData = data.map((d) => d.availableLiquidityUSD);
    const borrowingData = data.map((d) => d.totalBorrowedUSD);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          const date = params[0].axisValue;
          let result = `<div style="padding: 4px;"><strong>${date}</strong><br/>`;
          let totalSupply = 0;
          params.forEach((param: any) => {
            result += `${param.seriesName}: ${formatUSD(param.value)}<br/>`;
            totalSupply += param.value;
          });
          result += `<hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;"/>`;
          result += `<strong>Total Supply: ${formatUSD(totalSupply)}</strong></div>`;
          return result;
        },
      },
      legend: {
        data: ["Supply", "Borrowing"],
        top: 10,
        textStyle: {
          color: "#6B7280",
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: {
          color: "#6B7280",
          rotate: 45,
        },
        axisLine: {
          lineStyle: {
            color: "#E5E7EB",
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#6B7280",
          formatter: (value: number) => formatNumber(value),
        },
        axisLine: {
          lineStyle: {
            color: "#E5E7EB",
          },
        },
        splitLine: {
          lineStyle: {
            color: "#F3F4F6",
          },
        },
      },
      series: [
        {
          name: "Supply",
          type: "bar",
          stack: "totals",
          data: supplyData,
          itemStyle: {
            color: "#10B981", // Green
          },
        },
        {
          name: "Borrowing",
          type: "bar",
          stack: "totals",
          data: borrowingData,
          itemStyle: {
            color: "#F59E0B", // Amber
          },
        },
      ],
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Insufficient data
      </div>
    );
  }

  return (
    <div className="w-full">
      <ReactECharts 
        ref={chartRef}
        option={option} 
        style={{ height: "300px", width: "100%" }} 
      />
    </div>
  );
}
