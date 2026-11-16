import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead, SPEC_ROWS } from "./spec-read-mock";

async function openAmazonSpecs(page: Page) {
  const canvas = new Canvas(page);
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(canvas.panel).toBeVisible();
  await canvas.openTab("Amazon Specs");
}

function fulfill(rows: unknown[]) {
  return {
    status: 200,
    contentType: "application/json",
    headers: {
      "content-range": `0-${rows.length - 1}/${rows.length}`,
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "content-range",
    },
    body: JSON.stringify(rows),
  };
}

test("Amazon Specs judges each product type against its list and names the fields it does not check (D-05)", async ({
  page,
}) => {
  await mockCanvasRead(page);
  const rows = SPEC_ROWS.map((row) => ({
    ...row,
    category: "Solid Body",
    amazon_spec_values: { color: "Black", scale_length: "25.5", upc: "123" },
  }));
  const types = SPEC_ROWS.map((row, index) => ({ asin: String(row.asin), product_type: index < 3 ? "GUITARS" : "SHIRT" }));
  await page.route("**/rest/v1/canvas_spec_readiness**", (route) => route.fulfill(fulfill(rows)));
  await page.route("**/rest/v1/canvas_amazon_product_types**", (route) => route.fulfill(fulfill(types)));
  await openAmazonSpecs(page);

  const line = page.locator("[data-amazon-specs-required-list='product-type']");
  await expect(line).toContainText("Required fields by Amazon product type: guitars (3 listings), checks 2 of 17 required fields*");
  const guitars = line.locator("[data-amazon-specs-product-type='GUITARS']");
  await expect(guitars.locator("[data-amazon-specs-coverage]")).toHaveAttribute("data-amazon-specs-coverage", "2/17");
  await expect(guitars.locator("[data-amazon-specs-checked-fields]")).toHaveAttribute(
    "data-amazon-specs-checked-fields",
    "color;scale_length",
  );
  await expect(guitars.locator("[data-figure-tip='amazon-specs-unchecked-fields']")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /does not record 15 of the 17 required fields for guitars, so they are not judged: Back material/,
  );
  // The listing whose product type has no list keeps the interim rule.
  await expect(page.locator("[data-amazon-specs-required-list='fill-rate']")).toContainText(
    "Other listings, required fields: top 10 by fill rate in Solid Body (1 listing)",
  );
  await expect(page.locator("[data-amazon-specs-lead]")).not.toContainText(/placeholder/i);
});

test("Amazon Specs keeps the interim rule when product types cannot be read", async ({ page }) => {
  await mockCanvasRead(page);
  await page.route("**/rest/v1/canvas_amazon_product_types**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "not found" }) }),
  );
  await openAmazonSpecs(page);
  await expect(page.locator("[data-amazon-specs-required-list='product-type']")).toHaveCount(0);
  await expect(page.locator("[data-amazon-specs-required-list='fill-rate']")).toContainText("Required fields: top 10 by fill rate");
});
