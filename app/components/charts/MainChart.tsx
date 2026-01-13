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
  supplyAPR: "Supply APR (%)",
  borrowAPR: "Borrow APR (%)",
  suppliedUSD: "Supplied (USD)",
  borrowedUSD: "Borrowed (USD)",
  utilization: "Utilization Rate (%)",
  price: "Price (USD)",
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
      title: {
        text: metricLabels[metric],
        left: "center",
        textStyle: {
          color: "#374151",
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
      },
      xAxis: {
        type: "category",
        data: data.map((item) => item.date),
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          name: metricLabels[metric],
          type: "line",
          data: chartData.map((item) => item[1]),
          smooth: true,
          areaStyle: {
            opacity: 0.3,
          },
        },
      ],
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        containLabel: true,
      },
    }),
    [chartData, data, metric]
  );

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as ChartMetric)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          Insufficient data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <select
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as ChartMetric)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {Object.entries(metricLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <ReactECharts option={option} style={{ height: "400px", width: "100%" }} />
    </div>
  );
}
