import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

/* X-33 and X-10: every ResizableTable has a search box; tables with a server export
   download what is shown, with the four facts ahead of the header. */
const TERM: Record<string, string> = { fender: "strat", ledlenser: "torch" };

for (const client of ["fender", "ledlenser"]) {
  test.describe(`table toolbar (${client})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
      ]);
    });

    test("search narrows Out of Stock and Download CSV saves the matching rows", async ({ page }) => {
      test.setTimeout(120_000);
      const query = client === "fender" ? "" : `client=${client}&`;
      await page.goto(`/dashboard?${query}spoke=ecommerce&tab=out-of-stock`);
      const search = page.locator('[data-table-search="stock-loss"]');
      await expect(search).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-table-id="stock-loss"] tbody tr').first()).toBeVisible({ timeout: 60_000 });

      await search.fill(TERM[client]);
      const count = page.locator('[data-table-toolbar="stock-loss"] [data-table-search-count]');
      await expect(count).toHaveText(/^\d[\d,]* of \d[\d,]* rows$/);
      const matched = Number(await count.getAttribute("data-table-search-count"));
      expect(matched).toBeGreaterThan(0);

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.locator('[data-table-download="stock-loss"]').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^stock-loss-\d{4}-\d{2}-\d{2}\.csv$/);
      const lines = (await readFile((await download.path())!, "utf8")).trim().split("\n");
      expect(lines[0]).toContain(`Search ""${TERM[client]}""`);
      expect(lines[1]).toMatch(/^Sort,/);
      expect(lines[2]).toMatch(/^As of,/);
      expect(lines[3]).toMatch(/^Population,/);
      expect(lines[4]).toMatch(/^Listing,ASIN,/);
      expect(lines.length - 5).toBe(matched);

      await search.fill("zzqqxx no such listing");
      await expect(page.locator('[data-table-id="stock-loss"] [data-table-search-empty]')).toHaveText(
        "No rows match this search.",
      );
    });

    test("a sorted MAP table downloads in the order on screen", async ({ page }) => {
      test.setTimeout(120_000);
      const query = client === "fender" ? "" : `client=${client}&`;
      await page.goto(`/dashboard?${query}spoke=ecommerce&tab=map`);
      const rows = page.locator('[data-table-id="map-listings"] tbody tr:not(.set-aside-form-row)');
      await expect(rows.first()).toBeVisible({ timeout: 60_000 });
      await page.locator('[data-table-id="map-listings"] th[data-col-id="asin"] .ifai-sort-btn').click();
      const firstAsin = (await rows.first().locator(".asin-chip").textContent())?.trim();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.locator('[data-table-download="map-listings"]').click(),
      ]);
      const lines = (await readFile((await download.path())!, "utf8")).trim().split("\n");
      expect(lines[1]).toBe('Sort,"ASIN, A to Z."');
      expect(lines[4]).toMatch(/^Listing,ASIN,MAP,/);
      expect(lines[4]).toMatch(/,Status$/);
      expect(lines[5]).toContain(`,${firstAsin},`);
    });
  });
}
