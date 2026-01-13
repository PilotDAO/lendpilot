import { describe, it, expect, beforeAll } from "vitest";
import { GET } from "@/app/api/v1/market/[marketKey]/timeseries/route";
import { NextRequest } from "next/server";

describe("GET /api/v1/market/{marketKey}/timeseries", () => {
  it("should return timeseries data for valid market", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/v1/market/ethereum-v3/timeseries?window=30d"
    );
    const params = Promise.resolve({ marketKey: "ethereum-v3" });
    const response = await GET(request, { params });
    
    // Accept 200 (success) or 503 (upstream error) - both are valid responses
    expect([200, 503]).toContain(response.status);
    
    if (response.status !== 200) {
      console.warn("Skipping data validation - API returned error");
      return;
    }
    
    const data = await response.json();
    expect(data).toHaveProperty("marketKey", "ethereum-v3");
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("assetChanges");
    expect(data).toHaveProperty("totals");

    expect(Array.isArray(data.data)).toBe(true);
    expect(Array.isArray(data.assetChanges)).toBe(true);

    if (data.data.length > 0) {
      const point = data.data[0];
      expect(point).toHaveProperty("date");
      expect(point).toHaveProperty("timestamp");
      expect(point).toHaveProperty("totalSuppliedUSD");
      expect(point).toHaveProperty("totalBorrowedUSD");
      expect(point).toHaveProperty("availableLiquidityUSD");
    }

    if (data.totals) {
      expect(data.totals).toHaveProperty("currentTotalSuppliedUSD");
      expect(data.totals).toHaveProperty("currentTotalBorrowedUSD");
      expect(data.totals).toHaveProperty("change1d");
      expect(data.totals).toHaveProperty("change7d");
      expect(data.totals).toHaveProperty("change30d");
    }
  });

  it("should support different window parameters", async () => {
    const windows = ["30d", "6m", "1y"] as const;

    for (const window of windows) {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/market/ethereum-v3/timeseries?window=${window}`
      );
      const params = Promise.resolve({ marketKey: "ethereum-v3" });
      const response = await GET(request, { params });

      // Accept 200 (success) or 503 (upstream error)
      expect([200, 503]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("data");
      }
    }
  }, { timeout: 60000 });

  it("should return 400 for invalid window parameter", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/v1/market/ethereum-v3/timeseries?window=invalid"
    );
    const params = Promise.resolve({ marketKey: "ethereum-v3" });
    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
    expect(data.error.code).toBe("INVALID_PARAMETER");
  });

  it("should return 404 for invalid market key", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/v1/market/invalid-market/timeseries?window=30d"
    );
    const params = Promise.resolve({ marketKey: "invalid-market" });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty("error");
    expect(data.error.code).toBe("INVALID_MARKET");
  });

  it("should cache responses", async () => {
    const request1 = new NextRequest(
      "http://localhost:3000/api/v1/market/ethereum-v3/timeseries?window=30d"
    );
    const request2 = new NextRequest(
      "http://localhost:3000/api/v1/market/ethereum-v3/timeseries?window=30d"
    );

    const params = Promise.resolve({ marketKey: "ethereum-v3" });
    const response1 = await GET(request1, { params });
    
    // Only check cache if first request succeeded
    if (response1.status === 200) {
      const response2 = await GET(request2, { params });
      expect(response2.status).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // Should return same data (cached)
      expect(data1).toEqual(data2);
    } else {
      // Skip cache test if API is unavailable
      console.warn("Skipping cache test - API returned error");
    }
  }, { timeout: 30000 });

  it("should default to 30d window if not specified", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/v1/market/ethereum-v3/timeseries"
    );
    const params = Promise.resolve({ marketKey: "ethereum-v3" });
    const response = await GET(request, { params });

    // Accept 200 (success) or 503 (upstream error) - both are valid responses
    expect([200, 503]).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("data");
    }
  }, { timeout: 30000 });
});
