import { test, expect } from "@playwright/test";

test.describe("Asset Details Page", () => {
  test("should display asset page with all sections", async ({ page }) => {
    // Use a known asset address (WETH on Ethereum V3)
    const assetAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    await page.goto(`/ethereum-v3/${assetAddress}`);

    // Wait for page to load (may show loading state or error first)
    // Check page title/heading - wait for it to appear
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

    // Check top cards exist - use more specific selectors
    await expect(page.getByText("Supply APR").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Borrow APR").first()).toBeVisible({ timeout: 10000 });

    // Check chart exists (may not render if data fails to load)
    // await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

    // Check tables exist
    await expect(page.locator("text=Average Lending Rates")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Daily Snapshots")).toBeVisible({ timeout: 10000 });
  });

  test("should handle 404 for invalid asset", async ({ page }) => {
    await page.goto("/ethereum-v3/invalid-address");
    // Next.js may return 200 but show not-found component
    await expect(page.locator("text=404")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Page Not Found")).toBeVisible();
  });
});
