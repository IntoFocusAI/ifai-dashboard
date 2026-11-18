import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/* E4 (decision 112): a dollar on each Action Items fix-list row and a yearly line on Out of Stock,
   MAP Leakage, Amazon Specs and Amazon A+ Matrix, for every client from one template. Each client
   is reached through the client switcher. Each figure is labeled analyst estimate and opens its
   trail. Screenshots at 1280x720 go to E4_SHOTS when it is set, with the figures read. */

const CLIENTS = ["fender", "ledlenser"] as const;
const ESTIMATE_MS = 90_000;
const SHOTS = process.env.E4_SHOTS ?? "";
const ROW_LINES = ["finding:buy_box", "finding:map_leakage", "finding:splintered_bundles", "signal:out_of_stock", "signal:missing_specs", "estimate:aplus"];
const MID = /^(\$[\d.,]+[KMB]?|Not available\*)$/;

const TABS = [
  { spoke: "ecommerce", slug: "out-of-stock", tab: "Out of Stock", line: "out_of_stock" },
  { spoke: "ecommerce", slug: "map", tab: "MAP Leakage", line: "map_leakage" },
  { spoke: "specs", slug: "amazon-specs", tab: "Amazon Specs", line: "missing_specs" },
  { spoke: "specs", slug: "amazon-specs", tab: "A+ Matrix", line: "aplus" },
] as const;

test.use({ viewport: { width: 1280, height: 720 } });

async function switchTo(page: Page, client: (typeof CLIENTS)[number]) {
  await page.context().addCookies(CLIENTS.map((c) => ({ name: `ifai_guest_${c}`, value: "1", domain: "localhost", path: "/" })));
  const select = page.locator('select[aria-label="Client brand"]');
  if (client !== "fender") {
    await select.selectOption(client);
    await expect(page).toHaveURL(new RegExp(`client=${client}`));
  }
  await expect(page.locator('select[aria-label="Client brand"]')).toHaveValue(client);
}

async function openTab(page: Page, client: string, spoke: string, slug: string, tab?: string) {
  const query = client === "fender" ? "" : `client=${client}&`;
  await page.goto(`/dashboard?${query}spoke=${spoke}&tab=${slug}`);
  await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
  if (tab) {
    await page.locator(".drilldown-tab-btn", { hasText: tab }).click();
    await expect(page.locator(".drilldown-tab-btn.active")).toContainText(tab);
  }
}

