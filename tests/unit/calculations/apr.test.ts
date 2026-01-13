import { describe, it, expect } from "vitest";
import { calculateAPRFromIndices, calculateAverageLendingRates } from "@/lib/calculations/apr";

describe("APR calculations", () => {
  it("should calculate APR from indices", () => {
    // Test with known values - 1% daily growth over 365 days
    // If index grows 1% per day for 365 days: (1.01)^365 ≈ 37.78
    // But we test with smaller growth: 0.1% per day
    const indexStart = "1000000000000000000000000000"; // 1e27
    const indexEnd = "1001000000000000000000000000"; // 1.001e27 (0.1% growth per day)
    const days = 1; // 1 day

    const apr = calculateAPRFromIndices(indexStart, indexEnd, days);
    // Daily growth of 0.1% = 0.001, APR = (0.001) * 365 = 0.365 = 36.5%
    expect(apr).toBeCloseTo(0.365, 1);
  });

  it("should return 0 for zero index", () => {
    const apr = calculateAPRFromIndices("0", "1000000000000000000000000000", 365);
    expect(apr).toBe(0);
  });

  it("should calculate average lending rates", () => {
    const snapshots = [
      {
        liquidityIndex: "1000000000000000000000000000",
        variableBorrowIndex: "1000000000000000000000000000",
        timestamp: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
      },
      {
        liquidityIndex: "1010000000000000000000000000",
        variableBorrowIndex: "1010000000000000000000000000",
        timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
      },
      {
        liquidityIndex: "1020000000000000000000000000",
        variableBorrowIndex: "1020000000000000000000000000",
        timestamp: Math.floor(Date.now() / 1000), // now
      },
    ];

    const rates = calculateAverageLendingRates(snapshots);
    expect(rates["1d"]).toBeDefined();
    expect(rates["7d"]).toBeDefined();
    expect(rates["30d"]).toBeDefined();
  });
});
