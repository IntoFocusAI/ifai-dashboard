import { expect, test, type Page } from "@playwright/test";

/* Worker 28.14, parity chunk C5 revised by decision 106: the strongest and weakest question
   category come from each client's own loaded questions, on the date pill's read. No client
   shows a fixed beginner figure. Live read, both clients. */

const CLIENTS = { fender: "Fender", ledlenser: "Ledlenser" } as const;
type Client = keyof typeof CLIENTS;

const url = (client: Client, query = "") =>
  `/dashboard${client === "fender" ? (query ? `?${query}` : "") : `?client=${client}${query ? `&${query}` : ""}`}`;

const FIGURE = /^([+-]\d+(\.\d)? pts|Not available\*)$/;
const HEADLINE = /^(.+) leads (.+) by \d+(\.\d)? pts\. /;

async function guest(page: Page) {
  await page.context().addCookies([
    { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
    { name: "ifai_guest_ledlenser", value: "1", domain: "localhost", path: "/" },
  ]);
}

async function choose(page: Page, slot: number, id: string) {
  await page.getByRole("button", { name: `Add metric to large slot ${slot}` }).click();
  const dialog = page.getByRole("dialog", { name: `Choose metric for large slot ${slot}` });
  await expect(dialog.locator(`[data-metric-option='${id}']`)).toBeVisible();
  await expect(dialog).not.toContainText(/beginner/i);
  await expect(dialog.locator("[data-metric-option='beginner-sov-gap']")).toHaveCount(0);
  await dialog.locator(`[data-metric-option='${id}']`).click();
  return page.locator(`.large-metric-body[data-metric-id='${id}']`);
}

for (const client of Object.keys(CLIENTS) as Client[]) {
  test.describe(`Strongest and weakest question category (${client})`, () => {
    test.beforeEach(async ({ page }) => guest(page));

    test("Minimal view reads both figures from the client's own categories and opens Category Battlecards", async ({ page }) => {
      test.setTimeout(300_000);
      await page.goto(url(client));
      await page.locator("[data-view-mode='minimal']").click();

      const strongest = await choose(page, 1, "strongest-category-sov");
      const weakest = await choose(page, 2, "weakest-category-gap");
      await expect(strongest.locator(".large-metric-label")).toHaveText(`Strongest category for ${CLIENTS[client]}`);
      await expect(weakest.locator(".large-metric-label")).toHaveText("Weakest category: gap to top rival");

      const evidence: Record<string, { value: string; ratio: string; missing: string | null }> = {};
      for (const [name, slot] of [["strongest", strongest], ["weakest", weakest]] as const) {
        const value = slot.locator("[data-large-metric-value]");
        await expect(value).toHaveText(FIGURE, { timeout: 180_000 });
        const text = (await value.innerText()).trim();
        const ratio = (await slot.locator("[data-large-metric-ratio]").allInnerTexts()).join(" ").trim();
        const missing = await value.getAttribute("data-ifai-tooltip-desc");
        if (text === "Not available*") {
          expect(missing, `${name} explains why no category qualifies`).toBeTruthy();
        } else {
          expect(ratio).toMatch(HEADLINE);
          expect(ratio).toMatch(/ of \d+ resolved .+ Unbranded Discovery answers$/);
        }
        evidence[name] = { value: text, ratio, missing };
        const box = await slot.evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
        expect(box.scroll, `${name} slot does not overflow`).toBeLessThanOrEqual(box.client + 1);
      }
      console.log(`EVIDENCE ${client} ${JSON.stringify(evidence)}`);
      if (client === "ledlenser") {
        expect(JSON.stringify(evidence)).not.toMatch(/guitar|Squier|Fender|Yamaha|Taylor|Gibson|beginner/i);
      }

      // The weakest figure names the rival the Battlecards pie names for that category.
      const match = evidence.weakest.ratio.match(HEADLINE);
      await weakest.click();
      await expect(page.locator(".drilldown-tab-btn.active")).toContainText("Category Battlecards");
      if (match) {
        const [, rival, category] = match;
        const pie = page.locator(`[data-ai-on-track-status='behind']`).filter({ hasText: category });
        await expect(pie.first()).toBeVisible({ timeout: 180_000 });
        await expect(pie.first().locator(`[data-ai-battle-rival="${rival}"]`)).toHaveCount(1);
      }
    });

    test("Competitive Radar shows no beginner figure", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(url(client, "spoke=competitors&tab=category-battlecards"));
      await expect(page.locator("[data-ai-on-track-category]").first()).toBeVisible({ timeout: 180_000 });
      const categories = await page.locator("[data-ai-on-track-category]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-ai-on-track-category")),
      );
      console.log(`CATEGORIES ${client} ${JSON.stringify(categories)}`);
      if (!categories.includes("beginner")) {
        await expect(page.locator("body")).not.toContainText(/beginner/i);
      }
    });
  });
}
