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
    // 
    // Visual representation:
    // - Green bar (bottom) = availableLiquidityUSD (available to borrow)
    // - Orange bar (top, stacked) = totalBorrowedUSD (already borrowed)
    // - Blue line = totalSuppliedUSD (total deposits/supply)
    // Relationship: Supply = Available Liquidity + Borrowing
    const availableData = data.map((d) => d.availableLiquidityUSD);
    const borrowingData = data.map((d) => d.totalBorrowedUSD);
    const supplyData = data.map((d) => d.totalSuppliedUSD);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          const date = params[0].axisValue;
          const dataPoint = data.find((d) => d.date === date);
          let result = `<div style="padding: 4px;"><strong>${date}</strong><br/>`;
          
          // Show individual components
          params.forEach((param: any) => {
            result += `${param.seriesName}: ${formatUSD(param.value)}<br/>`;
          });
          
          if (dataPoint) {
            result += `<hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;"/>`;
            result += `<strong>Total Supply: ${formatUSD(dataPoint.totalSuppliedUSD)}</strong><br/>`;
            result += `(Available + Borrowing = Total Supply)</div>`;
          } else {
            result += `</div>`;
          }
          
          return result;
        },
      },
      legend: {
        data: ["Supply", "Available Liquidity", "Borrowing"],
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
          name: "Available Liquidity",
          type: "bar",
          stack: "totals",
          data: availableData,
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
        {
          name: "Supply",
          type: "line",
          data: supplyData,
          itemStyle: {
            color: "#3B82F6", // Blue
          },
          lineStyle: {
            width: 3,
          },
          symbol: "circle",
          symbolSize: 6,
          // Show Supply as a line on top of the stacked bars
          // This represents total deposits (Available + Borrowing)
          z: 10, // Higher z-index to appear on top
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
