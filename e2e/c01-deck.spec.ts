import { AI_READ_MS, expect, test } from "./fixtures";

/* Worker 26.5, C-01: the deck opens from Summary for the client on screen and the date pill's
   window, every slide fits its stage at 1280x720 and 1920x1080, and each figure names its tab. */

const SHOTS = process.env.DECK_SHOTS ?? "";

for (const client of ["fender", "ledlenser"]) {
  test.describe(`C-01 deck (${client})`, () => {
    const query = client === "fender" ? "" : `client=${client}&`;

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
      ]);
    });

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      test(`opens from Summary and every slide fits at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize(viewport);
        await page.goto(`/dashboard?${query}spoke=hub`);
        await page.locator("[data-deck-open]").click({ timeout: 60_000 });
        const deck = page.locator("[data-deck][data-deck-slide-count]");
        await expect(deck).toBeVisible({ timeout: AI_READ_MS });

        const count = Number(await deck.getAttribute("data-deck-slide-count"));
        const slides = page.locator("[data-deck-slide]");
        await expect(slides).toHaveCount(count);
        // The main flow keeps at least the opening and the fix list; backstage follows it.
        expect(count).toBeGreaterThanOrEqual(3);
        await expect(page.locator("[data-deck-position]")).toHaveText(`1 of ${count}`);

        // The stage fits the window: no page scroll in either direction.
        const scroll = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth - window.innerWidth,
          y: document.documentElement.scrollHeight - window.innerHeight,
        }));
        expect(scroll.x).toBeLessThanOrEqual(0);
        expect(scroll.y).toBeLessThanOrEqual(0);

        for (let index = 0; index < count; index += 1) {
          const active = page.locator(".deck-slide.is-active");
          await expect(active).toHaveCount(1);
          const id = await active.getAttribute("data-deck-slide");
          const fit = await active.evaluate((slide) => {
            const box = slide.getBoundingClientRect();
            const over: string[] = [];
            for (const node of slide.querySelectorAll<HTMLElement>("*")) {
              const r = node.getBoundingClientRect();
              if (r.width === 0 && r.height === 0) continue;
              if (r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1) {
                over.push(`${node.className || node.tagName}`);
              }
              if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== "visible") {
                over.push(`scroll:${node.className || node.tagName}`);
              }
            }
            const body = slide.querySelector<HTMLElement>(".deck-slide-body");
            if (body && body.scrollHeight > body.clientHeight + 1) over.push("body-overflow");
            return over;
          });
          expect(fit, `slide ${id} fits`).toEqual([]);
          // Every figure names its tab and carries its N of M.
          for (const figure of await active.locator(".deck-figure").all()) {
            await expect(figure).toHaveAttribute("data-src", /, /);
            await expect(figure.locator("[data-deck-figure-ratio]")).toHaveText(/\d/);
          }
          const text = (await active.textContent()) ?? "";
          expect(text).not.toContain("Not available*");
          expect(text).not.toMatch(/—/);
          if (/\best\./i.test(text)) expect(text).toContain("analyst estimate");
          if (SHOTS) await page.waitForTimeout(600);
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/${client}-${viewport.width}-${index + 1}-${id}.png` });
          await page.keyboard.press("ArrowRight");
        }
        await expect(page.locator("[data-deck-position]")).toHaveText(new RegExp(`${count} of ${count}$`));
        await page.keyboard.press("Home");
        await expect(page.locator("[data-deck-position]")).toHaveText(`1 of ${count}`);
        await page.keyboard.press("Escape");
        await expect(deck).toHaveCount(0);
      });
    }

    test("the deck cites the run and window the screen shows", async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(`/dashboard?${query}spoke=aeo`);
      const pill = page.locator("[data-ai-history-trigger]").first();
      const run = page.locator("[data-ai-history-run]").first();
      await expect(run).toHaveText(/^[0-9a-f]{8}/, { timeout: AI_READ_MS });
      const pillLabel = ((await pill.textContent()) ?? "").trim();
      const runId = ((await run.textContent()) ?? "").slice(0, 8);

      await page.goto(`/dashboard?${query}spoke=hub`);
      await page.locator("[data-deck-open]").click({ timeout: 60_000 });
      await expect(page.locator("[data-deck][data-deck-slide-count]")).toBeVisible({ timeout: AI_READ_MS });
      const line = (await page.locator(".deck-slide.is-active [data-deck-run]").textContent()) ?? "";
      expect(line).toContain(`Run ${runId}`);
      expect(line).toContain(pillLabel);
    });
  });
}
