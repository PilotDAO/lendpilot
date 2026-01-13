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

  // Calculate min/max for better Y-axis scaling to show changes more clearly
  const values = chartData.map((item) => item[1] as number);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  
  // For better visualization of changes, don't start from 0 if values are far from 0
  // Use smart scaling: start from min - 10% of range, end at max + 10% of range
  // But for rates (APR, utilization), always include 0
  const shouldIncludeZero = metric === "supplyAPR" || metric === "borrowAPR" || metric === "utilization";
  const yAxisMin = shouldIncludeZero 
    ? Math.min(0, minValue - range * 0.1)
    : minValue - range * 0.1;
  const yAxisMax = maxValue + range * 0.1;
  
  // Calculate percentage change from first to last value for display
  const firstValue = values.length > 0 ? values[0] : 0;
  const lastValue = values.length > 0 ? values[values.length - 1] : 0;
  
  // Calculate percentage change - handle edge cases properly
  let percentChange = 0;
  if (values.length > 1 && firstValue !== lastValue) {
    if (Math.abs(firstValue) > 0.0001) {
      // Normal case: calculate percentage change
      percentChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
    } else if (Math.abs(firstValue) <= 0.0001 && Math.abs(lastValue) > 0.0001) {
      // Starting from near-zero: show as significant change
      percentChange = lastValue > 0 ? 100 : -100;
    }
    // If both are effectively 0, percentChange stays 0
  }

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
          },
        },
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        borderColor: "transparent",
        borderWidth: 0,
        padding: [8, 12],
        textStyle: {
          color: "#fff",
          fontSize: 12,
        },
        formatter: (params: any) => {
          const point = params[0];
          const value = point.value;
          const date = point.axisValue;
          
          // Format value based on metric type
          let formattedValue: string;
          if (metric === "supplyAPR" || metric === "borrowAPR" || metric === "utilization") {
            formattedValue = `${value.toFixed(2)}%`;
          } else if (metric === "suppliedUSD" || metric === "borrowedUSD") {
            if (value >= 1e9) {
              formattedValue = `$${(value / 1e9).toFixed(2)}B`;
            } else if (value >= 1e6) {
              formattedValue = `$${(value / 1e6).toFixed(2)}M`;
            } else if (value >= 1e3) {
              formattedValue = `$${(value / 1e3).toFixed(2)}K`;
            } else {
              formattedValue = `$${value.toFixed(2)}`;
            }
          } else {
            formattedValue = value.toFixed(4);
          }
          
          return `
            <div style="margin-bottom: 4px;">
              <strong>${date}</strong>
            </div>
            <div>
              ${metricLabels[metric]}: <strong>${formattedValue}</strong>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((item) => item.date),
        boundaryGap: false,
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          color: "#6B7280",
          formatter: (value: string) => {
            // Format date more compactly
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          },
        },
        axisLine: {
          lineStyle: {
            color: "#E5E7EB",
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: "value",
        min: yAxisMin,
        max: yAxisMax,
        scale: range > 0 && range < maxValue * 0.1, // Use scale for small ranges
        axisLabel: {
          fontSize: 11,
          color: "#6B7280",
          formatter: (value: number) => {
            if (metric === "supplyAPR" || metric === "borrowAPR" || metric === "utilization") {
              return `${value.toFixed(1)}%`;
            } else if (metric === "suppliedUSD" || metric === "borrowedUSD") {
              if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
              if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
              if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
              return `$${value.toFixed(0)}`;
            }
            return value.toFixed(2);
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "#F9FAFB",
            type: "dashed",
            width: 1,
            opacity: 0.5,
          },
        },
        axisLine: {
          show: false,
        },
      },
      series: [
        {
          name: metricLabels[metric],
          type: "line",
          data: chartData.map((item) => item[1]),
          smooth: true,
          lineStyle: {
            width: 3,
            color: metric === "supplyAPR" ? "#10B981" : metric === "borrowAPR" ? "#F59E0B" : "#3B82F6",
          },
          areaStyle: {
            opacity: 0.45,
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: metric === "supplyAPR" 
                    ? "rgba(16, 185, 129, 0.7)" 
                    : metric === "borrowAPR" 
                    ? "rgba(245, 158, 11, 0.7)" 
                    : "rgba(59, 130, 246, 0.7)",
                },
                {
                  offset: 1,
                  color: metric === "supplyAPR" 
                    ? "rgba(16, 185, 129, 0.2)" 
                    : metric === "borrowAPR" 
                    ? "rgba(245, 158, 11, 0.2)" 
                    : "rgba(59, 130, 246, 0.2)",
                },
              ],
            },
          },
          symbol: "circle",
          symbolSize: 6,
          emphasis: {
            focus: "series",
            itemStyle: {
              borderWidth: 2,
              borderColor: "#fff",
            },
          },
          markPoint: data.length > 1 ? {
            data: [
              {
                type: "max",
                name: "Max",
                symbol: "pin",
                symbolSize: 50,
                label: {
                  show: true,
                  formatter: "Max",
                  fontSize: 10,
                },
              },
              {
                type: "min",
                name: "Min",
                symbol: "pin",
                symbolSize: 50,
                label: {
                  show: true,
                  formatter: "Min",
                  fontSize: 10,
                },
              },
            ],
          } : undefined,
        },
      ],
      grid: {
        left: "8%",
        right: "4%",
        bottom: "15%",
        top: "15%",
        containLabel: true,
      },
      dataZoom: data.length > 30 ? [
        {
          type: "inside",
          start: Math.max(0, 100 - (30 / data.length) * 100),
          end: 100,
        },
        {
          type: "slider",
          start: Math.max(0, 100 - (30 / data.length) * 100),
          end: 100,
          height: 20,
          bottom: "5%",
        },
      ] : undefined,
    }),
    [chartData, data, metric, yAxisMin, yAxisMax, range]
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

  // Use already calculated percentChange
  const isPositive = percentChange >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header with change indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap gap-2">
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
        {data.length > 1 && !isNaN(percentChange) && isFinite(percentChange) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Change:</span>
            <span className={`font-semibold ${isPositive && percentChange > 0 ? "text-green-600 dark:text-green-400" : percentChange < 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>
              {isPositive && percentChange > 0 ? "↑" : percentChange < 0 ? "↓" : "→"} {Math.abs(percentChange).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      <ReactECharts option={option} style={{ height: "400px", width: "100%" }} />
    </div>
  );
}
