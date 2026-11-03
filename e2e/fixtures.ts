import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { mockSetAsides, type SetAsideMock } from "./set-aside-mock";

/** Thin page object over the v3 canvas so specs read as behaviour, not selectors. */
export class Canvas {
  constructor(readonly page: Page) {}

  async open() {
    // The guest flag the canvas reads is document.cookie. Set it before navigation
    // so the login card does not cover the map.
    await this.page.context().addCookies([
      { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
    ]);
    await this.page.goto("/dashboard");
    const skipLogin = this.page.getByRole("button", { name: "Skip Login" });
    if (await skipLogin.isVisible().catch(() => false)) {
      await skipLogin.click();
      await expect(this.page.locator(".graph-node").first()).toBeVisible();
    }
    await expect(this.page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);
  }

  /** Opens a spoke from the map column layout (panel starts hidden on IOM). */
  async openSpokeFromMap(titleFragment: string) {
    // Spoke titles are drawn as separate SVG lines, so the DOM text has no space.
    const pattern = new RegExp(titleFragment.trim().split(/\s+/).join("\\s*"), "i");
    await this.page.locator(".graph-node").filter({ hasText: pattern }).click({ force: true });
    await expect(this.page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(this.panel).toBeVisible();
  }

  /** Reload and wait for the canvas. A spoke in the URL reopens that spoke. */
  async reload() {
    await this.page.reload();
    await expect(this.page.locator(".ifai-canvas")).toBeVisible();
    await expect(this.page.locator(".graph-node").first()).toBeVisible();
  }

  get panel() {
    return this.page.locator(".drilldown-panel");
  }

  get commandCenter() {
    return this.page.locator(".command-center");
  }

  get priorities() {
    return this.page.locator(".cc-item");
  }

  /** A priority row by a fragment of its headline. */
  priority(titleFragment: string) {
    return this.priorities.filter({ hasText: titleFragment });
  }

  async openCommandCenter() {
    await this.page.locator(".hdr-btn", { hasText: "Priorities" }).click();
    await expect(this.commandCenter).toBeVisible();
  }

  async openPriority(titleFragment: string) {
    await this.openCommandCenter();
    await this.priority(titleFragment).locator(".cc-open-btn").click();
    await expect(this.page.locator(".drilldown-back-btn")).toBeVisible();
  }

  async backToPriorities() {
    await this.page.locator(".drilldown-back-btn").click();
    await expect(this.commandCenter).toBeVisible();
  }

  get activeTab() {
    return this.page.locator(".drilldown-tab-btn.active");
  }

  async openTab(nameFragment: string) {
    await this.page.locator(".drilldown-tab-btn", { hasText: nameFragment }).click();
    await expect(this.activeTab).toContainText(nameFragment);
  }

  get tourCard() {
    return this.page.locator(".tour-modal-card");
  }

  get tourStep() {
    return this.page.locator(".tour-step-pill");
  }

  get tourButton() {
    return this.page.locator(".tour-launcher.map-chrome-onscreen");
  }

  async startTour() {
    await this.tourButton.click();
    await expect(this.tourCard).toBeVisible();
  }

  async nextTourStep() {
    await this.page.locator(".tour-btn-primary").click();
  }

  get resumeChip() {
    return this.page.locator(".drilldown-resume-btn");
  }

  get simulations() {
    return this.page.locator("#ai-simulation-list .ai-sim-row");
  }

  filterChip(label: string) {
    return this.page.locator(".segmented-btn", { hasText: label });
  }

  /** AI Search Visibility -> the explorer over every call in the published run. */
  async openSimulations() {
    await this.openSpokeFromMap("AI Search Visibility");
    await this.openTab("Run Details");
    await expect(this.simulations.first()).toBeVisible();
  }
}

type Fixtures = {
  canvas: Canvas;
  /** Page errors seen during the test; asserted empty on teardown. */
  pageErrors: string[];
  /** In-memory set-aside endpoints; specs never write the live audit log. */
  setAsides: SetAsideMock;
};

/* Both fixtures are `auto` so every test starts on a loaded /v3 with the error
   listener attached, whether or not it destructures them. A spec that asks only
   for `page` would otherwise run against about:blank. */
export const test = base.extend<Fixtures>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        errors.push(`console: ${text}`);
      });
      await use(errors);
      // A dashboard that throws in the console is broken even if the assertion passed.
      expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],

  setAsides: [
    async ({ page }, use) => {
      await use(await mockSetAsides(page));
    },
    { auto: true },
  ],

  canvas: [
    async ({ page, pageErrors, setAsides }, use) => {
      void pageErrors; // ordering: attach the listener before the first navigation
      void setAsides; // and the set-aside routes, so live rows never shift the queue
      const canvas = new Canvas(page);
      await canvas.open();
      await use(canvas);
    },
    { auto: true },
  ],
});

export { expect };
export type { Locator };
