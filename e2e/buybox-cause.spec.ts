import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* Audit recommendation 3: Buy Box withheld split by its stored cause, for every client from one
   template. Catalog Health shows the split as N of M and, for price-caused listings, the lower
   outside price on file with its page when one is stored. Action Items shows one row per cause,
   with the same counts. Screenshots and the figures read go to BB_SHOTS when it is set. */

const CLIENTS = ["fender", "ledlenser"] as const;
const LIVE_MS = 90_000;
const SHOTS = process.env.BB_SHOTS ?? "";

test.use({ viewport: { width: 1280, height: 720 } });

async function open(page: Page, client: string, spoke: string, tab: string) {
  await page.context().addCookies(
    CLIENTS.map((c) => ({ name: `ifai_guest_${c}`, value: "1", domain: "localhost", path: "/" })),
  );
  const query = client === "fender" ? "" : `client=${client}&`;
  await page.goto(`/dashboard?${query}spoke=${spoke}&tab=${tab}`);
  await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
}

function save(name: string, data: unknown) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/${name}.json`, JSON.stringify(data, null, 2));
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function sideways(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.querySelector(".drilldown-body");
    return Math.max(root.scrollWidth - root.clientWidth, body ? body.scrollWidth - body.clientWidth : 0);
  });
}

for (const client of CLIENTS) {
  test.describe(`Buy Box withheld by cause (${client})`, () => {
    test.describe.configure({ timeout: 180_000 });

    test("Suppressed Listings shows the split and the lower price on file", async ({ page }) => {
      await open(page, client, "ecommerce", "suppressed-listings");
      const card = page.locator("[data-buybox-cause-split]");
      await expect(card).toBeVisible({ timeout: LIVE_MS });
      const price = Number(await card.locator('[data-buybox-cause="price"]').getAttribute("data-buybox-cause-count"));
      const other = Number(await card.locator('[data-buybox-cause="other"]').getAttribute("data-buybox-cause-count"));
      const total = price + other;
      await expect(card.locator('[data-buybox-cause="price"]')).toContainText(`${price} of ${total}`);
      await expect(card.locator('[data-buybox-cause="price"]')).toContainText("Priced above Amazon's reference price");
      await expect(card.locator('[data-buybox-cause="other"]')).toContainText(`${other} of ${total}`);
      await expect(card.locator('[data-buybox-cause="other"]')).toContainText("Other or unknown cause");

      const table = page.locator('[data-table-id="suppressed-listings"]');
      await expect(table.locator("tbody tr").first()).toBeVisible();
      await expect(table.locator("th", { hasText: "Lower price elsewhere" })).toHaveCount(1);
      // The table may show its first rows only; every row shown has the cell.
      const shown = await table.locator("tbody tr:has(.listing-name)").count();
      await expect(table.locator("tbody [data-lower-price]")).toHaveCount(shown);
      const lower = price > 0 ? Number(await card.locator("[data-buybox-lower-count]").getAttribute("data-buybox-lower-count")) : 0;
      if (price > 0) await expect(card.locator("[data-buybox-lower-count]")).toContainText(`${lower} of ${price}`);
      const lowerShown = await table.locator("tbody td[data-lower-price]:has([data-lower-price-channel])").count();
      expect(lowerShown).toBeLessThanOrEqual(lower);
      const links = await table.locator("tbody [data-lower-price-channel] a").evaluateAll((nodes) =>
        nodes.map((node) => ({ text: node.textContent ?? "", href: node.getAttribute("href") ?? "" })),
      );
      for (const link of links) {
        expect(link.href).toMatch(/^https:\/\//);
        expect(link.text).toMatch(/\$[\d,]+\.\d{2}$/);
      }
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      await shot(page, `${client}-suppressed-listings`);
      save(`${client}-suppressed-listings`, { price, other, withheld: total, lowerOnFile: lower, links });
    });

    test("Action Items lists one row per cause with the same counts and a dollar each", async ({ page }) => {
      await open(page, client, "ecommerce", "suppressed-listings");
      const card = page.locator("[data-buybox-cause-split]");
      await expect(card).toBeVisible({ timeout: LIVE_MS });
      const price = Number(await card.locator('[data-buybox-cause="price"]').getAttribute("data-buybox-cause-count"));
      const other = Number(await card.locator('[data-buybox-cause="other"]').getAttribute("data-buybox-cause-count"));

      await open(page, client, "suggestions", "urgent-interventions");
      const list = page.locator("[data-fix-list]");
      await expect(list.locator('[data-fix-estimate="loading"]')).toHaveCount(0, { timeout: LIVE_MS });
      if (price === 0 || other === 0) {
        await expect(list.locator('[data-fix-row="finding:buy_box"]')).toHaveCount(1);
        return;
      }
      const priceRow = list.locator('[data-fix-row="finding:buy_box:price"]');
      const otherRow = list.locator('[data-fix-row="finding:buy_box:other"]');
      await expect(priceRow).toHaveCount(1, { timeout: LIVE_MS });
      await expect(list.locator('[data-fix-row="finding:buy_box"]')).toHaveCount(0);
      const noun = (n: number) => (n === 1 ? "listing" : "listings");
      await expect(priceRow.locator("[data-fix-action]")).toHaveText(
        `Review pricing on ${price} ${noun(price)} priced above Amazon's reference price.`,
      );
      await expect(otherRow.locator("[data-fix-action]")).toHaveText(
        `Check ${other} ${noun(other)} without the Buy Box for other causes.`,
      );
      await expect(priceRow.locator("[data-fix-ratio]")).toHaveText(new RegExp(`^${price} of [\\d,]+`));
      await expect(otherRow.locator("[data-fix-ratio]")).toHaveText(new RegExp(`^${other} of [\\d,]+`));
      const figures: Record<string, string> = {};
      for (const [id, row] of [["price", priceRow], ["other", otherRow]] as const) {
        const cell = row.locator("[data-fix-estimate]");
        const status = await cell.getAttribute("data-fix-estimate");
        if (status === "estimated") {
          await expect(cell).toContainText("analyst estimate");
          const trigger = cell.locator("[data-estimate-trigger]");
          figures[id] = `${await trigger.innerText()} (mid ${await trigger.getAttribute("data-estimate-mid")})`;
          await trigger.click();
          const dialog = page.locator('[role="dialog"][data-estimate-trail="buy_box"]');
          await expect(dialog).toBeVisible();
          await expect(dialog).toContainText(id === "price" ? "priced above Amazon's reference price" : "other or unknown cause");
          await page.keyboard.press("Escape");
          await expect(dialog).toHaveCount(0);
        } else {
          figures[id] = status ?? "";
        }
      }
      await priceRow.scrollIntoViewIfNeeded();
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      await shot(page, `${client}-action-items`);
      save(`${client}-action-items`, { price, other, figures });
    });
  });
}
