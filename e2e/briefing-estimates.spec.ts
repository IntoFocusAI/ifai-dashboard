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
      // Worker 29.10: AI Consensus, the monthly card, then the findings by result, worst first.
      await expect(row.locator("[data-briefing-finding-ratio]")).toHaveCount(5, { timeout: AI_READ_MS });
      const cards = await row.locator(":scope > *").evaluateAll((nodes) =>
        nodes.map((node) => ({
          consensus: node.hasAttribute("data-briefing-consensus"),
          monthly: node.hasAttribute("data-briefing-revenue-placeholder"),
          status: node.querySelector("[data-status]")?.getAttribute("data-status") ?? "none",
        })),
      );
      expect(cards[0].consensus).toBe(true);
      expect(cards[1].monthly).toBe(true);
      const rank: Record<string, number> = { bad: 0, okay: 1, good: 2, none: 3 };
      const ranks = cards.slice(2).map((card) => rank[card.status] ?? 3);
      expect(ranks, `findings by result: ${ranks}`).toEqual([...ranks].sort((a, b) => a - b));
      await expect(row.locator("[data-briefing-consensus] [data-score-out-of]")).toHaveText("/100");
      await expect(row.locator("[data-briefing-consensus-target]")).toHaveText("Target 70");
      await expect(page.getByText("Portfolio at a glance")).toHaveCount(0);
      const lead = page.locator("[data-briefing-lead]");
      // Worker 31.1 (decisions 128, 129): "What this means for {brand}", four blocks and the selling-model line.
      await expect(lead).toContainText(`What this means for ${BRAND[client]}`);
      await expect(lead.locator('[data-briefing-block="answer"]')).toContainText(
        new RegExp(`When a shopper asks an AI assistant what to buy, ${BRAND[client]} is .*\\d+ times in 10\\.`),
        { timeout: AI_READ_MS },
      );
      await expect(lead.locator('[data-briefing-block="rely"]')).toContainText("Assistants decide by reading product pages, retailer listings and reviews.");
      await expect(lead.locator("[data-briefing-selling-model]")).toContainText(/^(Partner-led|Brand-led): /);
      await expect(lead.locator('[data-briefing-block="worth"]')).not.toContainText("Loading", { timeout: ESTIMATE_MS });
      await expect(lead.locator("[data-briefing-action-items]")).toHaveText("→ Action Items");
      await expect(lead).not.toContainText("Active offers");
      // Worker 29.4: every number in the generated lead carries thousands separators.
      expect(await lead.innerText()).not.toMatch(/\d{4,}/);
      await checkFit(page, `${client}-briefing`);
    });

    test("Briefing monthly card is Phase 1 divided by 12, opening a trail that says so", async ({ page }) => {
      test.slow();
      await openAs(page, client, "spoke=hub");
      const card = page.locator("[data-briefing-revenue-placeholder]");
      await expect(card.locator("[data-briefing-revenue-label]")).toHaveText("Monthly potential lost brand revenue");
      const trigger = card.locator("[data-estimate-trigger='monthly_potential']");
      // Worker 29.10: the mid is the figure; the range sits on its own line below it.
      await expect(trigger.locator(".estimate-trail-trigger-figure")).toHaveText(/^\$[\d.,]+[KM]?\*?$/, { timeout: ESTIMATE_MS });
      await expect(trigger.locator("[data-estimate-range]")).toHaveText(/^range \$[\d.,]+[KM]? to \$[\d.,]+[KM]?$/);
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
        await expect(phase.locator("[data-estimate-trigger='phase_1'] .estimate-trail-trigger-figure")).toHaveText(/^\$[\d.,]+[KM]?\*?$/, { timeout: ESTIMATE_MS });
        await expect(phase.locator("[data-estimate-trigger='phase_1'] [data-estimate-range]")).toHaveText(/^range \$[\d.,]+[KM]? to \$[\d.,]+[KM]?$/);
        // Table rows keep "mid, range low to high".
        await expect(page.locator("[data-estimate-row='phase_1'] [data-estimate-trigger]")).toContainText(/\$[\d.,]+[KM]?\*?, range \$/);
        await expect(phase).toContainText("analyst estimate");
        // Enterprise Potential waits for its AI part, so for the date-pill window's AI read (Worker 29.19).
        await expect(page.locator("[data-estimate-card='enterprise'] [data-estimate-trigger='enterprise_potential']")).toContainText(/\$[\d.,]+M/, { timeout: AI_READ_MS });
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

    // Worker 29.19 (chunk E5 light v1): lines 8 and 9 sit in the table, open their trails at Low
    // confidence, and Enterprise Potential carries their AI part, never Phase 1.
    test("opportunity: AI Search rows open their trails and join Enterprise, not Phase 1", async ({ page }) => {
      test.slow();
      await openAs(page, client, "spoke=hub&tab=opportunity");
      for (const [lineId, title] of [
        ["ai_unbranded", "AI Search: Unbranded Discovery gap"],
        ["ai_branded", "AI Search: Branded Consideration"],
      ] as const) {
        const row = page.locator(`[data-estimate-row='${lineId}']`);
        await expect(row).toContainText(title);
        const trigger = row.locator(`[data-estimate-trigger='${lineId}']`);
        await expect(trigger).toContainText(/^\$[\d.,]+[KM]?(, range \$[\d.,]+[KM]? to \$[\d.,]+[KM]?)?\*?analyst estimate$/, { timeout: AI_READ_MS });
        await trigger.click();
        const trail = page.getByRole("dialog");
        await expect(trail).toContainText(title);
        await expect(trail.locator("[data-estimate-grade='low']")).toBeVisible();
        await expect(trail.locator("[data-estimate-input='target']")).toBeVisible();
        await expect(trail.locator("[data-estimate-formula]")).toContainText("relative gap to");
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${client}-trail-${lineId}.png` });
        await page.keyboard.press("Escape");
      }
      await expect(page.locator("[data-estimate-row='phase_1'] [data-estimate-trigger]")).toBeVisible({ timeout: ESTIMATE_MS });
      await page.locator("[data-estimate-card='enterprise'] [data-estimate-trigger]").click();
      const enterprise = page.getByRole("dialog");
      await expect(enterprise.locator("[data-estimate-input='ai_part']")).toBeVisible();
      await expect(enterprise).not.toContainText("joins when the AI Search estimates are built");
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${client}-trail-enterprise.png` });
      await page.keyboard.press("Escape");
      await page.locator("[data-estimate-card='phase_one'] [data-estimate-trigger]").click();
      await expect(page.getByRole("dialog")).not.toContainText("AI Search");
    });

    test("Action Items bubble shows the Phase 1 formula, not a hand-entered figure", async ({ page }) => {
      test.slow();
      await openAs(page, client, "spoke=hub");
      const bubble = page.locator(".graph-node").filter({ hasText: /Action Items/i }).first();
      await expect(bubble).toContainText(/\+\$[\d.,]+[KM]\*? est\./, { timeout: ESTIMATE_MS });
      await expect(bubble).not.toContainText("+$680K");
    });
  });
}
