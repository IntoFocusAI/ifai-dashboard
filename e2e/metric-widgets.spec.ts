import { expect, test } from "./fixtures";

test.describe("bubble signal slots", () => {
  test("shows three slots for the hovered or focused bubble, absent at rest", async ({ canvas, page }) => {
    await expect(page.locator("[data-hub-slot]")).toHaveCount(0);
    await expect(page.locator(".metric-widget-config")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /Choose metric/ })).toHaveCount(0);

    await page.locator("[data-graph-node-id='hub']").focus();
    await expect(page.locator("[data-hub-slot]")).toHaveCount(3);
    await expect(page.locator("[data-hub-slot-source]")).toHaveText("Summary");

    for (const viewport of [
      { width: 1600, height: 950 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.locator("[data-graph-node-id='spoke-retail']").focus();
      await expect(page.locator("[data-hub-slot-source]")).toHaveText("Catalog Health");
      await expect(page.locator("[data-hub-slot='gap'] [data-hub-slot-status]")).not.toHaveText(/^(Loading)?$/);
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

  test("each slot states its target, count, last check, and evidence link, and its rule is a definition", async ({ page }) => {
    for (const id of ["hub", "spoke-retail", "spoke-aeo", "spoke-specs", "spoke-competitors", "spoke-fixes", "spoke-roadmap"]) {
      await page.locator(`[data-graph-node-id='${id}']`).focus();
      const slots = page.locator("[data-hub-slot]");
      await expect(slots).toHaveCount(3);
      for (let index = 0; index < 3; index += 1) {
        const slot = slots.nth(index);
        await expect(slot.locator("[data-hub-slot-status]")).not.toHaveText("");
        await expect(slot.locator("[data-hub-slot-target]")).toHaveText(/^(Target: .+ \(now .+\)|No target set|Loading)$/);
        await expect(slot.locator("[data-hub-slot-count]")).not.toHaveText("");
        await expect(slot.locator("[data-hub-slot-checked]")).toHaveText(/^(Last checked .+|Loading)$/);
        await expect(slot.locator("[data-hub-slot-link]")).toHaveText(/^Open .+/);
        const rule = slot.locator("[data-hub-slot-rule] .ifai-term");
        await expect(rule).toHaveAttribute("data-ifai-tooltip-desc", /^[A-Z](?:(?!\.\s+[A-Z]).)+\.$/);
        await expect(rule).toHaveAttribute("tabindex", "0");
        await expect(rule).not.toHaveAttribute("title");
      }
    }

    await page.locator("[data-graph-node-id='spoke-retail']").focus();
    await page.locator("[data-hub-slot='gap'] [data-hub-slot-rule] .ifai-term").focus();
    const tooltip = page.locator(".node-tooltip.node-tooltip-definition.visible");
    await expect(tooltip).toBeVisible();
    await expect(page.locator("[data-hub-slots]")).toHaveCount(1);
    // The column sits on the left edge, so the definition opens beside it, fully on screen.
    const column = await page.locator("[data-hub-slots]").boundingBox();
    const tip = await tooltip.boundingBox();
    expect(tip && column && tip.x >= column.x + column.width && tip.y >= 0).toBe(true);
  });
});
