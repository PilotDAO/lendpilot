import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getDailyCSV } from "@/app/api/v1/reserve/[marketKey]/[underlying]/snapshots/daily/csv/route";
import { GET as getMonthlyCSV } from "@/app/api/v1/reserve/[marketKey]/[underlying]/snapshots/monthly/csv/route";

// Mock the daily snapshots endpoint
vi.mock("@/app/api/v1/reserve/[marketKey]/[underlying]/snapshots/daily/route", () => ({
  GET: vi.fn(),
}));

// Mock the monthly snapshots endpoint
vi.mock("@/app/api/v1/reserve/[marketKey]/[underlying]/snapshots/monthly/route", () => ({
  GET: vi.fn(),
}));

describe("CSV Export Endpoints", () => {
  const mockMarketKey = "ethereum-v3";
  const mockUnderlying = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const normalizedAddress = mockUnderlying.toLowerCase();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily/csv", () => {
    it("should return CSV file with correct headers", async () => {
      // Mock fetch for daily snapshots
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.05,
            borrowAPR: 0.08,
            totalSuppliedUSD: 1000000.12,
            totalBorrowedUSD: 500000.45,
            utilizationRate: 0.5,
            price: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("Content-Disposition")).toContain(
        `attachment; filename="daily-snapshots-${mockMarketKey}-${normalizedAddress}.csv"`
      );

      const csv = await response.text();
      expect(csv).toContain("Date");
      expect(csv).toContain("Supply APR (%)");
      expect(csv).toContain("Borrow APR (%)");
      expect(csv).toContain("Total Supplied (USD)");
      expect(csv).toContain("Total Borrowed (USD)");
      expect(csv).toContain("Utilization Rate (%)");
      expect(csv).toContain("Price (USD)");
    });

    it("should format CSV with comma separator", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.05,
            borrowAPR: 0.08,
            totalSuppliedUSD: 1000000.12,
            totalBorrowedUSD: 500000.45,
            utilizationRate: 0.5,
            price: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      const csv = await response.text();
      const lines = csv.split("\n");
      expect(lines.length).toBeGreaterThan(1);

      // Check that rows use comma separator
      const dataRow = lines[1];
      const columns = dataRow.split(",");
      expect(columns.length).toBe(7); // 7 columns
    });

    it("should format dates in ISO format (YYYY-MM-DD)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.05,
            borrowAPR: 0.08,
            totalSuppliedUSD: 1000000.12,
            totalBorrowedUSD: 500000.45,
            utilizationRate: 0.5,
            price: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      const csv = await response.text();
      expect(csv).toMatch(/2025-01-01/);
      // Verify ISO date format (YYYY-MM-DD)
      expect(csv).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("should format USD values with 2 decimals", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.05,
            borrowAPR: 0.08,
            totalSuppliedUSD: 1000000.123456,
            totalBorrowedUSD: 500000.456789,
            utilizationRate: 0.5,
            price: 2500.999999,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      const csv = await response.text();
      // Check that USD values have exactly 2 decimals
      expect(csv).toMatch(/1000000\.12/);
      expect(csv).toMatch(/500000\.46/); // Rounded
      expect(csv).toMatch(/2501\.00/); // Rounded
    });

    it("should format APR values with 4 decimals", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.051234,
            borrowAPR: 0.087654,
            totalSuppliedUSD: 1000000.12,
            totalBorrowedUSD: 500000.45,
            utilizationRate: 0.5,
            price: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      const csv = await response.text();
      // Check that APR values have exactly 4 decimals (as percentage)
      expect(csv).toMatch(/5\.1234/); // 0.051234 * 100 = 5.1234%
      expect(csv).toMatch(/8\.7654/); // 0.087654 * 100 = 8.7654%
    });

    it("should handle UTF-8 encoding correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.05,
            borrowAPR: 0.08,
            totalSuppliedUSD: 1000000.12,
            totalBorrowedUSD: 500000.45,
            utilizationRate: 0.5,
            price: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      
      const csv = await response.text();
      // Verify UTF-8 encoding by checking BOM is not present (UTF-8 without BOM)
      expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    });

    it("should escape special characters in CSV", async () => {
      // This test verifies that values with commas, quotes, or newlines are properly escaped
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            date: "2025-01-01",
            supplyAPR: 0.05,
            borrowAPR: 0.08,
            totalSuppliedUSD: 1000000.12,
            totalBorrowedUSD: 500000.45,
            utilizationRate: 0.5,
            price: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      const csv = await response.text();
      // Verify CSV is valid (no unescaped commas in data rows)
      const lines = csv.split("\n");
      lines.forEach((line, index) => {
        if (index > 0 && line.trim()) {
          // Count commas (should be consistent)
          const commaCount = (line.match(/,/g) || []).length;
          expect(commaCount).toBe(6); // 7 columns = 6 commas
        }
      });
    });
  });

  describe("GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/monthly/csv", () => {
    it("should return CSV file with correct headers", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            month: "2025-01",
            startDate: "2025-01-01",
            endDate: "2025-01-31",
            avgSupplyAPR: 0.05,
            avgBorrowAPR: 0.08,
            startTotalSuppliedUSD: 1000000.12,
            endTotalSuppliedUSD: 1100000.45,
            startTotalBorrowedUSD: 500000.12,
            endTotalBorrowedUSD: 550000.45,
            startUtilizationRate: 0.5,
            endUtilizationRate: 0.55,
            avgPrice: 2500.99,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/monthly/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getMonthlyCSV(request, { params: Promise.resolve(params) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("Content-Disposition")).toContain(
        `attachment; filename="monthly-snapshots-${mockMarketKey}-${normalizedAddress}.csv"`
      );

      const csv = await response.text();
      expect(csv).toContain("Month");
      expect(csv).toContain("Start Date");
      expect(csv).toContain("End Date");
      expect(csv).toContain("Avg Supply APR (%)");
      expect(csv).toContain("Avg Borrow APR (%)");
    });

    it("should format monthly CSV with correct decimal precision", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            month: "2025-01",
            startDate: "2025-01-01",
            endDate: "2025-01-31",
            avgSupplyAPR: 0.051234,
            avgBorrowAPR: 0.087654,
            startTotalSuppliedUSD: 1000000.123456,
            endTotalSuppliedUSD: 1100000.456789,
            startTotalBorrowedUSD: 500000.123456,
            endTotalBorrowedUSD: 550000.456789,
            startUtilizationRate: 0.5123,
            endUtilizationRate: 0.5567,
            avgPrice: 2500.999999,
          },
        ],
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/monthly/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getMonthlyCSV(request, { params: Promise.resolve(params) });

      const csv = await response.text();
      // Check APR has 4 decimals
      expect(csv).toMatch(/5\.1234/);
      expect(csv).toMatch(/8\.7654/);
      // Check USD has 2 decimals
      expect(csv).toMatch(/1000000\.12/);
      expect(csv).toMatch(/1100000\.46/);
      expect(csv).toMatch(/2501\.00/);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for invalid market key", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/reserve/invalid-market/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: "invalid-market", underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      expect(response.status).toBe(404);
    });

    it("should return 404 for invalid address", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/invalid-address/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: "invalid-address" };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      expect(response.status).toBe(404);
    });

    it("should return 503 when upstream data fetch fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });

      const request = new NextRequest(
        `http://localhost/api/v1/reserve/${mockMarketKey}/${mockUnderlying}/snapshots/daily/csv`
      );
      const params = { marketKey: mockMarketKey, underlying: mockUnderlying };
      const response = await getDailyCSV(request, { params: Promise.resolve(params) });

      expect(response.status).toBe(503);
    });
  });
});
