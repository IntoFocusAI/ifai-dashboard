import { expect, test } from "./fixtures";

/* Worker 21.4 / FDD H-04: each division row shows its population as N of M and one next
   step, rows do not overlap at 1280x720, a missing figure reads "Not available*", and only
   the next-step link is clickable. */

test.describe("divisions table", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard?spoke=hub&tab=performance");
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
  });

  test("rows show N of M, one next step, and no n/a", async ({ canvas, page }) => {
    const table = page.locator("[data-divisions-table]");
    await expect(table).toBeVisible({ timeout: 20_000 });
    const rows = table.locator("tbody tr[data-division-row]");
    await expect(rows.first()).toBeVisible();
    await expect(table.locator('[data-division-cell="division-buybox"]', { hasText: "Loading" })).toHaveCount(0, {
      timeout: 30_000,
    });

    await expect(table.locator(".content-box-title")).not.toContainText(/\d+\s+divisions/);
    await expect(table.locator("thead")).not.toContainText("Schema Sync");
    await expect(table.locator("thead")).not.toContainText("Primary Threat");

    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      for (const text of await row.locator("td").allInnerTexts()) {
        expect(text.trim().toLowerCase()).not.toBe("n/a");
      }
      await expect(row.locator("[data-division-next]")).toHaveCount(1);
      for (const id of ["division-bundles", "division-buybox"]) {
        const cell = row.locator(`[data-division-cell="${id}"]`);
        const tip = cell.locator(`[data-figure-tip="${id}"]`);
        await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /.+/);
        await expect(tip).not.toHaveAttribute("title", /.+/);
        const value = (await tip.innerText()).trim();
        if (value === "Not available*") continue;
        await expect(cell.locator("[data-division-count]")).toHaveText(/^[\d,]+ of [\d,]+ (SKUs?|listings?)$/);
      }
    }
    await expect(canvas.panel).not.toContainText("n/a");
  });

  test("rows do not overlap at 1280x720 and cells do not spill", async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
    const table = page.locator("[data-divisions-table]");
    await expect(table).toBeVisible({ timeout: 20_000 });
    await expect(table.locator('[data-division-cell="division-buybox"]', { hasText: "Loading" })).toHaveCount(0, {
      timeout: 30_000,
    });
    await table.scrollIntoViewIfNeeded();
    const layout = await table.locator("tbody tr").evaluateAll((rows) =>
      rows.map((row) => ({
        box: row.getBoundingClientRect().toJSON() as DOMRect,
        cells: Array.from(row.querySelectorAll("td")).map((td) => ({
          box: td.getBoundingClientRect().toJSON() as DOMRect,
          spills: td.scrollWidth > td.clientWidth + 1,
        })),
      })),
    );
    expect(layout.length).toBeGreaterThan(0);
    for (let i = 0; i < layout.length; i += 1) {
      const row = layout[i];
      if (i > 0) expect(row.box.top).toBeGreaterThanOrEqual(layout[i - 1].box.bottom - 0.5);
      for (let c = 0; c < row.cells.length; c += 1) {
        expect(row.cells[c].spills, `row ${i} cell ${c} spills`).toBe(false);
        if (c > 0) expect(row.cells[c].box.left).toBeGreaterThanOrEqual(row.cells[c - 1].box.right - 0.5);
      }
    }
  });

  test("rows are not clickable; the next-step link opens its Catalog Health tab", async ({ canvas, page }) => {
    const table = page.locator("[data-divisions-table]");
    await expect(table).toBeVisible({ timeout: 20_000 });
    const firstCell = table.locator("tbody tr").first().locator("td").first();
    expect(await firstCell.evaluate((el) => getComputedStyle(el).cursor)).not.toBe("pointer");

    const next = table.locator("[data-division-next]").first();
    const tab = await next.getAttribute("data-division-next");
    expect(tab === "Catalog Governance" || tab === "Retail Overview").toBe(true);
    await next.click();
    await expect(canvas.activeTab).toContainText(tab as string);
  });
});
