import { expect, test, type Canvas } from "./fixtures";
import type { Page } from "@playwright/test";
import { INTERACTIVE_SELECTOR } from "../lib/canvas-sdk/iom-cursor-targets";

/* X-32: hovering the Balanced map felt laggy and the custom reticle glitched. H-08: the tour
   card covered the bubble it was describing. These run at 1280×720 (and 1440×900 where
   tagged) against the map as it loads. */

const MAIN_BUBBLES = ["hub", "spoke-aeo", "spoke-retail", "spoke-competitors", "spoke-roadmap", "spoke-specs", "spoke-fixes"];

async function center(canvas: Canvas, nodeId: string) {
  const box = (await canvas.bubble(nodeId).locator(":scope > .node-inner > .node-circle").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The reticle as painted: shown or not, where, and whether it reads as over something clickable. */
function reticle(page: Page) {
  return page.locator(".iom-cursor-portal").evaluate((el) => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return {
      shown: getComputedStyle(el).visibility !== "hidden",
      x: Math.round(matrix.m41),
      y: Math.round(matrix.m42),
      hover: el.getAttribute("data-hover") === "true",
    };
  });
}

/** Resolves after two frames, so a write scheduled for the next frame has landed. */
function frames(page: Page) {
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

test.describe("map hover", () => {
  test("pointing at a bubble opens its signal slots in the same frame", { tag: "@1440" }, async ({ canvas, page }) => {
    await page.mouse.move(640, 700);
    // In the frame the pointer enters a bubble, record which slots are already on screen.
    await page.evaluate(() => {
      const w = window as unknown as { __arrivals: { id: string; source: string | null }[] };
      w.__arrivals = [];
      let last: string | null = null;
      document.addEventListener(
        "pointerover",
        (event) => {
          const id = (event.target as Element).closest?.("[data-graph-node-id]")?.getAttribute("data-graph-node-id");
          if (!id || id === last || !/^(hub|spoke-)/.test(id)) return;
          last = id;
          requestAnimationFrame(() => {
            w.__arrivals.push({ id, source: document.querySelector("[data-hub-slot-source]")?.textContent ?? null });
          });
        },
        true,
      );
    });
    for (const id of MAIN_BUBBLES) {
      const at = await center(canvas, id);
      await page.mouse.move(at.x, at.y);
      await page.mouse.move(640, 700);
      await page.waitForTimeout(450); // past the hover rest, so the next bubble is where it was measured
    }
    const arrivals = await page.evaluate(() => (window as unknown as { __arrivals: { id: string; source: string | null }[] }).__arrivals);
    expect(arrivals.map((arrival) => arrival.id)).toEqual(MAIN_BUBBLES);
    for (const [index, arrival] of arrivals.entries()) {
      expect(arrival.source, `${arrival.id} had no slots in its first frame`).not.toBeNull();
      if (index > 0) expect(arrival.source, `${arrival.id} still showed the last bubble's slots`).not.toBe(arrivals[index - 1].source);
    }
  });

  test("a pointer sweep restyles only the glow, never the whole canvas", async ({ canvas, page }) => {
    const from = await center(canvas, "spoke-aeo");
    const to = await center(canvas, "spoke-competitors");
    await page.mouse.move(from.x, from.y);
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await frames(page);
    const vars = await page.evaluate(() => ({
      body: (document.querySelector(".canvas-body") as HTMLElement).style.getPropertyValue("--pointer-x"),
      wash: (document.querySelector(".canvas-pointer-wash") as HTMLElement).style.getPropertyValue("--pointer-x"),
    }));
    expect(vars.body, "the canvas body carries no per-move variable").toBe("");
    expect(parseFloat(vars.wash)).toBeCloseTo((to.x / 1280) * 100, 0);
  });
});

test.describe("custom cursor", () => {
  test("the reticle sits on the pointer in every frame", async ({ canvas, page }) => {
    await page.mouse.move(600, 300);
    await page.evaluate(() => {
      const w = window as unknown as { __trail: { frames: number; stale: number } };
      w.__trail = { frames: 0, stale: 0 };
      window.addEventListener("pointermove", (event) => {
        requestAnimationFrame(() => {
          const portal = document.querySelector(".iom-cursor-portal")!;
          const matrix = new DOMMatrix(getComputedStyle(portal).transform);
          w.__trail.frames += 1;
          if (Math.hypot(matrix.m41 - event.clientX, matrix.m42 - event.clientY) > 1) w.__trail.stale += 1;
        });
      });
    });
    let from = { x: 600, y: 300 };
    for (const id of MAIN_BUBBLES) {
      const to = await center(canvas, id);
      for (let step = 1; step <= 10; step += 1) {
        await page.mouse.move(from.x + ((to.x - from.x) * step) / 10, from.y + ((to.y - from.y) * step) / 10);
      }
      from = to;
    }
    await frames(page);
    const trail = await page.evaluate(() => (window as unknown as { __trail: { frames: number; stale: number } }).__trail);
    expect(trail.frames).toBeGreaterThan(40);
    expect(trail.stale, "frames where the reticle trailed the pointer").toBe(0);
  });

  test("leaving the window or losing focus hides the reticle until the pointer is back", async ({ page }) => {
    await page.mouse.move(640, 400);
    await frames(page);
    expect((await reticle(page)).shown).toBe(true);

    await page.mouse.move(4, 400);
    await page.mouse.move(-40, 400);
    await frames(page);
    expect((await reticle(page)).shown, "the reticle froze at the window edge").toBe(false);

    await page.mouse.move(200, 400);
    await frames(page);
    expect(await reticle(page)).toMatchObject({ shown: true, x: 200, y: 400 });

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await frames(page);
    expect((await reticle(page)).shown, "the reticle stayed up after the window lost focus").toBe(false);
    await page.mouse.move(220, 400);
    await frames(page);
    expect((await reticle(page)).shown).toBe(true);
  });

  test("hover follows what is under a still pointer after a click opens the panel", async ({ canvas, page }) => {
    await canvas.clickBubble("spoke-aeo");
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    const pointer = await reticle(page);
    // The bubble that was clicked has moved to the rail; something else is under the pointer now.
    const under = () =>
      page.evaluate(
        ([x, y, selector]) => {
          const hit = document.elementFromPoint(x, y)?.closest(selector);
          return Boolean(hit && !hit.matches(":disabled, [aria-disabled='true']"));
        },
        [pointer.x, pointer.y, INTERACTIVE_SELECTOR] as const,
      );
    await expect.poll(async () => (await reticle(page)).hover === (await under())).toBe(true);
    await page.waitForTimeout(1500);
    expect((await reticle(page)).hover).toBe(await under());
  });

  test("hover reads every clickable thing and skips disabled ones", async ({ page }) => {
    await page.evaluate(() => {
      const host = document.querySelector(".canvas-body")!;
      const probe = document.createElement("div");
      probe.id = "cursor-probe";
      probe.style.cssText = "position:absolute;left:300px;top:200px;z-index:65;display:grid;gap:12px;background:#000";
      probe.innerHTML = [
        '<span class="ifai-term" data-ifai-tooltip-title="MAP" data-ifai-tooltip-desc="Minimum advertised price" tabindex="0">MAP</span>',
        "<details><summary>Explanation</summary></details>",
        '<div data-ifai-open="aeo">Open AI Search</div>',
        '<button class="hdr-btn" disabled>Disabled</button>',
        "<p>Plain text</p>",
      ].join("");
      host.appendChild(probe);
    });
    const expected: [string, boolean][] = [
      [".ifai-term", true],
      ["summary", true],
      ["[data-ifai-open]", true],
      ["button[disabled]", false],
      ["p", false],
    ];
    for (const [selector, hover] of expected) {
      const box = (await page.locator(`#cursor-probe ${selector}`).boundingBox())!;
      await page.mouse.move(box.x + 4, box.y + box.height / 2);
      await frames(page);
      expect((await reticle(page)).hover, `hover over ${selector}`).toBe(hover);
    }
  });

  test("only one cursor shows, and the reticle stacks above every overlay", async ({ canvas, page }) => {
    const points = [await center(canvas, "hub"), await center(canvas, "spoke-retail"), { x: 1100, y: 20 }];
    await page.mouse.move(points[0].x, points[0].y);
    await expect(page.locator("[data-hub-slots]")).toBeVisible();
    const slot = (await page.locator(".hub-slot").first().boundingBox())!;
    points.push({ x: slot.x + 20, y: slot.y + 20 });
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await frames(page);
      const native = await page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)!).cursor, [point.x, point.y]);
      expect((await reticle(page)).shown).toBe(true);
      expect(native, `system cursor at ${point.x},${point.y}`).toBe("none");
    }

    const zIndex = await page.evaluate(() => {
      let top = 0;
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(".iom-cursor-portal")) continue;
        top = Math.max(top, Number(getComputedStyle(el).zIndex) || 0);
      }
      const tooltip = document.createElement("div");
      tooltip.className = "node-tooltip node-tooltip-definition visible";
      document.querySelector(".ifai-canvas")!.appendChild(tooltip);
      top = Math.max(top, Number(getComputedStyle(tooltip).zIndex));
      tooltip.remove();
      return { top, reticle: Number(getComputedStyle(document.querySelector(".iom-cursor-portal")!).zIndex) };
    });
    expect(zIndex.reticle).toBeGreaterThan(zIndex.top);
  });

  test("a native picker hides the reticle until the pointer moves in the page again", async ({ page }) => {
    await page.evaluate(() => {
      const select = document.createElement("select");
      select.id = "cursor-select";
      select.innerHTML = "<option>ChatGPT</option><option>Gemini</option>";
      select.style.cssText = "position:absolute;left:300px;top:200px;z-index:65";
      document.querySelector(".canvas-body")!.appendChild(select);
    });
    const box = (await page.locator("#cursor-select").boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await frames(page);
    expect((await reticle(page)).shown).toBe(true);
    await page.mouse.down();
    await frames(page);
    expect((await reticle(page)).shown, "the reticle stayed up beside the browser's own menu").toBe(false);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.mouse.move(box.x + 40, box.y + 60);
    await frames(page);
    expect((await reticle(page)).shown).toBe(true);
  });
});

