import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

const CSV = ["sku,name", "A,One", "B,Two", "A,One again"].join("\n");

test("a guest can open the upload page, see a repeated key kept out, and approve nothing live", async ({ page }) => {
  await page.context().addCookies([
    { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.goto("/dashboard");
  const skipLogin = page.getByRole("button", { name: "Skip Login" });
  if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();

  await page.goto("/dashboard/upload");
  await expect(page).toHaveURL(/\/dashboard\/upload\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Upload a catalog or");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("MAP");
  await expect(
    page.getByText("Approved here means the file is accepted. It does not change the live catalog yet."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();

  const map = page.locator("h1 .ifai-term");
  await expect(map).toHaveAttribute("data-ifai-tooltip-title", "MAP");
  await expect(map).toHaveAttribute("data-ifai-tooltip-desc", /Minimum Advertised Price/);
  await expect(map).toHaveAttribute("tabindex", "0");
  await expect(map).not.toHaveAttribute("title", /.+/);
  await map.focus();
  await expect(page.getByRole("tooltip")).toContainText("Minimum Advertised Price");

  await page.getByLabel("Your name").fill("Guest checker");
  await page.getByLabel("CSV or TSV file").setInputFiles({
    name: "catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });

  await expect(page.locator("[data-upload-pending-count]")).toHaveAttribute("data-upload-pending-count", "2");
  await expect(page.locator("[data-upload-duplicate-count]")).toHaveAttribute("data-upload-duplicate-count", "1");
  await expect(page.locator("[data-upload-pending-set] li")).toHaveCount(2);
  await expect(page.locator("[data-upload-pending-set]")).not.toContainText("One again");
  const duplicate = page.locator("tr[data-disposition='duplicate']");
  await expect(duplicate).toContainText("Duplicate");
  await expect(duplicate).toContainText("One again");
  await expect(duplicate).toContainText("Repeats a key earlier in this file");

  await page.getByRole("button", { name: "Save pending rows" }).click();
  await expect(page.locator("[data-upload-saved]")).toContainText("Not available*");
  await expect(page.locator("tr[data-disposition='duplicate']")).toContainText("One again");
  await expect(page.locator("[data-upload-pending-set]")).not.toContainText("One again");

  await page.locator("[data-upload-approve]").click();
  await expect(page.locator("[data-upload-approval]")).toContainText("Not available*");
  await expect(
    page.getByText("Approved here means the file is accepted. It does not change the live catalog yet."),
  ).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("light theme and a narrow viewport still open the upload page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/upload?theme=light");
  await expect(page.locator("main.upload-page")).toHaveClass(/is-light/);
  await expect(
    page.getByText("Approved here means the file is accepted. It does not change the live catalog yet."),
  ).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
