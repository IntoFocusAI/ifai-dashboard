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
