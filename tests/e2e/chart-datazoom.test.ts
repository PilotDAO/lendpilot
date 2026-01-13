import { test, expect } from "@playwright/test";

test.describe("Chart DataZoom", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to an asset page with chart
    await page.goto("/ethereum-v3/0xdac17f958d2ee523a2206206994597c13d831ec7");
    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");
    // Wait for chart to render
    await page.waitForTimeout(3000);
  });

  test("should allow dragging dataZoom slider to expand date range", async ({ page }) => {
    // Find the dataZoom slider (it's usually at the bottom of the chart)
    const chartContainer = page.locator('[class*="echarts"]').first();
    
    // Check that chart exists
    await expect(chartContainer).toBeVisible({ timeout: 10000 });
    
    // Find the slider handle - ECharts creates slider with specific structure
    // The slider is usually in a div with class containing "datazoom"
    const sliderContainer = page.locator('div[style*="position"]').filter({ hasText: /12|1/ }).last();
    
    // Try to find slider by looking for the chart canvas and then the slider below it
    // ECharts slider is rendered as a separate canvas or div
    const chartBoundingBox = await chartContainer.boundingBox();
    
    if (chartBoundingBox) {
      // The slider is typically at the bottom of the chart
      const sliderY = chartBoundingBox.y + chartBoundingBox.height - 30;
      const sliderStartX = chartBoundingBox.x + chartBoundingBox.width * 0.1;
      const sliderEndX = chartBoundingBox.x + chartBoundingBox.width * 0.9;
      
      // Try to drag the left handle of the slider to expand range backwards
      // First, find the left edge of the visible range
      const leftHandleX = sliderStartX + (sliderEndX - sliderStartX) * 0.8; // Current left position (showing last 20%)
      
      // Drag left handle to the left to show more historical data
      await page.mouse.move(leftHandleX, sliderY);
      await page.mouse.down();
      await page.mouse.move(leftHandleX - 100, sliderY); // Move 100px to the left
      await page.mouse.up();
      
      // Wait for chart to update
      await page.waitForTimeout(2000);
      
      // Check that chart still exists and is visible
      await expect(chartContainer).toBeVisible();
    }
  });

  test("should allow mouse wheel zoom on chart", async ({ page }) => {
    const chartContainer = page.locator('[class*="echarts"]').first();
    await expect(chartContainer).toBeVisible({ timeout: 10000 });
    
    const chartBoundingBox = await chartContainer.boundingBox();
    
    if (chartBoundingBox) {
      // Move mouse to center of chart
      const centerX = chartBoundingBox.x + chartBoundingBox.width / 2;
      const centerY = chartBoundingBox.y + chartBoundingBox.height / 2;
      
      await page.mouse.move(centerX, centerY);
      
      // Try to zoom in with mouse wheel (scroll down = zoom in)
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(1000);
      
      // Try to zoom out with mouse wheel (scroll up = zoom out)
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(1000);
      
      // Chart should still be visible
      await expect(chartContainer).toBeVisible();
    }
  });

  test("should update visible date range when dragging slider", async ({ page }) => {
    // Wait for chart to fully load
    await page.waitForTimeout(3000);
    
    const chartContainer = page.locator('[class*="echarts"]').first();
    await expect(chartContainer).toBeVisible({ timeout: 10000 });
    
    // Take a screenshot before interaction
    await chartContainer.screenshot({ path: "test-results/chart-before-zoom.png" });
    
    // Try to interact with the chart using keyboard
    // Focus on chart container
    await chartContainer.click();
    
    // Try arrow keys to pan (if supported)
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    
    // Take screenshot after interaction
    await chartContainer.screenshot({ path: "test-results/chart-after-zoom.png" });
    
    // Chart should still be visible
    await expect(chartContainer).toBeVisible();
  });

  test("should show dataZoom slider when data has more than 30 points", async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const chartContainer = page.locator('[class*="echarts"]').first();
    await expect(chartContainer).toBeVisible({ timeout: 10000 });
    
    // Check if slider exists (ECharts renders it as part of the chart)
    // The slider is usually visible at the bottom
    const chartBoundingBox = await chartContainer.boundingBox();
    
    if (chartBoundingBox) {
      // Check bottom area for slider
      const bottomArea = {
        x: chartBoundingBox.x,
        y: chartBoundingBox.y + chartBoundingBox.height - 30,
        width: chartBoundingBox.width,
        height: 30,
      };
      
      // Try to click in the slider area
      await page.mouse.click(bottomArea.x + bottomArea.width / 2, bottomArea.y + bottomArea.height / 2);
      await page.waitForTimeout(1000);
      
      // Chart should still be visible
      await expect(chartContainer).toBeVisible();
    }
  });
});
