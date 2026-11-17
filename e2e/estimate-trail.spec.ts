import { expect, test } from "@playwright/test";

/* Chunk E2: the estimate trail drawer on its two fixtures (e2e/estimate-trail-fixtures.ts),
   through the test-only route, which answers 404 outside the e2e dev server. Chunks E3 and E4
   put the drawer behind live dollar figures. */

const ROUTE = "/dashboard/estimate-trail-check";

test.describe("estimate trail drawer", () => {
  test("High confidence: figure, label, coverage, inputs, formula, grade, sources", async ({ page }) => {
    await page.goto(ROUTE);
    const trigger = page.locator('[data-estimate-trigger="out_of_stock"]');
    await expect(trigger).toContainText("analyst estimate");
    await trigger.click();
    const drawer = page.locator('[data-estimate-trail="out_of_stock"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-estimate-figure]")).toHaveText("$490K, range $368K to $674K*");
    await expect(drawer.locator("[data-analyst-estimate]")).toHaveText("Analyst estimate");
    await expect(drawer.locator("[data-estimate-coverage]")).toHaveText("Based on 247 of 609 listings; 362 Not available*");
    await expect(drawer.locator("[data-estimate-input]")).toHaveCount(3);
    const share = drawer.locator('[data-estimate-input="brand_loss_share"]');
    await expect(share).toContainText("40% (30% to 55%)");
    await expect(share).toContainText("Benchmark");
    await expect(drawer.locator("[data-estimate-formula]")).toContainText("out-of-stock days");
    await expect(drawer.locator("[data-estimate-grade=high] [data-status=good]")).toContainText("High");
    await expect(drawer.locator("[data-estimate-improve]")).toContainText("Most improved by");

    // No sideways overflow inside the drawer at 1280 x 720.
    const overflow = await drawer.evaluate((el) => {
      const body = el.querySelector(".estimate-trail-body") as HTMLElement;
      return body.scrollWidth - body.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);

    // Escape closes and focus returns to the figure.
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("Low confidence: estimated listings, sales split, unchecked sources in tooltips only", async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('[data-estimate-trigger="ai_unbranded"]').click();
    const drawer = page.locator('[data-estimate-trail="ai_unbranded"]');
    await expect(drawer.locator("[data-estimate-figure]")).toHaveText("$2.45K, range $306 to $9.18K*");
    await expect(drawer.locator("[data-estimate-coverage]")).toHaveText(
      "Based on 62 of 214 listings; 120 estimated from sales rank; 32 Not available*",
    );
    await expect(drawer.locator('[data-estimate-split-source="none"]')).toContainText("Not available*");
    await expect(drawer.locator('[data-estimate-input="purchase_share"]')).toContainText("Placeholder");
    await expect(drawer.locator("[data-estimate-grade=low] [data-status=bad]")).toContainText("Low");

    // The unchecked note is never on screen; it is in the source's custom tooltip.
    await expect(drawer).not.toContainText("not yet checked");
    const unchecked = drawer.locator('[data-estimate-source="kaiser-schulze"] a');
    await expect(unchecked).toHaveAttribute("href", "https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489");
    await expect(unchecked).toHaveAttribute("data-ifai-tooltip-desc", /Source not yet checked/);
    expect(await unchecked.getAttribute("title")).toBeNull();
    await unchecked.hover();
    await expect(page.locator(".node-tooltip")).toContainText("Source not yet checked");

    // A click outside closes it.
    await page.mouse.click(40, 360);
    await expect(drawer).toHaveCount(0);
  });
});
