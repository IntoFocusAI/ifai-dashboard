import { expect, test } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

const BUBBLES = [
  "spoke-retail",
  "spoke-aeo",
  "spoke-specs",
  "spoke-competitors",
];

test("every bubble slot opens its evidence tab", async ({ page }) => {
  test.setTimeout(120_000);
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  await canvas.open();

  for (const id of BUBBLES) {
    for (let index = 0; index < 3; index += 1) {
      await page.locator(`[data-graph-node-id='${id}']`).focus();
      const slot = page.locator("[data-hub-slot]").nth(index);
      const tab = await slot.getAttribute("data-hub-slot-tab");
      expect(tab).toBeTruthy();
      await slot.click();
      await expect(canvas.activeTab).toContainText(tab!);
      await page.getByRole("button", { name: "Show full map" }).click();
      await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);
    }
  }
});
