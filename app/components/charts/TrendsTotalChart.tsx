"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { MarketTrendsDataPoint } from "@/lib/calculations/trends";

interface TrendsTotalChartProps {
  data: MarketTrendsDataPoint[];
  mode: "supply" | "borrow";
}

export function TrendsTotalChart({ data, mode }: TrendsTotalChartProps) {
  const option = useMemo(() => {
    const dates = data.map((d) => d.date);
    const values = data.map((d) =>
      mode === "supply" ? d.totalSuppliedUSD : d.totalBorrowedUSD
    );

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        formatter: (params: any) => {
          const point = params[0];
          const dataPoint = data[point.dataIndex];
          return `
            <div>
              <div><strong>${point.axisValue}</strong></div>
              <div>${mode === "supply" ? "Total Supply" : "Total Borrowing"}: ${formatUSD(point.value)}</div>
              <div>Available Liquidity: ${formatUSD(dataPoint.availableLiquidityUSD)}</div>
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
        boundaryGap: false,
        data: dates,
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
          name: mode === "supply" ? "Total Supply" : "Total Borrowing",
          type: "line",
          smooth: true,
          data: values,
          areaStyle: {
            opacity: 0.3,
          },
          lineStyle: {
            width: 2,
          },
        },
      ],
    };
  }, [data, mode]);

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
