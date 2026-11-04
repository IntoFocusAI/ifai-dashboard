import { expect, test } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 21.4 / FDD X-13: with canvas_metrics answering 500, the Summary Briefing retail
   lead names that read. The Active offers line (built from canvas_metrics) reads
   Not available* with the read in its custom tooltip. The Buy Box, MAP and bundle figures
   come from canvas_retail_listings and keep their values; the bundle tooltip names the
   missing catalog total. Every other read answers from e2e/catalog-health-mock.ts. */

test("Briefing retail lead on a failed canvas_metrics read", async ({ page }) => {
  const { errors } = await openCatalogHealthCanvas(page);
  await page.route(/\/rest\/v1\/canvas_metrics(\?|$)/, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ code: "XX000", message: "forced canvas_metrics failure" }),
    }),
  );
  await page.goto("/dashboard?spoke=hub&tab=briefing");
  const findings = page.locator("[data-briefing-findings]");
  await expect(findings).toBeVisible({ timeout: 60_000 });

  const body = page.locator(".drilldown-body");
  const offers = body.locator('.ifai-term[data-read-unavailable="canvas_metrics"]');
  await expect(offers).toHaveText("Not available*");
  await expect(offers).toHaveAttribute("data-ifai-tooltip-desc", /^The catalog metrics read \(canvas_metrics\) did not load/);
  await expect(offers).not.toHaveAttribute("title", /.+/);
  await expect(body).not.toContainText("The offer split is not stored");
  await expect(body).not.toContainText("Pending data");

  const ratios = findings.locator("[data-briefing-finding-ratio]");
  await expect(ratios).toContainText(["1 of 4", "3 of 5", "2 of 3 bundles with a live offer"]);
  const bundleTip = findings.locator('[aria-label*="bundles with a live offer have no usable parent"]').first();
  await expect(bundleTip).toHaveAttribute("aria-label", /The catalog metrics read \(canvas_metrics\) did not load/);

  await expect(async () => {
    await page.mouse.move(0, 0);
    await offers.hover();
    await expect(page.locator(".node-tooltip-definition")).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(page.locator(".node-tooltip-definition")).toContainText("(canvas_metrics) did not load");

  const unexpected = errors.filter((error) => !/canvas_metrics|500/.test(error));
  expect(unexpected, `unexpected page errors:\n${unexpected.join("\n")}`).toEqual([]);
});
