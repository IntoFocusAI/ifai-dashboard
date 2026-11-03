import { expect, test } from "./fixtures";

/* Layout cover for the 2026-09-17 note: "if we make this where it's most of the
   screen, we can do a lot more" — and for the header, which was clipping its own
   controls off the right edge at every viewport width. */
test.describe("panel layout", () => {
  test("starts with the full map and a hidden sidebar", async ({ page }) => {
    await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(0);
    await expect(page.locator(".drilldown-panel-toggle")).toBeVisible();
  });

  test("opens a full-width drill-down after a bubble is selected", { tag: "@1440" }, async ({
    canvas,
    page,
  }) => {
    await canvas.openSpokeFromMap("Strategy Roadmap");
    const width = await canvas.panel.evaluate((el) => el.getBoundingClientRect().width);
    const viewport = page.viewportSize()!.width;
    expect(width / viewport).toBeGreaterThan(0.6);
  });

  test("hides the sidebar and restores it from the edge tab", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("Strategy Roadmap");
    await page.locator(".drilldown-hide-btn").click();
    await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(0);
    await expect(page.locator(".drilldown-panel-toggle")).toBeVisible();
    await expect
      .poll(() => canvas.panel.evaluate((el) => Math.round(el.getBoundingClientRect().width)))
      .toBe(0);

    await page.locator(".drilldown-panel-toggle").click();
    await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(0);
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(page.locator(".ifai-canvas.panel-expanded")).toHaveCount(1);
  });

  test("keeps the IOM drill-down in column + full-width panel mode", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(page.locator(".drilldown-expand-btn")).toHaveCount(0);
  });

  test("always leaves a usable graph rail", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("Strategy Roadmap");
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const panel = await canvas.panel.evaluate((el) => el.getBoundingClientRect().width);
      const rail = width - panel;
      expect(rail, `graph rail at ${width}px`).toBeGreaterThanOrEqual(220);
      expect(rail, `graph rail at ${width}px`).toBeLessThanOrEqual(250);
    }
  });

  test("header controls stay on screen at every width", async ({ page }) => {
    for (const width of [1280, 1440, 1680, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page
        .locator(".top-header")
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `header overflow at ${width}px`).toBeLessThanOrEqual(0);

      for (const label of ["Priorities", "Guided Tour"]) {
        const box = await page.locator(".hdr-btn", { hasText: label }).boundingBox();
        expect(box, `${label} at ${width}px`).not.toBeNull();
        expect(box!.x + box!.width, `${label} clipped at ${width}px`).toBeLessThanOrEqual(width);
        expect(box!.x).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("the tab strip wraps rather than side-scrolling", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    const overflow = await page
      .locator(".drilldown-tabs")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("panel content never scrolls sideways", { tag: "@1440" }, async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");
    const tabs = await page.locator(".drilldown-tab-btn").count();
    for (let i = 0; i < tabs; i += 1) {
      await page.locator(".drilldown-tab-btn").nth(i).click();
      const overflow = await page
        .locator(".drilldown-body")
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `tab ${i}`).toBeLessThanOrEqual(1);
    }
  });
});

/* The iom theme flipped its surfaces to white in light mode but left the status
   text on dark-theme values, washing out every badge and callout. */
test.describe("light theme contrast", () => {
  test("status text stays readable on light surfaces", async ({ canvas, page }) => {
    await page.locator(".header-controls .hdr-btn").last().click();
    await expect(page.locator(".ifai-canvas.light-theme")).toHaveCount(1);

    const samples = await canvas.commandCenter.evaluate(() => {
      const read = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = getComputedStyle(el);
        return { selector, color: style.color, background: style.backgroundColor };
      };
      return [".cc-impact", ".cc-sev-badge-critical", ".cc-why p", ".cc-item-title"]
        .map(read)
        .filter(Boolean) as { selector: string; color: string; background: string }[];
    });

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(contrast(sample.color, sample.background), sample.selector).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

/** WCAG relative-contrast ratio, compositing any alpha over the white panel. */
function contrast(foreground: string, background: string) {
  const page = [255, 255, 255] as const;
  const fg = parse(foreground, page);
  const bg = parse(background, page);
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function parse(color: string, over: readonly [number, number, number]) {
  const parts = (color.match(/[\d.]+/g) ?? []).map(Number);
  if (parts.length < 3) return [...over] as number[];
  const alpha = parts.length > 3 ? parts[3] : 1;
  return parts.slice(0, 3).map((channel, i) => channel * alpha + over[i] * (1 - alpha));
}

function luminance([r, g, b]: number[]) {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}
