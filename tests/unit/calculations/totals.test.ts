import { describe, it, expect } from "vitest";
import {
  priceToUSD,
  calculateTotalSuppliedUSD,
  calculateTotalBorrowedUSD,
  calculateMarketTotals,
} from "@/lib/calculations/totals";

describe("totals calculations", () => {
  it("should convert usdExchangeRate to USD price for non-stablecoins", () => {
    // usdExchangeRate is USD / 1e8, so multiply by 1e8 to get USD
    expect(priceToUSD("0.00000001", "WETH")).toBeCloseTo(1, 5); // 0.00000001 * 1e8 = 1 USD
    expect(priceToUSD("0.0000005", "ETH")).toBeCloseTo(50, 5); // 0.0000005 * 1e8 = 50 USD
    // Real example: WETH usdExchangeRate = 0.0000312772325362
    expect(priceToUSD("0.0000312772325362", "WETH")).toBeCloseTo(3127.72, 2);
  });

  it("should handle stablecoins correctly (already in USD format)", () => {
    // Stablecoins: usdExchangeRate is already in USD
    expect(priceToUSD("1.0", "USDC")).toBeCloseTo(1, 5);
    expect(priceToUSD("0.9999", "USDT")).toBeCloseTo(0.9999, 5);
    expect(priceToUSD("1.0001", "DAI")).toBeCloseTo(1.0001, 5);
  });

  it("should auto-detect format based on value (>= 1 = USD, < 1 = USD/1e8)", () => {
    // Values >= 1 are treated as USD
    expect(priceToUSD("1.5")).toBeCloseTo(1.5, 5);
    expect(priceToUSD("100")).toBeCloseTo(100, 5);
    // Values < 1 are treated as USD/1e8
    expect(priceToUSD("0.00000001")).toBeCloseTo(1, 5); // 0.00000001 * 1e8 = 1 USD
  });

  it("should calculate total supplied USD", () => {
    // AaveKit returns human-readable values, not on-chain format
    const result = calculateTotalSuppliedUSD("1", 18, 1);
    expect(result).toBe(1); // 1 token * 1 USD = 1 USD
    // Test with larger value
    const result2 = calculateTotalSuppliedUSD("4465088507.84705", 6, 1);
    expect(result2).toBeCloseTo(4465088507.84705, 2);
  });

  it("should calculate total borrowed USD", () => {
    // AaveKit returns human-readable values, not on-chain format
    const result = calculateTotalBorrowedUSD("0.5", 18, 2);
    expect(result).toBe(1); // 0.5 tokens * 2 USD = 1 USD
    // Test with larger value
    const result2 = calculateTotalBorrowedUSD("3817353610.418048", 6, 1);
    expect(result2).toBeCloseTo(3817353610.418048, 2);
  });

  it("should calculate market totals from reserves", () => {
    const reserves = [
      {
        currentState: {
          totalSuppliedUSD: 100,
          totalBorrowedUSD: 50,
        },
      },
      {
        currentState: {
          totalSuppliedUSD: 200,
          totalBorrowedUSD: 100,
        },
      },
    ];

    const totals = calculateMarketTotals(reserves);
    expect(totals.totalSupply).toBe(300);
    expect(totals.borrowing).toBe(150);
    expect(totals.supply).toBe(150); // 300 - 150
    expect(totals.assetCount).toBe(2);
  });
});
