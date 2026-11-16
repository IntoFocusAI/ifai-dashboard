import { expect, test, type Page } from "@playwright/test";

/* X-31 (decision 50): nothing on the client dashboard renders smaller than 11px. Every spoke and
   every tab, the header, the map, and Minimal, for both clients at 1280x720. A text's size is its
   computed font-size times every CSS transform above it. SVG text, map and rail bubbles included,
   is checked as rendered: its font size times the scale of its screen matrix (the map draws at
   about 0.72 at this size, the 240px rail at 0.76 to 0.98). The map is also read with each main
   bubble hovered, so its satellites are checked while they show. */

const FLOOR = 11;
const CLIENTS = ["fender", "ledlenser"] as const;
const SPOKES = ["hub", "ecommerce", "aeo", "specs", "competitors", "suggestions", "roadmap"] as const;

test.use({ viewport: { width: 1280, height: 720 } });

type Small = { size: number; text: string; where: string };

/** Runs in the page: every visible text smaller than `floor`. */
function smallText(floor: number): Small[] {
  const out: Small[] = [];
  const seen = new Set<Element>();
  const hidden = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return true;
    }
    return false;
  };
  const cssScale = (el: Element) => {
    let scale = 1;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const transform = getComputedStyle(e).transform;
      if (transform && transform !== "none") {
        const m = new DOMMatrixReadOnly(transform);
        scale *= Math.hypot(m.a, m.b);
      }
    }
    return scale;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = (node.textContent ?? "").trim();
    const el = node.parentElement;
    if (!text || !el || seen.has(el) || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(el.tagName)) continue;
    seen.add(el);
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    if (box.width < 1 || box.height < 1 || hidden(el)) continue;
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    let size = fontSize;
    if (el instanceof SVGElement) {
      const graphic = (el.closest("text") ?? el) as SVGGraphicsElement;
      const ctm = graphic.getScreenCTM?.();
      if (ctm) size = fontSize * Math.hypot(ctm.a, ctm.b);
    } else {
      size = fontSize * cssScale(el);
    }
    if (size < floor - 0.02) {
      const cls = typeof el.className === "string" ? el.className : (el.className as SVGAnimatedString).baseVal;
      out.push({ size: Math.round(size * 100) / 100, text: text.slice(0, 40), where: `${el.tagName.toLowerCase()}.${cls}` });
    }
  }
  return out;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  // Let hover and panel transitions finish so a mid-animation scale is not read as a size.
  await page.waitForTimeout(500);
}

async function expectFloor(page: Page, where: string) {
  const small = await page.evaluate(smallText, FLOOR);
  expect.soft(small, `${where}: text under ${FLOOR}px`).toEqual([]);
}

const MAIN_WITH_SATELLITES = ["spoke-aeo", "spoke-retail", "spoke-specs", "spoke-competitors"] as const;

/** Hover a main bubble the way a reader does, then wait for its satellites and the map's slide. */
async function hoverBubble(page: Page, id: string) {
  const circle = page.locator(`[data-graph-node-id="${id}"] > .node-inner > .node-circle`);
  await expect(async () => {
    const box = (await circle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 6, { steps: 12 });
    await expect(page.locator(".satellite-group.visible [data-graph-node-id]").first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await settle(page);
}

for (const client of CLIENTS) {
  const query = client === "fender" ? "" : `client=${client}`;

  test.describe(`Type floor at 1280x720 (${client})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
      ]);
    });

    test("header, map, and Minimal", async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(`/dashboard${query ? `?${query}` : ""}`);
      const skipLogin = page.getByRole("button", { name: "Skip Login" });
      if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
      await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: 60_000 });
      // Read the map once the AI and retail reads have drawn their figures, so the faces are final.
      for (const id of ["spoke-aeo", "spoke-competitors", "spoke-retail"]) {
        await expect(page.locator(`[data-graph-node-id="${id}"] .node-hero-value`)).toHaveText(/\d|Not available/, { timeout: 90_000 });
      }
      await settle(page);
      await expectFloor(page, `${client} map`);
      // Bubbles carry no status words; the hero figure's color carries the status.
      expect(await page.locator(".canvas-svg .node-hero-status-word").count(), "status words on bubbles").toBe(0);
      for (const id of MAIN_WITH_SATELLITES) {
        await hoverBubble(page, id);
        await expectFloor(page, `${client} map, ${id} hovered`);
      }
      await page.mouse.move(1270, 600, { steps: 4 });

      await page.locator("[data-view-mode='minimal']").click();
      await settle(page);
      await expectFloor(page, `${client} Minimal`);
      await page.getByRole("button", { name: "Add metric to large slot 1" }).click();
      await settle(page);
      await expectFloor(page, `${client} Minimal picker`);
    });

    for (const spoke of SPOKES) {
      test(`${spoke}: every tab`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.goto(`/dashboard?${query ? `${query}&` : ""}spoke=${spoke}`);
        const skipLogin = page.getByRole("button", { name: "Skip Login" });
        if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
        await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
        await settle(page);
        const tabs = page.locator(".drilldown-tab-btn");
        const count = await tabs.count();
        if (count === 0) {
          await expectFloor(page, `${client} ${spoke}`);
          return;
        }
        for (let i = 0; i < count; i++) {
          const tab = tabs.nth(i);
          const label = (await tab.innerText()).trim().replace(/\s+/g, " ");
          await tab.click();
          await expect(tab).toHaveClass(/\bactive\b/);
          await settle(page);
          await expectFloor(page, `${client} ${spoke} › ${label}`);
        }
      });
    }
  });
}
