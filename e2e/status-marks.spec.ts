import { expect, test, type Page } from "@playwright/test";

/* X-34: every status-colored figure carries its mark and word (StatusMark). Every spoke and
   every tab, the minimal view, and the deck, for both clients. A visible element painted
   Oxblood, Champagne, or Pine (text, fill, stroke, a left rule, or a bar) must sit with an
   x, dash, or check mark: inside the same StatusMark, within its figure's box (three
   parents up), or in the same table row or list item (its Status column or status line).
   Tabs are read from the panel, so a new tab is covered without editing this file. The map is out of scope here: its bubbles carry the glyph without the word
   (decisions 59 and 91) and map-reading-status covers them. */

const CLIENTS = ["fender", "ledlenser"] as const;
const SPOKES = ["hub", "ecommerce", "aeo", "specs", "competitors", "suggestions", "roadmap"] as const;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

/** Visible elements in `scope` painted a status color with no mark beside them. */
async function unmarked(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((scopeSelector) => {
    const roots = Array.from(document.querySelectorAll(scopeSelector));
    if (roots.length === 0) return [];
    // Resolve the theme's three status colors as computed rgb strings.
    const probe = document.createElement("span");
    roots[0].appendChild(probe);
    const colors = new Set<string>();
    for (const name of ["--status-bad", "--status-okay", "--status-good", "--deck-bad", "--deck-okay", "--deck-good"]) {
      probe.style.color = "";
      probe.style.color = `var(${name}, rgb(1, 2, 3))`;
      const c = getComputedStyle(probe).color;
      if (c !== "rgb(1, 2, 3)") colors.add(c);
    }
    probe.remove();

    const MARK = "[data-status-mark], .data-status-glyph";
    const hasMark = (el: Element) => {
      let node: Element | null = el;
      for (let up = 0; node && up <= 3; up++, node = node.parentElement) {
        if (node.matches(MARK) || node.querySelector(MARK)) return true;
        if (node.closest(".data-status")) return true;
      }
      // A table cell's or list item's color may lean on its row's Status column or the item's
      // status line, which carries the mark and word (Action Items, Roadmap).
      const row = el.closest("tr, li");
      return Boolean(row && row.querySelector(MARK));
    };
    const describe = (el: Element) => {
      const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
      return `${el.tagName.toLowerCase()}${cls ? "." + cls.trim().split(/\s+/).join(".") : ""} "${text}"`;
    };

    const out: string[] = [];
    for (const root of roots) {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
        const painted: string[] = [];
        const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
        if (ownText && colors.has(s.color)) painted.push("text");
        if (el instanceof SVGElement) {
          if (colors.has(s.fill)) painted.push("fill");
          if (colors.has(s.stroke) && s.stroke !== "none") painted.push("stroke");
        }
        if (parseFloat(s.borderLeftWidth) >= 2 && colors.has(s.borderLeftColor)) painted.push("rule");
        if (colors.has(s.backgroundColor)) painted.push("fill");
        if (painted.length === 0) continue;
        if (hasMark(el)) continue;
        out.push(`${painted.join("+")}: ${describe(el)}`);
      }
    }
    return Array.from(new Set(out));
  }, scope);
}

for (const client of CLIENTS) {
  test.describe(`Status marks on every tab (${client})`, () => {
    const query = client === "fender" ? "" : `client=${client}&`;

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
      ]);
    });

    for (const spoke of SPOKES) {
      test(`${spoke}: every status color has its mark`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.goto(`/dashboard?${query}spoke=${spoke}`);
        const skipLogin = page.getByRole("button", { name: "Skip Login" });
        if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
        await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: 60_000 });
        await settle(page);

        const tabs = page.locator(".drilldown-tab-btn");
        const count = await tabs.count();
        const found: string[] = [];
        if (count === 0) found.push(...(await unmarked(page, ".drilldown-panel")));
        for (let i = 0; i < count; i++) {
          const tab = tabs.nth(i);
          const label = (await tab.innerText()).trim().replace(/\s+/g, " ");
          await tab.click();
          await expect(tab).toHaveClass(/\bactive\b/);
          await settle(page);
          for (const hit of await unmarked(page, ".drilldown-panel")) found.push(`${label} › ${hit}`);
        }
        expect(found, `${client} ${spoke}: status color without a mark`).toEqual([]);
      });
    }

    test("minimal view: every status color has its mark", async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(`/dashboard?${query}`);
      await page.locator("[data-view-mode='minimal']").click({ timeout: 60_000 });
      await expect(page.locator("[data-minimal-view]")).toBeVisible();
      await settle(page);
      expect(await unmarked(page, "[data-minimal-view]")).toEqual([]);
      await page.locator("[data-view-mode='minimal']").click().catch(() => {});
    });

    test("deck: every status color has its mark", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(`/dashboard?${query}spoke=hub`);
      await page.locator("[data-deck-open]").click({ timeout: 60_000 });
      const deck = page.locator("[data-deck][data-deck-slide-count]");
      await expect(deck).toBeVisible({ timeout: 90_000 });
      await settle(page);
      const count = Number(await deck.getAttribute("data-deck-slide-count"));
      const found: string[] = [];
      for (let i = 0; i < count; i++) {
        for (const hit of await unmarked(page, "[data-deck]")) found.push(`slide ${i + 1} › ${hit}`);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(250);
      }
      expect(Array.from(new Set(found))).toEqual([]);
    });
  });
}
