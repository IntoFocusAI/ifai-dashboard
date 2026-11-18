import { mkdirSync } from "node:fs";
import { AI_READ_MS, expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/* Worker 29.2, H-09 (decisions 105, 110, 112): Briefing, Opportunity and Revenue Estimates are
   generated from each client's settings and data, with the same sections in the same order for
   every client. Each brand is reached through the client switcher. Screenshots at 1280x720 go to
   E2E_SHOTS_DIR when it is set, and each is checked by script for sideways scroll. */

const ESTIMATE_MS = 60_000;
const SHOTS = process.env.E2E_SHOTS_DIR;

const BRAND: Record<string, string> = { fender: "Fender", ledlenser: "Ledlenser" };

async function openAs(page: Page, client: string, path: string) {
  await page.goto("/dashboard?spoke=hub");
  const switcher = page.getByLabel("Client brand");
  await expect(switcher).toBeVisible();
  if ((await switcher.inputValue()) !== client) {
    await Promise.all([page.waitForURL(new RegExp(`client=${client}`)), switcher.selectOption(client)]);
  }
  const query = client === "fender" ? "" : `client=${client}&`;
  await page.goto(`/dashboard?${query}${path}`);
}

async function checkFit(page: Page, name: string) {
  // Let the panel finish sliding in, so the check and the screenshot see its resting place.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const clipped = await page.evaluate(() => {
    const panel = document.querySelector("[data-revenue-estimates], [data-briefing-findings]");
    return panel ? panel.getBoundingClientRect().right - window.innerWidth : 0;
  });
  expect(clipped, `${name} runs past the right edge`).toBeLessThanOrEqual(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(0);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

for (const client of ["fender", "ledlenser"]) {
  test.describe(`Generated estimates (${client})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
      ]);
    });

    test("Briefing opens on AI Consensus Score and the lead section from the client's own data", async ({ page }) => {
      test.slow();
      await openAs(page, client, "spoke=hub");
      const row = page.locator("[data-briefing-findings]");
      await expect(row.locator("[data-briefing-consensus-title]").first()).toHaveText("AI Consensus Score");
      await expect(page.getByText("Portfolio at a glance")).toHaveCount(0);
      const lead = page.locator("[data-briefing-lead]");
      await expect(lead).toContainText(`What is changing what AI assistants recommend for ${BRAND[client]}?`);
      await expect(lead.locator("[data-briefing-lead-ai]")).toContainText(/Unbranded Discovery: .+ named most in [\d,]+ of [\d,]+ resolved answers/, { timeout: AI_READ_MS });
      await expect(lead.locator("[data-briefing-lead-controls] li").first()).toContainText(/Out of stock: [\d,]+ listings/, { timeout: ESTIMATE_MS });
      await expect(lead).toContainText(`${BRAND[client]}'s selling model on Amazon:`);
      // Worker 29.4: every number in the generated lead carries thousands separators.
      await expect(lead.locator("[data-briefing-lead-ai]")).toContainText(/[\d,]+ of [\d,]+ cited links/);
      expect(await lead.locator("[data-briefing-lead-ai]").innerText()).not.toMatch(/\d{4,}/);
      expect(await lead.locator("[data-briefing-lead-controls]").innerText()).not.toMatch(/\d{4,}/);
      await checkFit(page, `${client}-briefing`);
    });

    test("Briefing monthly card is Phase 1 divided by 12, opening a trail that says so", async ({ page }) => {
      test.slow();
      await openAs(page, client, "spoke=hub");
      const card = page.locator("[data-briefing-revenue-placeholder]");
      await expect(card.locator("[data-briefing-revenue-label]")).toHaveText("Monthly potential lost brand revenue");
      const trigger = card.locator("[data-estimate-trigger='monthly_potential']");
      await expect(trigger).toContainText(/\$[\d.,]+[KM]?, range \$[\d.,]+[KM]? to \$[\d.,]+[KM]?/, { timeout: ESTIMATE_MS });
      await expect(trigger).toContainText("analyst estimate");
      await trigger.click();
      const trail = page.getByRole("dialog");
      await expect(trail.locator("[data-estimate-formula]")).toContainText("Phase 1 divided by 12.");
      await expect(trail.locator("[data-estimate-coverage]")).toContainText(/measured/);
      await page.keyboard.press("Escape");
    });

    for (const [path, name] of [
      ["spoke=hub&tab=opportunity", "opportunity"],
      ["spoke=suggestions&tab=revenue-estimates", "revenue-estimates"],
    ] as const) {
      test(`${name}: Phase 1, Enterprise and MAP beside, each opening its trail`, async ({ page }) => {
        test.slow();
        await openAs(page, client, path);
        const phase = page.locator("[data-estimate-card='phase_one']");
        await expect(phase.locator("[data-estimate-trigger='phase_1']")).toContainText(/\$[\d.,]+[KM]?, range \$[\d.,]+[KM]? to \$[\d.,]+[KM]?/, { timeout: ESTIMATE_MS });
        await expect(phase).toContainText("analyst estimate");
        await expect(page.locator("[data-estimate-card='enterprise'] [data-estimate-trigger='enterprise_potential']")).toContainText(/\$[\d.,]+M/);
        await expect(page.locator("[data-estimate-card='map_leakage'] [data-estimate-trigger='map_leakage']")).toContainText("analyst estimate");
        const rows = page.locator("[data-estimate-method] tbody tr");
        await expect(rows.first()).toContainText("Out of stock");
        await expect(page.locator("[data-estimate-row='miscategorized'] [data-estimate-not-prepared]")).toHaveText("Not available*");
        // Worker 29.4 (decision 112): each figure is split between measured and estimated sales.
        const oos = page.locator("[data-estimate-row='out_of_stock']");
        await expect(oos.locator("[data-estimate-measured]")).toHaveText(/^\$[\d.,]+[KM]?$/);
        await expect(oos.locator("[data-estimate-estimated]")).toHaveText(/^\$[\d.,]+[KM]?$/);
        await expect(oos.locator("[data-estimate-listings] [data-figure-tip]")).toHaveAttribute("data-ifai-tooltip-desc", /listings measured \([\d,]+ with no sales\)/);
        const tableOverflow = await page.locator("[data-estimate-method] .table-scroll").evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(tableOverflow, `${name} table scrolls sideways`).toBeLessThanOrEqual(0);
        await checkFit(page, `${client}-${name}`);

        await oos.locator("[data-estimate-trigger]").click();
        const oosTrail = page.getByRole("dialog");
        await expect(oosTrail.locator("[data-estimate-coverage]")).toContainText(/measured \([\d,]+ with no sales\), [\d,]+ estimated/);
        await expect(oosTrail.locator("[data-estimate-split-source='smartscout'] [data-estimate-split-estimate]")).toHaveText(/^\$[\d.,]+[KM]?$/);
        await page.keyboard.press("Escape");

        await phase.locator("[data-estimate-trigger='phase_1']").click();
        const trail = page.getByRole("dialog");
        await expect(trail).toContainText("Near-term upside (Phase 1)");
        await page.keyboard.press("Escape");
        await page.locator("[data-estimate-card='enterprise'] [data-estimate-trigger]").click();
        await expect(page.getByRole("dialog")).toContainText(/placeholder/i);
      });
    }

    test("Action Items bubble shows the Phase 1 formula, not a hand-entered figure", async ({ page }) => {
      test.slow();
      await openAs(page, client, "spoke=hub");
      const bubble = page.locator(".graph-node").filter({ hasText: /Action Items/i }).first();
      await expect(bubble).toContainText(/\+\$[\d.,]+[KM]\*? est\./, { timeout: ESTIMATE_MS });
      await expect(bubble).not.toContainText("+$680K");
    });
  });
}
