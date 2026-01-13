"use client";

import { useState } from "react";
import { MainChart, type ChartMetric } from "./MainChart";

interface MainChartWrapperProps {
  data: Array<{
    date: string;
    supplyAPR: number;
    borrowAPR: number;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    utilizationRate: number;
    price: number;
  }>;
}

export function MainChartWrapper({ data }: MainChartWrapperProps) {
  const [metric, setMetric] = useState<ChartMetric>("supplyAPR");

  return (
    <MainChart
      data={data}
      metric={metric}
      onMetricChange={setMetric}
    />
  );
}