/* X-32: a tab click made right after a spoke opened was sometimes ignored. The clicked
   bubble's cluster lifted the exiting map over the panel, and the panel grew from zero
   width, so its tabs wrapped into a stack that reflowed under the pointer. */
test.describe("panel tabs right after a spoke opens", () => {
  test("in every frame of the open, a tab on screen is what a click there hits", { tag: "@1440" }, async ({ canvas, page }) => {
    const watch = page.evaluate(
      () =>
        new Promise<{ blocked: string[]; tallestRow: number; settledRow: number }>((done) => {
          const blocked: string[] = [];
          let tallestRow = 0;
          let shownAt = 0;
          const tick = (now: number) => {
            const tabs = [...document.querySelectorAll<HTMLElement>(".drilldown-tab-btn")];
            if (tabs.length) {
              shownAt ||= now;
              tallestRow = Math.max(tallestRow, document.querySelector(".drilldown-tabs")!.getBoundingClientRect().height);
              for (const tab of tabs) {
                const box = tab.getBoundingClientRect();
                const x = box.left + box.width / 2;
                const y = box.top + box.height / 2;
                if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
                const hit = document.elementFromPoint(x, y);
                if (!hit || !tab.contains(hit)) {
                  const node = hit?.closest("[data-graph-node-id]")?.getAttribute("data-graph-node-id");
                  blocked.push(`${Math.round(now - shownAt)}ms ${tab.textContent}: ${node ? `bubble ${node}` : hit?.tagName}`);
                }
              }
            }
            if (!shownAt || now - shownAt < 1200) requestAnimationFrame(tick);
            else done({ blocked, tallestRow, settledRow: document.querySelector(".drilldown-tabs")!.getBoundingClientRect().height });
          };
          requestAnimationFrame(tick);
        }),
    );
    await canvas.clickBubble("spoke-retail");
    const seen = await watch;
    expect(seen.blocked, "something sat over a tab while the panel opened").toEqual([]);
    expect(seen.tallestRow, "the tab row reflowed while the panel opened").toBeLessThanOrEqual(seen.settledRow + 1);
  });

  test("the first tab click after opening from the map sticks", async ({ canvas, page }) => {
    await canvas.clickBubble("spoke-retail");
    const tab = page.locator(".drilldown-tab-btn").nth(2);
    const name = (await tab.textContent())!;
    await tab.click();
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText(name, { timeout: 1500 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText(name);
  });

  test("a tab clicked while a deep link's live reads arrive stays selected", async ({ page }) => {
    await page.goto("/dashboard?spoke=ecommerce&tab=map");
    const tab = page.locator(".drilldown-tab-btn", { hasText: "Retail Overview" });
    await tab.click();
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText("Retail Overview", { timeout: 1500 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText("Retail Overview");
    await expect(page).toHaveURL(/tab=retail-overview/);
  });
});

/** Watches one camera move: the worst gap between the lit area and the card while the card shows. */
function watchTourStep(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ title: string; worst: number; settled: number; heldAtEnd: boolean; side: string }>((done) => {
        const started = performance.now();
        let worst = Infinity;
        let settled = NaN;
        const tick = () => {
          const overlay = document.querySelector<HTMLElement>(".tour-overlay-container")!;
          const card = document.querySelector<HTMLElement>(".tour-modal-card")!;
          const host = document.querySelector(".ifai-canvas")!.getBoundingClientRect();
          const x = parseFloat(overlay.style.getPropertyValue("--tour-hole-x")) + host.left;
          const y = parseFloat(overlay.style.getPropertyValue("--tour-hole-y")) + host.top;
          const r = parseFloat(overlay.style.getPropertyValue("--tour-hole-r"));
          const box = card.getBoundingClientRect();
          if (r > 0 && card.dataset.held !== "true") {
            const nx = Math.max(box.left, Math.min(x, box.right));
            const ny = Math.max(box.top, Math.min(y, box.bottom));
            settled = Math.hypot(nx - x, ny - y) - r;
            worst = Math.min(worst, settled);
          }
          if (performance.now() - started < 1500) requestAnimationFrame(tick);
          else
            done({
              title: card.querySelector(".tour-spoke-title")?.textContent ?? "",
              worst,
              settled,
              heldAtEnd: card.dataset.held === "true",
              side: box.left > host.left + host.width / 2 ? "right" : "left",
            });
        };
        requestAnimationFrame(tick);
      }),
  );
}

async function walkTour(canvas: Canvas, page: Page) {
  test.setTimeout(120_000);
  await canvas.startTour();
  const total = await page.locator(".tour-dot").count();
  const seen = [];
  for (let step = 0; step < total; step += 1) {
    if (step > 0) await canvas.nextTourStep();
    seen.push(await watchTourStep(page));
  }
  for (let step = total - 2; step >= 0; step -= 1) {
    await page.locator(".tour-nav-btns .tour-btn").first().click();
    seen.push(await watchTourStep(page));
  }
  for (const move of seen) {
    expect(move.worst, `${move.title}: the card covered the lit area mid-move`).toBeGreaterThanOrEqual(-1);
    expect(move.settled, `${move.title}: the card covers the lit area once framed`).toBeGreaterThan(0);
    expect(move.heldAtEnd, `${move.title}: the card never came back`).toBe(false);
  }
  return seen;
}

/* H-08: the step card used to sit bottom-left on every step, so bubbles left of the hub
   slid in from under it while the camera moved. */
test.describe("tour card", () => {
  test("never covers the lit area in any frame, stepping forward and back", { tag: "@1440" }, async ({ canvas, page }) => {
    const seen = await walkTour(canvas, page);
    const leftOfHub = seen.find((move) => move.title === "AI Search Visibility")!;
    expect(leftOfHub.side, "a bubble left of the hub puts the card on the right").toBe("right");
  });
});

test.describe("tour card at 1920×1080", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("never covers the lit area in any frame, stepping forward and back", async ({ canvas, page }) => {
    await walkTour(canvas, page);
  });
});
