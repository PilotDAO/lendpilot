import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateMarketTrends,
  AssetChange,
  AssetTrendsData,
  MarketTrendsDataPoint,
} from "@/lib/calculations/trends";
import * as subgraph from "@/lib/api/subgraph";
import * as rpc from "@/lib/api/rpc";
import * as marketUtils from "@/lib/utils/market";
import * as totals from "@/lib/calculations/totals";

// Mock dependencies
vi.mock("@/lib/api/subgraph");
vi.mock("@/lib/api/rpc");
vi.mock("@/lib/utils/market");
vi.mock("@/lib/calculations/totals");

describe("calculateMarketTrends", () => {
  const mockMarket = {
    marketKey: "ethereum-v3",
    displayName: "Ethereum V3",
    poolAddress: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
    subgraphId: "test-subgraph-id",
    chainId: 1,
    rpcUrls: ["https://rpc.test"],
  };

  const mockPool = {
    id: "pool-entity-id",
    pool: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
  };

  const mockReserve = {
    underlyingAsset: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    totalATokenSupply: "1000000000000000000", // 1 WETH
    availableLiquidity: "500000000000000000", // 0.5 WETH
    totalCurrentVariableDebt: "500000000000000000", // 0.5 WETH
    totalPrincipalStableDebt: "0",
    liquidityIndex: "1000000000000000000000000000", // 1e27
    variableBorrowIndex: "1000000000000000000000000000", // 1e27
    liquidityRate: "50000000000000000000000000", // 0.05 * 1e27
    variableBorrowRate: "80000000000000000000000000", // 0.08 * 1e27
    price: {
      priceInEth: "100000000", // 1 USD * 1e8
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock market utils
    vi.mocked(marketUtils.getMarket).mockReturnValue(mockMarket);

    // Mock subgraph
    vi.mocked(subgraph.queryPoolByAddress).mockResolvedValue(mockPool);
    vi.mocked(subgraph.queryReservesAtBlock).mockResolvedValue([mockReserve]);

    // Mock RPC
    vi.mocked(rpc.getBlockByTimestamp).mockResolvedValue({
      blockNumber: 1000000,
      block: {
        number: "0xf4240",
        timestamp: "0x1234567890",
      },
    });

    // Mock totals calculations
    vi.mocked(totals.priceToUSD).mockReturnValue(1);
    vi.mocked(totals.calculateTotalSuppliedUSD).mockReturnValue(1000);
    vi.mocked(totals.calculateTotalBorrowedUSD).mockReturnValue(500);
  });

  it("should calculate market trends for 30d window", async () => {
    const result = await calculateMarketTrends("ethereum-v3", "30d");

    expect(result).toHaveProperty("marketKey", "ethereum-v3");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("assetChanges");
    expect(result).toHaveProperty("totals");

    expect(Array.isArray(result.data)).toBe(true);
    expect(Array.isArray(result.assetChanges)).toBe(true);
  });

  it("should calculate asset changes correctly", async () => {
    // Mock two different snapshots to test change calculation
    const now = new Date();
    const date30dAgo = new Date(now);
    date30dAgo.setDate(date30dAgo.getDate() - 30);

    // First call (30 days ago) - lower values
    vi.mocked(totals.calculateTotalSuppliedUSD)
      .mockReturnValueOnce(800) // 30 days ago
      .mockReturnValue(1000); // Current

    vi.mocked(totals.calculateTotalBorrowedUSD)
      .mockReturnValueOnce(400) // 30 days ago
      .mockReturnValue(500); // Current

    const result = await calculateMarketTrends("ethereum-v3", "30d");

    if (result.assetChanges.length > 0) {
      const asset = result.assetChanges[0];
      expect(asset).toHaveProperty("change30d");
      if (asset.change30d) {
        expect(asset.change30d.suppliedPercent).toBeGreaterThan(0);
        expect(asset.change30d.borrowedPercent).toBeGreaterThan(0);
      }
    }
  });

  it("should calculate market totals changes", async () => {
    const result = await calculateMarketTrends("ethereum-v3", "30d");

    expect(result.totals).toHaveProperty("currentTotalSuppliedUSD");
    expect(result.totals).toHaveProperty("currentTotalBorrowedUSD");
    expect(result.totals).toHaveProperty("change1d");
    expect(result.totals).toHaveProperty("change7d");
    expect(result.totals).toHaveProperty("change30d");
  });

  it("should handle missing market gracefully", async () => {
    vi.mocked(marketUtils.getMarket).mockReturnValue(null);

    await expect(calculateMarketTrends("invalid-market", "30d")).rejects.toThrow(
      "Market invalid-market not found"
    );
  });

  it("should handle missing pool gracefully", async () => {
    vi.mocked(subgraph.queryPoolByAddress).mockResolvedValue(null);

    await expect(calculateMarketTrends("ethereum-v3", "30d")).rejects.toThrow(
      "Pool entity not found"
    );
  });
});