/** No sideways page scroll, and no estimate figure wider than its box. */
async function fits(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const clipped = [...document.querySelectorAll<HTMLElement>("[data-estimate-line-card], [data-fix-estimate-cell]")]
      .filter((el) => el.offsetParent !== null && el.scrollWidth - el.clientWidth > 1)
      .map((el) => el.getAttribute("data-estimate-line-card") ?? "fix cell");
    return { scroll: root.scrollWidth - root.clientWidth, clipped };
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Opens the trail from a figure and closes it again. */
async function opensTrail(page: Page, trigger: ReturnType<Page["locator"]>, lineId: string) {
  await trigger.click();
  const dialog = page.locator(`[role="dialog"][data-estimate-trail="${lineId}"]`);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

for (const client of CLIENTS) {
  test.describe(`E4 estimate rows and tab lines (${client})`, () => {
    test.describe.configure({ timeout: 300_000 });

    test("each fix-list row with a listing line shows its dollar, labeled, opening its trail", async ({ page }) => {
      await switchTo(page, client);
      await openTab(page, client, "suggestions", "urgent-interventions");
      const cells = page.locator("[data-fix-list] [data-fix-estimate]");
      await expect(page.locator('[data-fix-list] [data-fix-estimate="loading"]')).toHaveCount(0, { timeout: ESTIMATE_MS });
      await expect(page.locator("[data-fix-list] [data-fix-estimate-cell]").first()).toBeVisible();
      const figures: Record<string, string> = {};
      for (const id of ROW_LINES) {
        const row = page.locator(`[data-fix-row="${id}"]`);
        if ((await row.count()) === 0) continue;
        const cell = row.locator("[data-fix-estimate]");
        if ((await cell.count()) === 0) continue; // the line touches no listing
        const text = (await cell.innerText()).replace(/\s+/g, " ").trim();
        figures[id] = text;
        const status = await cell.getAttribute("data-fix-estimate");
        if (status === "estimated") {
          await expect(cell).toContainText("analyst estimate");
          const trigger = cell.locator("[data-estimate-trigger]");
          await expect(trigger).toHaveText(MID);
        } else {
          expect(status).toBe("not_available");
          await expect(cell).toHaveText("Not available*");
        }
      }
      expect(Object.keys(figures).length, JSON.stringify(figures)).toBeGreaterThan(0);
      // A+ content has its own row (line 7): its action reads "Add A+ content to {n} listing(s)." and the
      // own-pages row carries no dollar, so line 7 is never counted twice.
      const aplus = page.locator('[data-fix-row="estimate:aplus"]');
      if ((await aplus.count()) > 0) await expect(aplus).toContainText(/Add A\+ content to \d+ listings?\./);
      await expect(page.locator('[data-fix-row="own:pages"] [data-fix-estimate]')).toHaveCount(0);
      // The AI rows wait for the AI lines (E5): no dollar on them.
      await expect(page.locator('[data-fix-kind="source"] [data-fix-estimate]')).toHaveCount(0);
      const first = cells.locator("[data-estimate-trigger]").first();
      await opensTrail(page, first, (await first.getAttribute("data-estimate-trigger"))!);
      await page.locator("[data-fix-list]").scrollIntoViewIfNeeded();
      await shot(page, `${client}-action-items`);
      const fit = await fits(page);
      expect(fit.scroll).toBeLessThanOrEqual(0);
      expect(fit.clipped).toEqual([]);
      if (SHOTS) writeFileSync(`${SHOTS}/${client}-action-items.json`, JSON.stringify(figures, null, 2));
    });

    for (const tab of TABS) {
      test(`${tab.tab} shows the yearly ${tab.line} line, labeled, opening its trail`, async ({ page }) => {
        await switchTo(page, client);
        await openTab(page, client, tab.spoke, tab.slug, tab.tab === "A+ Matrix" ? tab.tab : undefined);
        const card = page.locator(`.drilldown-panel [data-estimate-line-card="${tab.line}"]`);
        await expect(card).toBeVisible({ timeout: ESTIMATE_MS });
        await expect(card).not.toHaveAttribute("data-estimate-line-status", "loading", { timeout: ESTIMATE_MS });
        await expect(card).toContainText("analyst estimate");
        await expect(card).toContainText(", per year");
        if (tab.line === "map_leakage") {
          await expect(card).toContainText("retail value below MAP");
          await expect(card).not.toContainText(/lost/i);
        }
        const figure = card.locator("[data-estimate-line-figure]");
        const status = await card.getAttribute("data-estimate-line-status");
        const text = (await card.innerText()).replace(/\s+/g, " ").trim();
        if (status === "estimated") {
          await expect(figure.locator("[data-estimate-trigger]")).toHaveText(MID);
          await opensTrail(page, figure.locator("[data-estimate-trigger]"), tab.line);
        } else {
          expect(status).toBe("not_available");
          await expect(figure).toHaveText("Not available*");
        }
        await card.scrollIntoViewIfNeeded();
        await shot(page, `${client}-${tab.line}`);
        const fit = await fits(page);
        expect(fit.scroll).toBeLessThanOrEqual(0);
        expect(fit.clipped).toEqual([]);
        if (SHOTS) writeFileSync(`${SHOTS}/${client}-${tab.line}.json`, JSON.stringify({ status, text }, null, 2));
      });
    }
  });
}
