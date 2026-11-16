import { expect, test, type Page } from "@playwright/test";

/* A real 1280 px browser window leaves about 1264 px of viewport, and a vertical scrollbar
   takes about 17 px of that. Panels and frozen-header tables add scrollbars of their own.
   Brian saw the Run Summary engine table and the Category Battlecards table scroll sideways
   there. At 1264x720 with scrollbars drawn, no table in AI Search Visibility or Competitive
   Radar may scroll sideways inside its panel, for either client. Tabs are read from the
   panel, so a new tab is covered without editing this file. */

const CLIENTS = ["fender", "ledlenser"] as const;
const SPOKES = [
  { id: "aeo", name: "AI Search Visibility" },
  { id: "competitors", name: "Competitive Radar" },
] as const;
const WIDTH = 1264;
const SCROLLBAR = 17;

// Headless Chrome hides scrollbars by default; draw them so they take their real width.
test.use({ viewport: { width: WIDTH, height: 720 }, launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

type TableFit = { id: string; scroll: number; client: number };

async function measureTables(page: Page): Promise<{ page: TableFit; tables: TableFit[] }> {
  return page.evaluate(() => {
    const tables: TableFit[] = [];
    const seen = new Set<Element>();
    const describe = (el: Element) =>
      el.getAttribute("data-table-id") ??
      `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : ""}`;
    const check = (el: Element) => {
      if (seen.has(el)) return;
      seen.add(el);
      const html = el as HTMLElement;
      if (html.offsetParent === null) return;
      tables.push({ id: describe(el), scroll: html.scrollWidth, client: html.clientWidth });
    };
    document.querySelectorAll("[data-table-id]").forEach(check);
    document.querySelectorAll("table").forEach((table) => {
      let el: Element | null = table.parentElement;
      while (el && el !== document.body) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") check(el);
        el = el.parentElement;
      }
    });
    const root = document.documentElement;
    return { page: { id: "page", scroll: root.scrollWidth, client: root.clientWidth }, tables };
  });
}

for (const client of CLIENTS) {
  test.describe(`Tables fit at ${WIDTH}x720 with scrollbars (${client})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
      ]);
      // The page always carries a vertical scrollbar, as a long dashboard does in a real window.
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const style = document.createElement("style");
          style.textContent = "html { overflow-y: scroll !important; }";
          document.head.appendChild(style);
        });
      });
    });

    for (const spoke of SPOKES) {
      test(`${spoke.name}: no table scrolls sideways`, async ({ page }) => {
        test.setTimeout(300_000);
        const query = client === "fender" ? "" : `client=${client}&`;
        await page.goto(`/dashboard?${query}spoke=${spoke.id}`);
        const skipLogin = page.getByRole("button", { name: "Skip Login" });
        if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
        await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
        await settle(page);
        // Where the browser cannot draw a scrollbar, narrow the viewport by its width instead.
        const usable = await page.evaluate(() => document.documentElement.clientWidth);
        if (usable >= WIDTH) {
          await page.setViewportSize({ width: WIDTH - SCROLLBAR, height: 720 });
          await settle(page);
        }

        const tabs = page.locator(".drilldown-tab-btn");
        const count = await tabs.count();
        expect(count, `${spoke.name} has tabs`).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          const tab = tabs.nth(i);
          const label = (await tab.innerText()).trim().replace(/\s+/g, " ");
          await tab.click();
          await expect(tab).toHaveClass(/\bactive\b/);
          await settle(page);
          const fit = await measureTables(page);
          const where = `${client} ${spoke.name} › ${label}`;
          expect.soft(fit.page.scroll, `${where}: page scrolls sideways`).toBeLessThanOrEqual(fit.page.client);
          expect.soft(fit.tables.length, `${where}: at least one table measured`).toBeGreaterThan(0);
          const over = fit.tables.filter((t) => t.scroll - t.client > 1).map((t) => `${t.id} (${t.scroll} > ${t.client})`);
          expect.soft(over, `${where}: table scrolls sideways inside its panel`).toEqual([]);
        }
      });
    }
  });
}
