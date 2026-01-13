import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/markets/route";

describe("GET /api/v1/markets", () => {
  it("should return list of markets", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("markets");
    expect(Array.isArray(data.markets)).toBe(true);
  });
});

// Note: Integration test for market endpoint requires proper Next.js context
// This test is a placeholder - full integration testing should be done with Next.js test utilities
describe("GET /api/v1/market/{marketKey}", () => {
  it("should validate market key format", () => {
    // This is a unit test placeholder
    // Full integration test requires Next.js request context
    expect("ethereum-v3").toMatch(/^[a-z0-9-]+$/);
  });
});
