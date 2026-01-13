import { test, expect } from "@playwright/test";

test.describe("Stablecoins Page", () => {
  test("should display stablecoins page with table", async ({ page }) => {
    await page.goto("http://localhost:3000/stablecoins");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check page title
    await expect(page.getByRole("heading", { name: "Stablecoins Across Markets" })).toBeVisible({
      timeout: 10000,
    });

    // Check totals section exists
    await expect(page.getByText("Total Supplied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Total Borrowed")).toBeVisible({ timeout: 10000 });

    // Check table exists
    await expect(page.getByRole("columnheader", { name: "Asset" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("columnheader", { name: "Market" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("columnheader", { name: "Supplied" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should filter by market", async ({ page }) => {
    await page.goto("http://localhost:3000/stablecoins");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check filter dropdown exists - use more specific selector
    const filterSelect = page.locator('select').filter({ hasText: /Filter by Market/i }).or(page.locator('select').first());
    await expect(filterSelect).toBeVisible({ timeout: 10000 });

    // Select a market (if available)
    const options = await filterSelect.locator("option").all();
    if (options.length > 1) {
      // Select first non-"all" option
      const firstMarketOption = options[1];
      const marketValue = await firstMarketOption.getAttribute("value");
      if (marketValue && marketValue !== "all") {
        await filterSelect.selectOption(marketValue);
        // Wait for table to update
        await page.waitForTimeout(500);
        // Verify table still visible
        await expect(page.getByRole("columnheader", { name: "Asset" })).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });
});
