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

    test("N of M rows shows before any search, and the Action Items fix list downloads its rows", async ({ page }) => {
      test.setTimeout(180_000);
      const query = client === "fender" ? "" : `client=${client}&`;
      await page.goto(`/dashboard?${query}spoke=suggestions&tab=urgent-interventions`);
      const rows = page.locator('[data-table-id="action-items-fixes"] tbody tr');
      await expect(rows.first()).toBeVisible({ timeout: 60_000 });
      // Wait for the source runs and the 30-day windows, so the screen holds every row.
      await expect(page.locator("[data-fix-sources-loading]")).toHaveCount(0, { timeout: 90_000 });
      const count = page.locator('[data-table-toolbar="action-items-fixes"] [data-table-search-count]');
      const total = await rows.count();
      await expect(count).toHaveText(`${total} of ${total} rows`);

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 90_000 }),
        page.locator('[data-table-download="action-items-fixes"]').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^action-items-fixes-\d{4}-\d{2}-\d{2}\.csv$/);
      const text = await readFile((await download.path())!, "utf8");
      const lines = text.trim().split("\n");
      expect(lines[0]).toBe("Filter,No filter.");
      expect(lines[1]).toBe("Sort,Priority order.");
      expect(lines[2]).toMatch(/^As of,/);
      expect(lines[3]).toMatch(/^Population,"5 current findings, then \d+ actions?\."$/);
      expect(lines[4]).toBe("#,What to fix,Finding,Status,Phase,Evidence,Cited pages");
      expect(lines.length - 5).toBe(total);
      const ranks = await rows.locator("[data-fix-rank]").allInnerTexts();
      expect(lines.slice(5).map((line) => line.split(",")[0])).toEqual(ranks.map((rank) => rank.trim()));
    });

    test("the open Findability outcome downloads its listings", async ({ page }) => {
      test.setTimeout(120_000);
      const query = client === "fender" ? "" : `client=${client}&`;
      await page.goto(`/dashboard?${query}spoke=specs&tab=findability`);
      const rows = page.locator('[data-table-id="findability-listings"] tbody tr');
      await expect(rows.first()).toBeVisible({ timeout: 60_000 });
      const count = page.locator('[data-table-toolbar="findability-listings"] [data-table-search-count]');
      await expect(count).toHaveText(/^[\d,]+ of [\d,]+ rows$/);
      const matched = Number(await count.getAttribute("data-table-search-count"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.locator('[data-table-download="findability-listings"]').click(),
      ]);
      const lines = (await readFile((await download.path())!, "utf8")).trim().split("\n");
      expect(lines[0]).toMatch(/^Filter,Outcome: /);
      expect(lines[4]).toMatch(/^ASIN,Listing,/);
      expect(lines.length - 5).toBe(matched);
      const firstAsin = (await rows.first().locator("td").first().innerText()).trim();
      expect(lines[5]!.startsWith(`${firstAsin},`)).toBe(true);
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

test("the prompt list downloads the prompts on screen (fender)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.context().addCookies([{ name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" }]);
  await page.goto("/dashboard");
  await page.locator(".hdr-btn", { hasText: "Prompts" }).click();
  const count = page.locator("[data-prompt-search-count]");
  await expect(page.locator(".pe-item").first()).toBeVisible({ timeout: 60_000 });
  await expect(count).toHaveText(/^[\d,]+ of [\d,]+ prompts$/);
  const asked = Number(await count.getAttribute("data-prompt-search-count"));
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.locator('[data-table-download="prompts"]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^prompts-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = (await readFile((await download.path())!, "utf8")).trim().split("\n");
  expect(lines[3]).toMatch(/^Population,/);
  expect(lines[4]).toBe("Prompt key,Category,Kind,Prompt,Status");
  const statuses = lines.slice(5).map((line) => line.split(",").at(-1));
  expect(statuses.filter((status) => status === "Asked")).toHaveLength(asked);
});
