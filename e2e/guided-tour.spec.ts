import { expect, test } from "./fixtures";

/* Regression cover for the tour losing its place. Reported on the 2026-09-17
   walkthrough: "that brought me out of the Guided Tour, but I was not done...
   it looks like I need to start over." */
test.describe("guided tour", () => {
  test("opening a deep dive suspends the tour instead of ending it", { tag: "@1440" }, async ({
    canvas,
    page,
  }) => {
    await canvas.startTour();
    await canvas.nextTourStep();
    await canvas.nextTourStep();
    const step = await canvas.tourStep.innerText();
    expect(step).toContain("STEP 3");

    await page.locator(".tour-drilldown-link-btn").click();

    await expect(page.locator(".tour-overlay-container.active")).toHaveCount(0);
    await expect(canvas.resumeChip).toBeVisible();
    await expect(canvas.resumeChip).toContainText("3/7");

    await canvas.resumeChip.click();
    await expect(canvas.tourCard).toBeVisible();
    await expect(canvas.tourStep).toHaveText(step);
  });

  test("closing the panel resumes the tour", async ({ canvas, page }) => {
    await canvas.startTour();
    await canvas.nextTourStep();
    const step = await canvas.tourStep.innerText();

    await page.locator(".tour-drilldown-link-btn").click();
    await expect(canvas.resumeChip).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(canvas.tourCard).toBeVisible();
    await expect(canvas.tourStep).toHaveText(step);
  });

  test("abandoning the tour leaves a resume offer in the header", async ({
    canvas,
    page,
  }) => {
    await canvas.startTour();
    await canvas.nextTourStep();
    await canvas.nextTourStep();
    const step = await canvas.tourStep.innerText();

    await page.keyboard.press("Escape");
    await expect(canvas.tourCard).toBeHidden();
    await expect(canvas.tourButton).toContainText(/resume tour · 3\/\d+/i);

    await canvas.tourButton.click();
    await expect(canvas.tourStep).toHaveText(step);
  });

  test("returning to the map overview brings back the guided tour launcher", async ({
    canvas,
    page,
  }) => {
    await expect(page.locator(".tour-launcher.map-chrome-onscreen")).toBeVisible();
    await canvas.openSpokeFromMap("AI Search Visibility");
    await expect(page.locator(".tour-launcher.map-chrome-onscreen")).toHaveCount(0);

    await page.locator(".drilldown-hide-btn").click();
    await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);
    await expect(page.locator(".tour-launcher.map-chrome-onscreen")).toBeVisible();
  });

  test("finishing the tour clears the resume offer", async ({ canvas }) => {
    await canvas.startTour();
    const total = await canvas.page.locator(".tour-dot").count();
    for (let i = 0; i < total; i += 1) await canvas.nextTourStep();

    await expect(canvas.tourCard).toBeHidden();
    await expect(canvas.tourButton).toContainText(/guided tour/i);
    await expect(canvas.tourButton).not.toContainText(/resume/i);
  });

  test("the deep-dive button warns that the tour pauses", async ({ canvas, page }) => {
    await canvas.startTour();
    await expect(page.locator(".tour-drilldown-hint")).toContainText("come back");
  });

  test("every step is short bullets that fit the card without scrolling", async ({ canvas, page }) => {
    test.setTimeout(90_000);
    await canvas.startTour();
    await expect(canvas.tourCard.locator(".tour-card-list")).not.toContainText(/loading/i, { timeout: 30_000 });
    const total = await page.locator(".tour-dot").count();

    for (let step = 0; step < total; step += 1) {
      const read = await canvas.tourCard.evaluate((card) => {
        const lines = (el: Element) => {
          const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
          return Math.round(el.getBoundingClientRect().height / lineHeight);
        };
        const body = card.querySelector(".tour-modal-body")!;
        return {
          title: card.querySelector(".tour-spoke-title")?.textContent,
          items: [...card.querySelectorAll(".tour-card-list li, .tour-value-text")].map((el) => ({
            text: el.textContent ?? "",
            lines: lines(el),
          })),
          overflow: body.scrollHeight - body.clientHeight,
        };
      });
      for (const item of read.items) {
        // The required failed-read line names its source table, so it may take two.
        const allowed = /did not load/.test(item.text) ? 2 : 1;
        expect(item.lines, `${read.title}: "${item.text}"`).toBeLessThanOrEqual(allowed);
      }
      expect(read.overflow, `${read.title} scrolls`).toBeLessThanOrEqual(0);
      if (step < total - 1) await canvas.nextTourStep();
    }
  });
});

