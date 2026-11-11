import { expect, test } from "@playwright/test";
import { LIVE_READ_TIMEOUT, openSpokeTab } from "./figure-first-page";

let pageErrors: string[] = [];

test.describe("Roadmap 30-60-90 Days lays the plan out in three dated phases", () => {
  test.describe.configure({ timeout: 150_000 });
  test.afterEach(() => {
    expect(pageErrors, `unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });

  test("owner sentence, the bubble's figure, and three phases of actions with evidence", async ({ page, baseURL }) => {
    pageErrors = await openSpokeTab(page, baseURL, "roadmap", "30-60-90-days");
    const plan = page.locator(".drilldown-panel [data-roadmap-plan]");
    await expect(page.locator(".drilldown-tab-btn")).toHaveText(["30-60-90 Days"]);
    await expect(plan.locator("[data-roadmap-owner]")).toHaveText("IntoFocus's recommended plan for Fender");

    const lead = plan.locator("[data-roadmap-lead-figure]");
    await expect(lead).toHaveText(/^\d+ of \d+\*?$/, { timeout: LIVE_READ_TIMEOUT });
    // The bubble shows the same figure as a share: "5 of 5" reads "100.0%".
    const bubble = page.locator('[data-graph-node-id="spoke-roadmap"] .node-hero-value');
    const [, needs, stored, mark] = (await lead.innerText()).trim().match(/^(\d+) of (\d+)(\*?)$/)!;
    await expect(bubble).toHaveText(`${((100 * Number(needs)) / Number(stored)).toFixed(1)}%${mark}`);
    await expect(page.locator('[data-graph-node-id="spoke-roadmap"] .node-hero-label')).toContainText(/need\s*action/i);

    await expect(plan.locator("[data-roadmap-phase]")).toHaveCount(3);
    await expect(plan.locator(".roadmap-phase-days")).toHaveText(["Days 1 to 30", "Days 31 to 60", "Days 61 to 90"]);
    await expect(plan).toHaveAttribute("data-roadmap-sources", "ready", { timeout: 120_000 });
    for (const phase of await plan.locator("[data-roadmap-phase]").all()) {
      const items = phase.locator("[data-roadmap-item]");
      if ((await items.count()) === 0) {
        await expect(phase.locator("[data-roadmap-phase-empty]")).toHaveText("No action in this phase in this reading.");
        continue;
      }
      for (const item of await items.all()) {
        await expect(item.locator("[data-fix-action]")).not.toBeEmpty();
        await expect(item.locator("[data-fix-open]")).toHaveText(/^Open .+ →$/);
      }
    }
    await expect(plan).not.toContainText(/90 Days|3 phases|retainer/);
  });

  test("Ledlenser reads its own plan", async ({ page, baseURL }) => {
    const host = new URL(baseURL ?? "http://localhost").hostname;
    await page.context().addCookies([{ name: "ifai_guest_ledlenser", value: "1", domain: host, path: "/" }]);
    pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error).split("\n")[0]));
    await page.goto("/dashboard?client=ledlenser&spoke=roadmap&tab=30-60-90-days");
    const skipLogin = page.getByRole("button", { name: "Skip Login" });
    if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
    const plan = page.locator(".drilldown-panel [data-roadmap-plan]");
    await expect(plan.locator("[data-roadmap-owner]")).toHaveText("IntoFocus's recommended plan for Ledlenser", {
      timeout: LIVE_READ_TIMEOUT,
    });
    await expect(plan.locator("[data-roadmap-lead-figure]")).toHaveText(/^\d+ of \d+\*?$/, { timeout: LIVE_READ_TIMEOUT });
    await expect(plan.locator("[data-roadmap-phase]")).toHaveCount(3);
  });
});
