import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/reserve/[marketKey]/[underlying]/route";
import { NextRequest } from "next/server";

describe("GET /api/v1/reserve/{marketKey}/{underlying}", () => {
  it("should return 404 for invalid address", async () => {
    const request = new NextRequest("http://localhost/api/v1/reserve/ethereum-v3/invalid");
    const response = await GET(request, {
      params: Promise.resolve({ marketKey: "ethereum-v3", underlying: "invalid" }),
    });

    expect(response.status).toBe(404);
  });

  it("should validate market key", async () => {
    const request = new NextRequest("http://localhost/api/v1/reserve/invalid/0x123");
    const response = await GET(request, {
      params: Promise.resolve({ marketKey: "invalid", underlying: "0x1234567890123456789012345678901234567890" }),
    });

    expect(response.status).toBe(404);
  });
});