/* The dimmer used to be a flat sheet over everything, so the bubble each step
   was describing got dimmed along with the rest of the map. */
test.describe("tour spotlight", () => {
  /** Reads the hole the shell writes onto the overlay each frame. */
  async function spotlight(page: import("@playwright/test").Page) {
    return page.locator(".tour-overlay-container").evaluate((el) => {
      const style = (el as HTMLElement).style;
      return {
        x: parseFloat(style.getPropertyValue("--tour-hole-x")),
        y: parseFloat(style.getPropertyValue("--tour-hole-y")),
        r: parseFloat(style.getPropertyValue("--tour-hole-r")),
      };
    });
  }

  test("lights the node the current step is about", async ({ canvas, page }) => {
    await canvas.startTour();
    await expect
      .poll(async () => (await spotlight(page)).r)
      .toBeGreaterThan(0);
    await expect(page.locator("svg.camera-animating")).toHaveCount(0);

    const ring = page.locator("#tour-spotlight-ring");
    const box = (await ring.boundingBox())!;
    const hole = await spotlight(page);

    // The hole is centred on the spotlighted node, not on the viewport.
    expect(Math.abs(hole.x - (box.x + box.width / 2))).toBeLessThan(8);
    expect(Math.abs(hole.y - (box.y + box.height / 2))).toBeLessThan(8);
    expect(hole.r).toBeGreaterThan(box.width / 2);

    // ...and the dimmer actually consumes it, rather than staying a flat sheet.
    const dim = await page
      .locator(".tour-dimmer-backdrop")
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(dim).toContain("radial-gradient");
    // Computed style serialises `transparent` as a zero-alpha rgba.
    expect(dim).toContain("rgba(0, 0, 0, 0)");
    expect(dim).toContain(`${Math.round(hole.r)}px`);
  });

  test("the lit area never sits under the tour card", async ({ canvas, page }) => {
    await canvas.startTour();
    const total = await page.locator(".tour-dot").count();

    for (let step = 0; step < total; step += 1) {
      await expect.poll(async () => (await spotlight(page)).r).toBeGreaterThan(0);
      await expect(page.locator("svg.camera-animating")).toHaveCount(0);
      const hole = await spotlight(page);
      const card = (await page.locator(".tour-modal-card").boundingBox())!;
      // The card takes whichever side keeps it off the lit circle.
      const nearestX = Math.max(card.x, Math.min(hole.x, card.x + card.width));
      const nearestY = Math.max(card.y, Math.min(hole.y, card.y + card.height));
      expect(
        Math.hypot(nearestX - hole.x, nearestY - hole.y) - hole.r,
        `step ${step + 1} overlaps the tour card`,
      ).toBeGreaterThan(0);
      if (step < total - 1) await canvas.nextTourStep();
    }
  });

  test.skip(
    "the panel gets out of the way for the duration",
    {
      annotation: {
        type: "question",
        description: "Should Priorities be open when the dashboard loads? The map now starts with the panel hidden.",
      },
    },
    async ({ canvas, page }) => {
      await expect(page.locator(".ifai-canvas.panel-open")).toHaveCount(1);

      await canvas.startTour();
      await expect(page.locator(".ifai-canvas.tour-running")).toHaveCount(1);
      await expect(page.locator(".ifai-canvas.panel-open")).toHaveCount(0);

      await page.keyboard.press("Escape");
      await expect(page.locator(".ifai-canvas.tour-running")).toHaveCount(0);
      await expect(page.locator(".ifai-canvas.panel-open")).toHaveCount(1);
    },
  );

  test("the hole is cleared when the tour ends", async ({ canvas, page }) => {
    await canvas.startTour();
    await expect.poll(async () => (await spotlight(page)).r).toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await expect.poll(async () => (await spotlight(page)).r).toBeNaN();
  });
});
