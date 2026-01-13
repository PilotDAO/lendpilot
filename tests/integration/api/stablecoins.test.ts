import { describe, it, expect, beforeAll } from "vitest";
import { GET } from "@/app/api/v1/stablecoins/route";
import { NextRequest } from "next/server";

describe("GET /api/v1/stablecoins", () => {
  it("should return aggregated stablecoins data", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/stablecoins");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
      const stablecoin = data[0];
      expect(stablecoin).toHaveProperty("symbol");
      expect(stablecoin).toHaveProperty("address");
      expect(stablecoin).toHaveProperty("markets");
      expect(stablecoin).toHaveProperty("totalSuppliedUSD");
      expect(stablecoin).toHaveProperty("totalBorrowedUSD");
      expect(Array.isArray(stablecoin.markets)).toBe(true);
    }
  });

  it("should cache responses", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/stablecoins");
    const response1 = await GET(request);
    const response2 = await GET(request);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    const data1 = await response1.json();
    const data2 = await response2.json();

    // Should return same data (cached)
    expect(data1).toEqual(data2);
  });
});
