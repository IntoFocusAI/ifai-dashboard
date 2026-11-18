import { expect, test, type Page } from "@playwright/test";
import { LIVE_READ_TIMEOUT } from "./figure-first-page";

/* Worker 29.15 (SC-03 in the shared plan): the AI Actuation items in Action Items and the
   Roadmap, for each client reached through the client switcher. Each item comes from the stored
   Actuation basis; a program not in place asks to be confirmed in Days 1 to 30 and lists the
   community or publication sites AI already cites. Screenshots at 1280x720 go to E2E_SHOTS_DIR
   when it is set, and each is checked by script for sideways scroll. */

const SHOTS = process.env.E2E_SHOTS_DIR;
const PHASE: Record<string, string> = {
  confirm: "Days 1 to 30",
  renew: "Days 1 to 30",
  "E2:activity": "Days 31 to 60",
  "E3:activity": "Days 61 to 90",
};

async function openAs(page: Page, client: string, path: string) {
  await page.goto("/dashboard?spoke=hub");
  const skipLogin = page.getByRole("button", { name: "Skip Login" });
  if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
  const switcher = page.getByLabel("Client brand");
  await expect(switcher).toBeVisible({ timeout: LIVE_READ_TIMEOUT });
  if ((await switcher.inputValue()) !== client) {
    await Promise.all([page.waitForURL(new RegExp(`client=${client}`)), switcher.selectOption(client)]);
  }
  const query = client === "fender" ? "" : `client=${client}&`;
  await page.goto(`/dashboard?${query}${path}`);
}

async function fits(page: Page, name: string) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

function phaseOf(id: string): string {
  const rule = id.split(":").slice(1).join(":");
  return PHASE[rule] ?? PHASE[rule.split(":").at(-1) ?? ""] ?? "";
}

for (const client of ["fender", "ledlenser"]) {
  test.describe(`AI Actuation items in the plan (${client})`, () => {
    test.describe.configure({ timeout: 180_000 });
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
      ]);
    });

    test("Action Items lists each Actuation item in its phase, with suggested targets on a confirm item", async ({ page }) => {
      await openAs(page, client, "spoke=suggestions&tab=urgent-interventions");
      const list = page.locator(".drilldown-panel [data-fix-list]");
      await expect(list).toHaveAttribute("data-fix-sources", "ready", { timeout: 150_000 });
      // The table draws 25 rows at first; lower-ranked items sit behind "Show all".
      const showAll = list.locator("[data-table-show-all]");
      if (await showAll.count()) await showAll.click();
      const rows = list.locator('[data-fix-row^="actuation:"]');
      const ids = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-fix-row") ?? ""));
      // Records not read means no item; read records give at most two items per program.
      expect(ids.length).toBeLessThanOrEqual(4);
      for (const id of ids) {
        const row = list.locator(`[data-fix-row="${id}"]`);
        await expect(row.locator("[data-fix-phase]")).toContainText(phaseOf(id));
        await expect(row.locator("[data-fix-action]")).not.toBeEmpty();
        await expect(row.locator("[data-fix-open]")).toHaveText("Open Citation Ecosystem →");
        if (id.endsWith(":confirm")) {
          await expect(row.locator("[data-fix-action]")).toContainText(/^Confirm your .+ to IntoFocus: who owns it/);
          const targets = row.locator("[data-plan-target]");
          expect(await targets.count()).toBeLessThanOrEqual(5);
        }
      }
      await fits(page, `${client}-action-items`);
      const first = rows.first();
      if (ids.length) await first.scrollIntoViewIfNeeded();
      await fits(page, `${client}-action-items-actuation`);
    });

    test("the Roadmap places the same Actuation items in their phases", async ({ page }) => {
      await openAs(page, client, "spoke=roadmap&tab=30-60-90-days");
      const plan = page.locator(".drilldown-panel [data-roadmap-plan]");
      await expect(plan).toHaveAttribute("data-roadmap-sources", "ready", { timeout: 150_000 });
      const items = plan.locator('[data-roadmap-kind="actuation"]');
      const count = await items.count();
      expect(count).toBeLessThanOrEqual(4);
      for (const item of await items.all()) {
        const id = (await item.getAttribute("data-roadmap-item")) ?? "";
        const phase = item.locator("xpath=ancestor::section[@data-roadmap-phase]");
        await expect(phase.locator(".roadmap-phase-days")).toHaveText(phaseOf(id));
      }
      if (count) await items.first().scrollIntoViewIfNeeded();
      await fits(page, `${client}-roadmap-actuation`);
    });
  });
}
