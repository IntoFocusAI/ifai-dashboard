import { expect, test } from "./fixtures";

/** Worker 17.9 / FDD X-28: plain rows must not paint a clickable hover. (The division table is gone, decision 94.) */
test.describe("table no-row-hover", () => {
  test("MAP listing rows do not paint hover; sort and price links stay", async ({ canvas, page }) => {
    await page.goto("/dashboard?spoke=ecommerce&tab=map");
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(canvas.panel).toBeVisible();
    await expect(canvas.activeTab).toContainText("MAP");

    const table = canvas.panel.locator("table.table-sm.table-no-row-hover.resizable-table");
    // MAP may show an empty or missing-prices state with no data rows.
    const dataRows = table.locator("tbody tr");
    await expect(dataRows.first()).toBeVisible();
    const cell = dataRows.first().locator("td").first();
    const before = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
    await cell.hover();
    const after = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).toBe(before);

    await expect(table.locator("thead .ifai-sort-btn").first()).toBeVisible();
    const priceLink = table.locator("a.listing-link").first();
    if (await priceLink.count()) {
      await expect(priceLink).toHaveAttribute("href", /https?:\/\//);
    }
  });
});
