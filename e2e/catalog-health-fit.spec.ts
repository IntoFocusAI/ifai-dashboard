import { expect, test, type Page } from "@playwright/test";

/* Worker 24.3: at 1280x720 every Catalog Health table fits the panel with no sideways scroll,
   and a listing name takes two lines at most. Both clients, on the live read. The Retail
   Overview hero row keeps four cards of one layout, the AI Commerce card included. */

type Step = { tab: string; table: string; open?: (page: Page) => Promise<void> };

const STEPS: Step[] = [
  {
    tab: "retail-overview",
    table: "explore-listings",
    open: async (page) => {
      await page.getByRole("button", { name: "Explore all listings" }).click();
    },
  },
  { tab: "suppressed-listings", table: "suppressed-listings" },
  { tab: "map-leakage", table: "map-listings" },
  { tab: "catalog-governance", table: "catalog-bundles" },
  {
    tab: "catalog-governance",
    table: "catalog-spec-gaps",
    open: async (page) => {
      await page.locator("[data-catalog-spec-hero] .retail-explore").click();
    },
  },
  { tab: "out-of-stock", table: "stock-loss" },
];

type Fit = { client: number; scroll: number; nameLines: number; rows: number };

async function measure(page: Page, table: string): Promise<Fit> {
  return page.locator(`[data-table-id="${table}"]`).evaluate((scroller) => {
    const names = Array.from(scroller.querySelectorAll<HTMLElement>("tbody .listing-name"));
    const lines = names.map((name) => {
      const lineHeight = parseFloat(getComputedStyle(name).lineHeight) || 16;
      return Math.round(name.getBoundingClientRect().height / lineHeight);
    });
    return {
      client: scroller.clientWidth,
      scroll: scroller.scrollWidth,
      nameLines: lines.length ? Math.max(...lines) : 0,
      rows: names.length,
    };
  });
}

for (const client of ["fender", "ledlenser"]) {
  test.describe(`Catalog Health at 1280x720 (${client})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
      ]);
    });

    for (const step of STEPS) {
      test(`${step.table} fits the panel and names take two lines at most`, async ({ page }) => {
        test.setTimeout(120_000);
        const query = client === "fender" ? "" : `client=${client}&`;
        await page.goto(`/dashboard?${query}spoke=ecommerce&tab=${step.tab}`);
        await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
        if (step.open) await step.open(page);
        const scroller = page.locator(`[data-table-id="${step.table}"]`);
        await expect(scroller.locator("tbody .listing-name").first()).toBeVisible({ timeout: 60_000 });
        // Column widths settle after fonts load and the header floors are measured.
        await expect
          .poll(async () => {
            const fit = await measure(page, step.table);
            return fit.scroll - fit.client;
          }, { timeout: 15_000 })
          .toBeLessThanOrEqual(0);
        const fit = await measure(page, step.table);
        expect(fit.rows).toBeGreaterThan(0);
        expect(fit.nameLines).toBeLessThanOrEqual(2);
        // The panel body itself never scrolls sideways either.
        const sideways = await page
          .locator(".drilldown-body")
          .evaluate((body) => body.scrollWidth - body.clientWidth);
        expect(sideways).toBeLessThanOrEqual(0);
      });
    }

    test("Retail Overview keeps four hero cards of one layout", async ({ page }) => {
      test.setTimeout(120_000);
      const query = client === "fender" ? "" : `client=${client}&`;
      await page.goto(`/dashboard?${query}spoke=ecommerce&tab=retail-overview`);
      const cards = page.locator("[data-retail-overview-lead] > .retail-overview-hero");
      await expect(cards).toHaveCount(4, { timeout: 60_000 });
      // AI Commerce carries the status mark and word, and its disc uses the chart tokens.
      const commerce = page.locator("[data-consensus-commerce-hero]");
      await expect(commerce.locator("[data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
      await expect(commerce.locator("[data-chart-measured]")).toHaveCount(1);
      const boxes = await cards.evaluateAll((nodes) =>
        nodes.map((node) => {
          const card = node.getBoundingClientRect();
          const disc = node.querySelector("[data-citation-pie-disc]")?.getBoundingClientRect();
          const figure = node.querySelector(".ai-lead-figure")?.getBoundingClientRect();
          return {
            width: Math.round(card.width),
            height: Math.round(card.height),
            top: Math.round(card.top),
            // The disc sits beside the figure, never under the text.
            discBeside: disc && figure ? disc.left > figure.right && disc.top < figure.bottom + 8 : false,
          };
        }),
      );
      expect(new Set(boxes.map((box) => box.top)).size).toBe(1);
      expect(new Set(boxes.map((box) => box.height)).size).toBe(1);
      expect(Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width))).toBeLessThanOrEqual(2);
      expect(boxes.every((box) => box.discBeside)).toBe(true);
    });
  });
}
