import { expect, test } from "@playwright/test";

test("opens a spoke from a shared dashboard URL", async ({ page }) => {
  await page.goto("/dashboard?spoke=roadmap");
  const skipLogin = page.getByRole("button", { name: "Skip Login" });
  if (await skipLogin.isVisible().catch(() => false)) {
    await skipLogin.click();
  }
  await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
  await expect(page).toHaveURL(/spoke=roadmap/);
  await expect(page.locator('[data-graph-node-id="spoke-roadmap"]')).toHaveClass(/\bnode-selected\b/);
  await expect(page.locator(".drilldown-tab-btn.active")).toContainText("30-60-90 Days");
});
