import { expect, test, type Page } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 21.4 / FDD H-04: each division row shows its population as N of M and one next
   step, rows do not overlap at 1280x720, a missing figure reads "Not available*", and only
   the next-step link is clickable. Every Supabase read answers from catalog-health-mock. */

const EXPECTED = [
  { division: "Electric Guitar Kits", bundles: "3 of 4 SKUs", buyBox: "50.0%", buyBoxCount: "1 of 2 listings", next: "Catalog Governance" },
  { division: "Hollow & Semi-Hollow Body", bundles: "13 of 69 SKUs", buyBox: "0.0%", buyBoxCount: "0 of 1 listing", next: "Retail Overview" },
  { division: "Solid Body", bundles: "719 of 3,292 SKUs", buyBox: "50.0%", buyBoxCount: "1 of 2 listings", next: "Retail Overview" },
  { division: "Tuning Pegs", bundles: "0 of 1 SKU", buyBox: "Not available*", buyBoxCount: null, next: "Retail Overview" },
];

let errors: string[] = [];

async function openDivisions(page: Page) {
  const opened = await openCatalogHealthCanvas(page);
  errors = opened.errors;
  const canvas = opened.canvas;
  await page.goto("/dashboard?spoke=hub&tab=performance");
  await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
  const table = page.locator("[data-divisions-table]");
  await expect(table).toBeVisible();
  await expect(table.locator('[data-division-cell="division-buybox"]', { hasText: "Loading" })).toHaveCount(0);
  return { canvas, table };
}

test.describe("divisions table", () => {
  test.beforeEach(() => {
    errors = [];
  });
  test.afterEach(() => {
    expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("rows show N of M, one next step, and Not available* instead of n/a", async ({ page }) => {
    const { canvas, table } = await openDivisions(page);
    await expect(table.locator(".content-box-title")).toHaveText("Catalog divisions");
    await expect(table.locator("thead th")).toHaveText([
      "Catalog Division",
      "Bundle listings",
      "Amazon holds the Buy Box",
      "Next step",
    ]);

    const rows = table.locator("tbody tr[data-division-row]");
    await expect(rows).toHaveCount(EXPECTED.length);
    for (const want of EXPECTED) {
      const row = table.locator(`tbody tr[data-division-row="${want.division}"]`);
      const bundles = row.locator('[data-division-cell="division-bundles"]');
      await expect(bundles.locator("[data-division-count]")).toHaveText(want.bundles);
      await expect(bundles.locator('[data-figure-tip="division-bundles"]')).toHaveAttribute(
        "data-ifai-tooltip-desc",
        /are bundle listings|is a bundle listing/,
      );

      const buyBox = row.locator('[data-division-cell="division-buybox"]');
      const tip = buyBox.locator('[data-figure-tip="division-buybox"]');
      await expect(tip).toHaveText(want.buyBox);
      await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /Buy Box holder/);
      await expect(tip).not.toHaveAttribute("title", /.+/);
      if (want.buyBoxCount) await expect(buyBox.locator("[data-division-count]")).toHaveText(want.buyBoxCount);
      else await expect(buyBox.locator("[data-division-count]")).toHaveCount(0);

      await expect(row.locator("[data-division-next]")).toHaveCount(1);
      await expect(row.locator("[data-division-next]")).toHaveAttribute("data-division-next", want.next);
    }

    for (const text of await table.locator("td").allInnerTexts()) {
      expect(text.trim().toLowerCase()).not.toBe("n/a");
    }
    await expect(canvas.panel.locator("[data-divisions-table]")).not.toContainText(/\d+\s+divisions/);

    const pegs = table.locator('tbody tr[data-division-row="Tuning Pegs"] [data-figure-tip="division-buybox"]');
    await pegs.hover();
    await expect(page.locator(".node-tooltip-definition")).toContainText("known Buy Box holder");
  });

  test("rows do not overlap at 1280x720 and cells do not spill", async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
    const { table } = await openDivisions(page);
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
    expect(layout).toHaveLength(EXPECTED.length);
    for (let i = 0; i < layout.length; i += 1) {
      const row = layout[i];
      if (i > 0) expect(row.box.top).toBeGreaterThanOrEqual(layout[i - 1].box.bottom - 0.5);
      for (let c = 0; c < row.cells.length; c += 1) {
        expect(row.cells[c].spills, `row ${i} cell ${c} spills`).toBe(false);
        if (c > 0) expect(row.cells[c].box.left).toBeGreaterThanOrEqual(row.cells[c - 1].box.right - 0.5);
      }
    }
  });

  test("rows are not clickable; the next-step link opens its Catalog Health tab", async ({ page }) => {
    const { canvas, table } = await openDivisions(page);
    const firstCell = table.locator("tbody tr").first().locator("td").first();
    expect(await firstCell.evaluate((el) => getComputedStyle(el).cursor)).not.toBe("pointer");
    const before = await firstCell.evaluate((el) => getComputedStyle(el).backgroundColor);
    await firstCell.hover();
    expect(await firstCell.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(before);

    await table.locator('tbody tr[data-division-row="Electric Guitar Kits"] [data-division-next]').click();
    await expect(canvas.activeTab).toContainText("Catalog Governance");

    await page.goto("/dashboard?spoke=hub&tab=performance");
    await page.locator('tbody tr[data-division-row="Solid Body"] [data-division-next]').click();
    await expect(canvas.activeTab).toContainText("Retail Overview");
  });
});
