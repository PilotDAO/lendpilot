"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface MicroBarChartProps {
  data: Array<{ date: string; borrowAPR: number }>;
  stats: {
    last: number;
    min: number;
    max: number;
    delta30d: number;
    firstDate: string;
    lastDate: string;
  } | null;
  width?: number;
  height?: number;
}

export function MicroBarChart({
  data,
  stats,
  width = 100,
  height = 20,
}: MicroBarChartProps) {
  const option = useMemo(() => {
    // Require at least 2 data points (reduced from 7 for better UX)
    if (!data || data.length < 2 || !stats) {
      return null;
    }

    const values = data.map((d) => d.borrowAPR * 100); // Convert to percentage
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1; // Avoid division by zero

    // Create gradient colors based on value position in range
    const colors = values.map((value) => {
      const position = (value - minValue) / range;
      // Gradient from blue (min) to purple (max)
      const r = Math.floor(139 + (139 - 139) * position); // Purple
      const g = Math.floor(92 + (92 - 92) * position);
      const b = Math.floor(246 + (246 - 246) * position);
      return `rgb(${r}, ${g}, ${b})`;
    });

    return {
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        show: false,
      },
      yAxis: {
        type: "value",
        show: false,
        min: minValue,
        max: maxValue,
      },
      series: [
        {
          type: "bar",
          data: values.map((value, index) => ({
            value,
            itemStyle: {
              color: colors[index],
            },
          })),
          barWidth: "100%",
          barGap: 0,
          barCategoryGap: 0,
        },
      ],
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          if (!stats) return "";
          const param = params[0];
          const date = param.axisValue;
          const value = param.value;
          return `
            <div style="padding: 4px;">
              <div><strong>Date:</strong> ${date}</div>
              <div><strong>Borrow APR:</strong> ${value.toFixed(4)}%</div>
              <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 4px;">
                <div><strong>Last:</strong> ${(stats.last * 100).toFixed(4)}%</div>
                <div><strong>Min:</strong> ${(stats.min * 100).toFixed(4)}%</div>
                <div><strong>Max:</strong> ${(stats.max * 100).toFixed(4)}%</div>
                <div><strong>Δ30d:</strong> ${stats.delta30d >= 0 ? "+" : ""}${(stats.delta30d * 100).toFixed(4)}%</div>
                <div style="margin-top: 4px; font-size: 11px; color: #666;">
                  ${stats.firstDate} → ${stats.lastDate}
                </div>
              </div>
            </div>
          `;
        },
      },
    };
  }, [data, stats]);

  // Require at least 2 data points (reduced from 7 for better UX)
  if (!data || data.length < 2 || !stats) {
    return (
      <div
        style={{ width: `${width}px`, height: `${height}px` }}
        className="flex items-center justify-center text-xs text-gray-400"
      >
        Insufficient data
      </div>
    );
  }

  return (
    <div style={{ width: `${width}px`, height: `${height}px` }}>
      <ReactECharts
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg", width, height }}
      />
    </div>
  );
}

/**
 * Format delta30d as percentage with color
 */
export function formatDelta30d(delta30d: number): { text: string; color: string } {
  const isPositive = delta30d >= 0;
  const sign = isPositive ? "+" : "";
  const text = `${sign}${(delta30d * 100).toFixed(2)}%`;
  const color = isPositive ? "text-green-500" : "text-red-500";
  return { text, color };
}
