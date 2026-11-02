import { expect, test } from "./fixtures";

/* Worker 18.5: a listing set aside on Amazon Specs is marked in place, listed in
   the history with who, why, and when, and reopens on the same row. */
test("an Amazon Specs listing can be set aside and reopened", async ({ canvas, page, setAsides }) => {
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await canvas.openTab("Amazon Specs");

  const table = page.locator("#spec-readiness-by-asin");
  const button = table.locator("[data-spec-set-aside]").first();
  await expect(button).toBeVisible();
  const asin = await button.getAttribute("data-spec-set-aside");
  expect(asin).toMatch(/^[A-Z0-9]{10}$/);

  await button.click();
  const form = table.locator("[data-set-aside-form]");
  await form.locator("[data-set-aside-reason]").selectOption("discontinued");
  await form.locator("[data-set-aside-name]").fill("Test Person");
  await form.locator("[data-set-aside-save]").click();

  await expect(table.locator(`[data-spec-set-aside-chip="${asin}"]`)).toHaveText("Set aside · Discontinued");
  expect(setAsides.calls[0].body).toMatchObject({ p_check_key: "amazon_specs", p_entity_key: asin });

  // A set-aside on one check does not touch another.
  expect(setAsides.rows.every((row) => row.check_key === "amazon_specs")).toBe(true);

  const history = page.locator("[data-spec-set-aside-history]");
  await history.locator("summary").click();
  await expect(history).toContainText("Set aside by Test Person");
  await history.locator(`[data-spec-reopen="${asin}"]`).click();
  await history.locator("[data-reopen-save]").click();

  await expect(table.locator(`[data-spec-set-aside="${asin}"]`)).toBeVisible();
  await expect(history.locator("summary")).toContainText("0 · 1 reopened");
  expect(setAsides.rows).toHaveLength(1);
});
