import { expect, test } from "@playwright/test";

/* X-02: one click on a satellite opens its tab, for each client. */
const SATELLITES: [parent: string, satellite: string, tab: string][] = [
  ["spoke-aeo", "sat-prompts", "Run Details"],
  ["spoke-aeo", "sat-citations", "Citation Ecosystem"],
  ["spoke-aeo", "sat-drift", "Product Fact Checks"],
  ["spoke-retail", "sat-buybox", "Suppressed Listings"],
  ["spoke-retail", "sat-asin", "Catalog Governance"],
  ["spoke-retail", "sat-map", "MAP"],
  ["spoke-specs", "sat-findability", "Findability"],
  ["spoke-specs", "sat-schema", "Brand-Site Specs"],
  ["spoke-specs", "sat-tables", "Amazon A+ Matrix"],
  ["spoke-competitors", "sat-taylor", "Competitor Wins"],
  ["spoke-competitors", "sat-amps", "Engine Comparison"],
];

for (const client of ["fender", "ledlenser"]) {
  test.describe(`satellites (${client})`, () => {
    for (const [parent, satellite, tab] of SATELLITES) {
      test(`${satellite} opens ${tab} in one click`, async ({ page }) => {
        await page.context().addCookies([
          { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
          { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
        ]);
        await page.goto(client === "fender" ? "/dashboard" : `/dashboard?client=${client}`);
        const circle = (id: string) => page.locator(`[data-graph-node-id="${id}"] > .node-inner > .node-circle`);
        await expect(circle(parent)).toBeVisible({ timeout: 30_000 });
        const at = await circle(parent).boundingBox();
        await page.mouse.move(at!.x + at!.width / 2, at!.y + at!.height / 2);
        await expect(page.locator(`[data-graph-node-id="${satellite}"]`)).toBeVisible();
        await page.waitForTimeout(1200);
        const box = await circle(satellite).boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 6 });
        const still = await circle(satellite).boundingBox();
        await page.mouse.click(still!.x + still!.width / 2, still!.y + still!.height / 2);
        await expect(page.locator(".drilldown-tab-btn.active")).toHaveText(new RegExp(`^${tab.replace(/[+]/g, "\\+")}`));
      });
    }
  });
}
