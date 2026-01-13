import { test, expect } from "@playwright/test";

test.describe("Market Overview Page", () => {
  test("should display market page with assets table", async ({ page }) => {
    await page.goto("/ethereum-v3");

    // Wait for page to load (may show loading state first)
    // Check page title/heading - wait for it to appear
    await expect(page.locator("h1")).toContainText("Ethereum V3", { timeout: 10000 });

    // Check market totals section exists
    await expect(page.locator("text=Total Supply")).toBeVisible({ timeout: 10000 });

    // Check assets table exists - use more specific selectors
    await expect(page.getByRole("columnheader", { name: "Asset" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("columnheader", { name: "Supplied" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("columnheader", { name: "Borrowed" })).toBeVisible({ timeout: 10000 });
  });

  test("should handle 404 for invalid market", async ({ page }) => {
    await page.goto("/invalid-market");
    // Next.js may return 200 but show not-found component
    await expect(page.locator("text=404")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Page Not Found")).toBeVisible();
  });
});
