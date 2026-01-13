import { describe, it, expect } from "vitest";
import {
  calculateLiquidityImpact,
  type ReserveParameters,
} from "@/lib/calculations/liquidity-impact";

describe("liquidity impact calculations", () => {
  const params: ReserveParameters = {
    optimalUtilization: 0.8,
    baseRate: 0.0,
    slope1: 0.04,
    slope2: 0.75,
  };

  it("should calculate impact for deposit", () => {
    const currentState = {
      borrowedUSD: 50,
      availableUSD: 50,
      supplyAPR: 0.02,
      borrowAPR: 0.04,
    };

    const impact = calculateLiquidityImpact(
      currentState,
      { action: "Deposit", amountUSD: 10 },
      params
    );

    expect(impact.newUtilization).toBeLessThan(currentState.borrowedUSD / (currentState.borrowedUSD + currentState.availableUSD));
    expect(impact.deltaUtilization).toBeLessThan(0);
  });

  it("should calculate impact for borrow", () => {
    const currentState = {
      borrowedUSD: 50,
      availableUSD: 50,
      supplyAPR: 0.02,
      borrowAPR: 0.04,
    };

    const impact = calculateLiquidityImpact(
      currentState,
      { action: "Borrow", amountUSD: 10 },
      params
    );

    expect(impact.newUtilization).toBeGreaterThan(currentState.borrowedUSD / (currentState.borrowedUSD + currentState.availableUSD));
    expect(impact.deltaUtilization).toBeGreaterThan(0);
  });
});
