import { expect, test } from "./fixtures";

test.describe("bubble signal slots", () => {
  test("shows three slots for the hovered or focused bubble, absent at rest", async ({ canvas, page }) => {
    await expect(page.locator("[data-hub-slot]")).toHaveCount(0);
    await expect(page.locator(".metric-widget-config")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /Choose metric/ })).toHaveCount(0);

    await page.locator("[data-graph-node-id='hub']").focus();
    await expect(page.locator("[data-hub-slot]")).toHaveCount(0);

    await page.locator("[data-graph-node-id='spoke-specs']").focus();
    await expect(page.locator("[data-hub-slot]")).toHaveCount(3);
    await expect(page.locator("[data-hub-slot-source]")).toHaveText("AI Readiness");

    for (const viewport of [
      { width: 1600, height: 950 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.locator("[data-graph-node-id='spoke-retail']").focus();
      await expect(page.locator("[data-hub-slot-source]")).toHaveText("Catalog Health");
      await expect(page.locator("[data-hub-slot='gap'] [data-hub-slot-status]")).not.toHaveText("");
      const figure = page.locator("[data-hub-slot='gap'] [data-hub-slot-figure]");
      const box = await figure.boundingBox();
      expect(box && box.height).toBeGreaterThan(20);
    }

    const tab = await page.locator("[data-hub-slot='gap']").getAttribute("data-hub-slot-tab");
    await page.locator("[data-hub-slot='gap']").click();
    await expect(canvas.activeTab).toContainText(tab ?? "Suppressed");
  });

  test("the slots stay up after the cursor leaves the bubble, until a click outside", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
    await page.locator("[data-graph-node-id='spoke-retail']").focus();
    await expect(page.locator("[data-hub-slot-source]")).toHaveText("Catalog Health");

    // Moving focus elsewhere on the page (the equivalent of the cursor drifting
    // off the bubble) must not close the panel: only an outside click does.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page.locator("[data-hub-slots]")).toHaveCount(1);
    await expect(page.locator("[data-hub-slot-source]")).toHaveText("Catalog Health");

    // Hovering a different bubble swaps to its own slots without ever closing.
    await page.locator("[data-graph-node-id='spoke-aeo']").focus();
    await expect(page.locator("[data-hub-slots]")).toHaveCount(1);
    await expect(page.locator("[data-hub-slot-source]")).toHaveText("AI Search Visibility");

    // Just below the header, in the empty corner of the map, clear of every bubble.
    await page.mouse.click(10, 90);
    await expect(page.locator("[data-hub-slots]")).toHaveCount(0);
  });
});
