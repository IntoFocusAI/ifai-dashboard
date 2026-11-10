import { expect, test, type Page } from "@playwright/test";

/* At 1280x720 nothing scrolls sideways: not the page, and not any table container.
   Every spoke and every tab, for both clients. Tabs are read from the panel, so a
   new tab is covered without editing this file. */

const CLIENTS = ["fender", "ledlenser"] as const;
const SPOKES = [
  { id: "hub", name: "hub" },
  { id: "ecommerce", name: "ecommerce" },
  { id: "aeo", name: "aeo" },
  { id: "specs", name: "specs" },
  { id: "competitors", name: "competitors" },
  { id: "suggestions", name: "action items" },
  { id: "roadmap", name: "roadmap" },
] as const;

test.use({ viewport: { width: 1280, height: 720 } });

async function settle(page: Page) {
  // Live reads stream in after the tab opens; give them a bounded chance to land.
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

type Overflow = { page: { scroll: number; client: number }; tables: string[] };

async function measure(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const tables: string[] = [];
    const seen = new Set<Element>();
    const describe = (el: Element) =>
      el.getAttribute("data-table-id") ??
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""}`;
    const check = (el: Element) => {
      if (seen.has(el)) return;
      seen.add(el);
      const html = el as HTMLElement;
      if (html.offsetParent === null) return; // hidden
      if (html.scrollWidth - html.clientWidth > 1) {
        tables.push(`${describe(el)} (${html.scrollWidth} > ${html.clientWidth})`);
      }
    };
    // Named table scrollers.
    document.querySelectorAll("[data-table-id]").forEach(check);
    // Any ancestor of a <table> that can scroll on x.
    document.querySelectorAll("table").forEach((table) => {
      let el: Element | null = table.parentElement;
      while (el && el !== document.body) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") check(el);
        el = el.parentElement;
      }
    });
    return { page: { scroll: root.scrollWidth, client: root.clientWidth }, tables };
  });
}

function assertNoOverflow(o: Overflow, where: string) {
  expect.soft(o.page.scroll, `${where}: page scrolls sideways (${o.page.scroll} > ${o.page.client})`).toBeLessThanOrEqual(o.page.client);
  expect.soft(o.tables, `${where}: table container scrolls sideways`).toEqual([]);
}

for (const client of CLIENTS) {
  test.describe(`No sideways scroll at 1280x720 (${client})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
      ]);
    });

    for (const spoke of SPOKES) {
      test(`${spoke.name}: every tab fits`, async ({ page }) => {
        test.setTimeout(300_000);
        const query = client === "fender" ? "" : `client=${client}&`;
        await page.goto(`/dashboard?${query}spoke=${spoke.id}`);
        const skipLogin = page.getByRole("button", { name: "Skip Login" });
        if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
        await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
        await settle(page);

        const tabs = page.locator(".drilldown-tab-btn");
        const count = await tabs.count();
        if (count === 0) {
          assertNoOverflow(await measure(page), `${client} ${spoke.name}`);
          return;
        }
        for (let i = 0; i < count; i++) {
          const tab = tabs.nth(i);
          const label = (await tab.innerText()).trim().replace(/\s+/g, " ");
          await tab.click();
          await expect(tab).toHaveClass(/\bactive\b/);
          await settle(page);
          assertNoOverflow(await measure(page), `${client} ${spoke.name} › ${label}`);
        }
      });
    }
  });
}
