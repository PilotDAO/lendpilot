"use client";

import ReactECharts from "echarts-for-react";

interface LiquidityImpactChartProps {
  results: Array<{
    scenario: {
      action: "Deposit" | "Borrow" | "Repay" | "Withdraw";
      amountUSD: number;
    };
    impact: {
      newUtilization: number;
      newSupplyAPR: number;
      newBorrowAPR: number;
    };
  }>;
}

export function LiquidityImpactChart({ results }: LiquidityImpactChartProps) {
  const option = {
    title: {
      text: "Liquidity Impact Curve",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
    },
    legend: {
      data: ["Supply APR", "Borrow APR"],
      top: 30,
    },
    xAxis: {
      type: "value",
      name: "Utilization Rate (%)",
      min: 0,
      max: 100,
    },
    yAxis: {
      type: "value",
      name: "APR (%)",
    },
    series: [
      {
        name: "Supply APR",
        type: "line",
        data: results.map((r) => [
          r.impact.newUtilization * 100,
          r.impact.newSupplyAPR * 100,
        ]),
        smooth: true,
      },
      {
        name: "Borrow APR",
        type: "line",
        data: results.map((r) => [
          r.impact.newUtilization * 100,
          r.impact.newBorrowAPR * 100,
        ]),
        smooth: true,
      },
    ],
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <ReactECharts option={option} style={{ height: "300px", width: "100%" }} />
    </div>
  );
}
