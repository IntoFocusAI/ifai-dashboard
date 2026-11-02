import { expect, test } from "./fixtures";

/** Worker 16.4: catalog SKU totals must not appear in client-facing surfaces. */
test.describe("omit catalog SKU count", () => {
  test("command center omits catalog SKU totals", async ({ canvas, page }) => {
    await canvas.openCommandCenter();
    await expect(canvas.commandCenter).toBeVisible();
    const panel = page.locator(".drilldown-panel");
    await expect(panel).toContainText("catalog read covers");
    await expect(panel).not.toContainText("Monitored Electric SKUs");
    await expect(panel).not.toContainText("monitored electric SKUs");
    await expect(panel).not.toContainText("electric SKUs");
    for (const n of ["3,702", "3,598", "3,430", "3,159"]) {
      await expect(panel).not.toContainText(n);
    }
  });

  test("hub briefing and divisions table omit catalog SKU totals", async ({ canvas, page }) => {
    await page.goto("/dashboard?spoke=hub&tab=briefing");
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(canvas.panel).toBeVisible();
    await expect(canvas.panel).not.toContainText("Monitored Electric SKUs");
    await expect(canvas.panel).not.toContainText("monitored electric SKUs");
    await expect(canvas.panel).not.toContainText("harvested electric SKUs");
    for (const n of ["3,702", "3,598", "3,430", "3,159"]) {
      await expect(canvas.panel).not.toContainText(n);
    }

    await canvas.openTab("Performance");
    await expect(canvas.panel).toContainText("Catalog Division");
    await expect(canvas.panel).toContainText("Buy Box");
    await expect(canvas.panel).not.toContainText("Monitored SKUs");
  });

  test("guided tour omits catalog SKU totals", async ({ canvas }) => {
    await canvas.startTour();
    await expect(canvas.tourCard).toBeVisible();
    await expect(canvas.tourCard).not.toContainText("monitored SKUs");
    await expect(canvas.tourCard).not.toContainText("Monitored Electric SKUs");
    for (const n of ["3,702", "3,598", "3,430", "3,159"]) {
      await expect(canvas.tourCard).not.toContainText(n);
    }
  });

  test("Amazon Specs still shows checked-SKU sample size", async ({ canvas, page }) => {
    await page.goto("/dashboard?spoke=specs&tab=amazon-specs");
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(canvas.panel).toBeVisible();
    await expect(canvas.panel).toContainText(/checked SKUs/i);
    await expect(canvas.panel).not.toContainText("Monitored Electric SKUs");
  });
});
