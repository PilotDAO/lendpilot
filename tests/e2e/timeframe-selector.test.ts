import { test, expect } from "@playwright/test";

test.describe("Timeframe Selector", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a market page with timeframe selector
    await page.goto("/ethereum-v3");
    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("should switch between timeframe options (30d, 6m, 1y)", async ({ page }) => {
    // Find the timeframe selector buttons
    const timeframeButtons = page.locator('button:has-text("30d"), button:has-text("6m"), button:has-text("1y")');
    
    // Wait for buttons to be visible
    await expect(timeframeButtons.first()).toBeVisible({ timeout: 10000 });
    
    // Check initial state - 30d should be active
    const button30d = page.locator('button:has-text("30d")');
    const button6m = page.locator('button:has-text("6m")');
    const button1y = page.locator('button:has-text("1y")');
    
    // Wait a bit for initial load
    await page.waitForTimeout(1000);
    
    // Click 6m button
    await button6m.click();
    await page.waitForTimeout(2000); // Wait for data to load
    
    // Check that 6m is now active (has different styling)
    const button6mClasses = await button6m.getAttribute("class");
    expect(button6mClasses).toContain("bg-white");
    
    // Click 1y button
    await button1y.click();
    await page.waitForTimeout(2000);
    
    // Check that 1y is now active
    const button1yClasses = await button1y.getAttribute("class");
    expect(button1yClasses).toContain("bg-white");
    
    // Click back to 30d
    await button30d.click();
    await page.waitForTimeout(2000);
    
    // Check that 30d is now active
    const button30dClasses = await button30d.getAttribute("class");
    expect(button30dClasses).toContain("bg-white");
  });

  test("should load data when switching timeframes", async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Find chart container
    const chartContainer = page.locator('[class*="echarts"]').first();
    
    // Get initial chart state
    const initialChartExists = await chartContainer.count() > 0;
    expect(initialChartExists).toBeTruthy();
    
    // Switch to 6m
    const button6m = page.locator('button:has-text("6m")');
    await button6m.click();
    
    // Wait for loading to complete (check for loading indicator to disappear)
    await page.waitForTimeout(3000);
    
    // Check that chart still exists after switching
    const chartAfterSwitch = await chartContainer.count() > 0;
    expect(chartAfterSwitch).toBeTruthy();
    
    // Switch to 1y
    const button1y = page.locator('button:has-text("1y")');
    await button1y.click();
    await page.waitForTimeout(3000);
    
    // Check that chart still exists
    const chartAfter1y = await chartContainer.count() > 0;
    expect(chartAfter1y).toBeTruthy();
  });

  test("should not have multiple active buttons at once", async ({ page }) => {
    await page.waitForTimeout(1000);
    
    const button30d = page.locator('button:has-text("30d")');
    const button6m = page.locator('button:has-text("6m")');
    const button1y = page.locator('button:has-text("1y")');
    
    // Click 6m
    await button6m.click();
    await page.waitForTimeout(1000);
    
    // Check that only 6m is active
    const activeButtons = page.locator('button.bg-white:has-text("30d"), button.bg-white:has-text("6m"), button.bg-white:has-text("1y")');
    const activeCount = await activeButtons.count();
    expect(activeCount).toBe(1);
    
    // Click 1y
    await button1y.click();
    await page.waitForTimeout(1000);
    
    // Check that only 1y is active now
    const activeButtonsAfter = page.locator('button.bg-white:has-text("30d"), button.bg-white:has-text("6m"), button.bg-white:has-text("1y")');
    const activeCountAfter = await activeButtonsAfter.count();
    expect(activeCountAfter).toBe(1);
  });
});
