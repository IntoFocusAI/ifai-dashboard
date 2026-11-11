import { expect, test } from "./fixtures";

const heroText = (texts: string[]) => texts.map((text) => text.trim()).join(" ").trim();

test.describe("Minimal / Balanced view switch", () => {
  test("Balanced is the default and Minimal starts with six empty slots", async ({ page }) => {
    const toggle = page.locator("[data-view-mode-switch]");
    await expect(toggle.getByRole("button")).toHaveText(["Minimal", "Balanced"]);
    await expect(page.locator("[data-view-mode='balanced']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-minimal-view]")).toHaveCount(0);
    await expect(page.getByText(/deep dive|ask intofocus/i)).toHaveCount(0);

    await page.locator("[data-view-mode='minimal']").click();
    await expect(page.locator("[data-view-mode='minimal']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-minimal-view] .canvas-metric-widget.is-empty")).toHaveCount(3);
    await expect(page.locator("[data-minimal-view] .large-metric-slot.is-empty")).toHaveCount(3);
    await expect(page.locator(".viewport-container")).toBeHidden();
  });

  test("the picker groups most headline figures by area and filters as you type", async ({ canvas, page }) => {
    await page.locator("[data-view-mode='minimal']").click();
    await page.getByRole("button", { name: "Add metric to large slot 1" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose metric for large slot 1" });
    await expect(dialog.locator(".metric-widget-group h3")).toHaveText([
      "Summary",
      "Catalog Health",
      "AI Search Visibility",
      "AI Readiness",
      "Competitive Radar",
      "Action Items",
      "Roadmap",
      "Other",
    ]);
    await expect.poll(() => dialog.locator("[data-metric-option]").count()).toBeGreaterThanOrEqual(38);
    await expect(dialog.locator("[data-metric-option='suppressed-buy-box-withheld']")).toBeVisible();
    await expect(dialog.locator("[data-metric-option='sat-buybox']")).toBeVisible();

    const filter = dialog.getByRole("searchbox", { name: "Filter metrics" });
    await expect(filter).toBeFocused();
    await filter.fill("price gap");
    await expect(dialog.locator("[data-metric-option]")).toHaveCount(1);
    await filter.press("Enter");
    const slot = page.locator(".large-metric-body[data-metric-id='map-average-gap']");
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(canvas.activeTab).toContainText("MAP");
  });

  test("each question category and each Other figure is an option that opens its tab", async ({ canvas, page }) => {
    await page.locator("[data-view-mode='minimal']").click();
    await page.getByRole("button", { name: "Add metric to large slot 1" }).click();
    let dialog = page.getByRole("dialog", { name: "Choose metric for large slot 1" });
    for (const category of ["electrics", "acoustics", "amps", "basses", "squier", "beginner"]) {
      await expect(dialog.locator(`[data-metric-option='battlecards-${category}-unbranded']`)).toBeVisible();
    }
    const other = dialog.locator(".metric-widget-group").last();
    await expect(other.locator("h3")).toHaveText("Other");
    // The 90-day plan left Other: the Roadmap's 30-60-90 Days tab leads with it.
    await expect(other.locator("[data-metric-option]")).toHaveCount(7);
    const actuation = other.locator("[data-metric-option='ai-actuation']");
    await expect(actuation.locator("small.ifai-term")).toHaveText("Not available*");
    await expect(actuation.locator("strong .ifai-term")).toHaveAttribute("data-ifai-tooltip-desc", /No tab shows/);
    await actuation.click();
    const slot = page.locator(".large-metric-body[data-metric-id='ai-actuation']");
    await expect(slot.locator(".metric-widget-category")).toHaveText("Other");
    await expect(slot.locator("[data-large-metric-value]")).toHaveText("Not available*");
    await slot.click();
    await expect(canvas.activeTab).toContainText("Performance");
    await page.locator(".drilldown-hide-btn").click();

    await page.getByRole("button", { name: "Add metric to large slot 2" }).click();
    dialog = page.getByRole("dialog", { name: "Choose metric for large slot 2" });
    await dialog.locator("[data-metric-option='battlecards-electrics-unbranded']").click();
    await page.locator(".large-metric-body[data-metric-id='battlecards-electrics-unbranded']").click();
    await expect(canvas.activeTab).toContainText("Category Battlecards");
  });

  test("fender.com page found matches the AI Readiness bubble and opens Brand-Site Specs at its hero", async ({ canvas, page }) => {
    const bubbleFace = page.locator("[data-graph-node-id='spoke-specs'] .node-hero-value");
    await expect.poll(async () => heroText(await bubbleFace.allTextContents())).toMatch(/%/);
    const bubbleValue = heroText(await bubbleFace.allTextContents());

    await page.locator("[data-view-mode='minimal']").click();
    await page.getByRole("button", { name: "Add metric to large slot 1" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose metric for large slot 1" });
    const readiness = dialog.locator(".metric-widget-group").filter({ has: page.locator("h3", { hasText: "AI Readiness" }) });
    const option = readiness.locator("[data-metric-option='spoke-specs']");
    await expect(option).toContainText("fender.com page found");
    await option.click();

    const slot = page.locator(".large-metric-body[data-metric-id='spoke-specs']");
    await expect(slot.locator("[data-large-metric-value]")).toHaveText(bubbleValue);
    await expect(slot.locator("[data-large-metric-ratio]")).toHaveText(/^\d[\d,]* of \d[\d,]* checked SKUs$/);
    await expect(slot.locator("[data-citation-pie-disc='brand-site-page-found']")).toBeVisible();
    const ratio = (await slot.locator("[data-large-metric-ratio]").textContent())!.replace(" checked SKUs", "");

    await slot.click();
    await expect(canvas.activeTab).toContainText("Brand-Site Specs");
    const hero = page.locator("#brand-site-page-found[data-machine-hero='page_found']");
    await expect(hero).toBeInViewport({ ratio: 1 });
    await expect(hero.locator("[data-hero-percent]")).toHaveText(bubbleValue);
    await expect(hero.locator("[data-hero-ratio]")).toHaveText(ratio);
  });

  test("a picked metric matches the map, opens its tab, and is remembered", async ({ canvas, page }) => {
    const mapFace = page.locator("[data-graph-node-id='sat-map'] .node-hero-value");
    await expect.poll(async () => heroText(await mapFace.allTextContents())).toMatch(/%|Not available/);
    const mapValue = heroText(await mapFace.allTextContents());

    await page.locator("[data-view-mode='minimal']").click();
    await page.getByRole("button", { name: "Add metric to large slot 1" }).click();
    await page.getByRole("dialog", { name: "Choose metric for large slot 1" }).locator("[data-metric-option='sat-map']").click();
    const slot = page.locator(".large-metric-body[data-metric-id='sat-map']");
    await expect(slot.locator("[data-large-metric-value]")).toHaveText(mapValue);
    await expect(slot.locator("[data-large-metric-ratio]")).toContainText(/\d of \d/);

    await slot.click();
    await expect(canvas.activeTab).toContainText("MAP");
    await expect(canvas.panel).toContainText(mapValue);
    await page.locator(".drilldown-hide-btn").click();
    await expect(page.locator("[data-minimal-view]")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.locator("[data-view-mode='minimal']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-minimal-view]")).toBeVisible();
    await expect(page.locator(".large-metric-body[data-metric-id='sat-map'] [data-large-metric-value]")).toHaveText(mapValue);

    await page.locator("[data-view-mode='balanced']").click();
    await expect(page.locator("[data-minimal-view]")).toHaveCount(0);
    await expect.poll(async () => heroText(await mapFace.allTextContents())).toBe(mapValue);
    await page.locator("[data-graph-node-id='spoke-retail']").focus();
    await expect(page.locator("[data-hub-slot]")).toHaveCount(3);
  });
});
