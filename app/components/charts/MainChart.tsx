"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

export type ChartMetric =
  | "supplyAPR"
  | "borrowAPR"
  | "suppliedUSD"
  | "borrowedUSD"
  | "utilization"
  | "price";

interface MainChartProps {
  data: Array<{
    date: string;
    supplyAPR: number;
    borrowAPR: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    utilizationRate: number;
    price: number;
  }>;
  metric: ChartMetric;
  onMetricChange: (metric: ChartMetric) => void;
}

const metricLabels: Record<ChartMetric, string> = {
  supplyAPR: "Supply APR",
  borrowAPR: "Borrow APR",
  suppliedUSD: "Supplied",
  borrowedUSD: "Borrowed",
  utilization: "Utilization",
  price: "Price",
};

const metricIcons: Record<ChartMetric, string> = {
  supplyAPR: "📈",
  borrowAPR: "📉",
  suppliedUSD: "💰",
  borrowedUSD: "💸",
  utilization: "📊",
  price: "💵",
};

export function MainChart({ data, metric, onMetricChange }: MainChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => {
      let value: number;
      switch (metric) {
        case "supplyAPR":
          value = item.supplyAPR * 100;
          break;
        case "borrowAPR":
          value = item.borrowAPR * 100;
          break;
        case "suppliedUSD":
          value = item.totalSuppliedUSD;
          break;
        case "borrowedUSD":
          value = item.totalBorrowedUSD;
          break;
        case "utilization":
          value = item.utilizationRate * 100;
          break;
        case "price":
          value = item.price;
          break;
        default:
          value = 0;
      }
      return [item.date, value];
    });
  }, [data, metric]);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderColor: "transparent",
        textStyle: {
          color: "#fff",
        },
      },
      xAxis: {
        type: "category",
        data: data.map((item) => item.date),
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          color: "#6B7280",
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
          fontSize: 11,
          color: "#6B7280",
        },
        splitLine: {
          lineStyle: {
            color: "#F3F4F6",
            type: "dashed",
          },
        },
      },
      series: [
        {
          name: metricLabels[metric],
          type: "line",
          data: chartData.map((item) => item[1]),
          smooth: true,
          lineStyle: {
            width: 2,
            color: metric === "supplyAPR" ? "#10B981" : metric === "borrowAPR" ? "#F59E0B" : "#3B82F6",
          },
          areaStyle: {
            opacity: 0.15,
            color: metric === "supplyAPR" ? "#10B981" : metric === "borrowAPR" ? "#F59E0B" : "#3B82F6",
          },
          symbol: "circle",
          symbolSize: 4,
        },
      ],
      grid: {
        left: "3%",
        right: "4%",
        bottom: "12%",
        top: "10%",
        containLabel: true,
      },
    }),
    [chartData, data, metric]
  );

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(metricLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onMetricChange(key as ChartMetric)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                metric === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {metricIcons[key as ChartMetric]} {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          Insufficient data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Compact Button Group */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(metricLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onMetricChange(key as ChartMetric)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              metric === key
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {metricIcons[key as ChartMetric]} {label}
          </button>
        ))}
      </div>
      <ReactECharts option={option} style={{ height: "320px", width: "100%" }} />
    </div>
  );
}
