import { expect, test, type Page } from "@playwright/test";
import { LIVE_READ_TIMEOUT, openSpokeTab } from "./figure-first-page";

/**
 * FDD X-03 / X-04 audit at 1280×720. For each main tab, in reading order inside the panel body:
 * X-03 — a lead figure (a number drawn at 18px or larger) is in the first screen before any
 * paragraph of 140+ characters. X-04 — a primary visual (pie disc, chart, or bar) is in the
 * first screen before that paragraph.
 */

type Tab = { spoke: string; area: string; tab: string; slug: string };

const TABS: Tab[] = [
  ["hub", "Summary", ["Briefing", "Performance", "Opportunity"]],
  [
    "ecommerce",
    "Catalog Health",
    ["Retail Overview", "Suppressed Listings", "MAP", "Catalog Governance", "Out of Stock"],
  ],
  [
    "aeo",
    "AI Search Visibility",
    ["Run Summary", "Run Details", "Product Fact Checks", "Citation Ecosystem"],
  ],
  ["specs", "AI Readiness", ["Findability", "Amazon Specs", "Brand-Site Specs", "Amazon A+ Matrix"]],
  ["competitors", "Competitive Radar", ["Category Battlecards", "Competitor Wins", "Engine Comparison"]],
  ["suggestions", "Action Items", ["Urgent Interventions", "Revenue Estimates"]],
  ["roadmap", "Roadmap", ["30-60-90 Days"]],
].flatMap(([spoke, area, tabs]) =>
  (tabs as string[]).map((tab) => ({
    spoke: spoke as string,
    area: area as string,
    tab,
    slug: tab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  })),
);

/** Tabs that still fail this audit, with the files that own them. */
const KNOWN_GAPS: Record<string, { x03: boolean; x04: boolean; owner: string }> = {};

/**
 * Stated exemptions (Brian Magazu, 4 Nov 2026). Action Items tells the client what to fix and how
 * each estimate was set, and estimate views spend their space on how the estimates were reached
 * rather than on charts. Each tab must instead open on `lead`, in the first screen and ahead of any
 * long paragraph. `x04Only` tabs still need a lead figure (X-03); only the visual rule is waived.
 */
const EXEMPT: Record<string, { leads: string; lead: string; x04Only?: boolean }> = {
  "hub/opportunity": {
    leads: "the two analyst estimates, then how each was set",
    lead: "[data-estimate-method]",
    x04Only: true,
  },
  "suggestions/urgent-interventions": { leads: "the prioritized fix list", lead: "[data-fix-list] [data-fix-row]" },
  "suggestions/revenue-estimates": {
    leads: "the two analyst estimates, then how each was set",
    lead: "[data-estimate-method]",
  },
};

/** True when `selector` starts in the first screen and no long paragraph below the tabs comes before it. */
function leadsWith(selector: string): boolean {
  const panel = document.querySelector(".drilldown-panel");
  const lead = panel?.querySelector(selector);
  if (!panel || !lead) return false;
  const bodyTop = panel.querySelector(".drilldown-tab-btn.active")?.getBoundingClientRect().bottom ?? 0;
  const top = lead.getBoundingClientRect().top;
  if (top < bodyTop - 1 || top >= window.innerHeight) return false;
  return ![...panel.querySelectorAll("p, li, .ceo-callout-body, .action-details, .content-box-desc")].some((el) => {
    const elTop = el.getBoundingClientRect().top;
    return (
      (el as HTMLElement).innerText.trim().length >= 140 &&
      elTop >= bodyTop - 1 &&
      elTop < top &&
      !el.contains(lead)
    );
  });
}

type Reading = { x03: boolean; x04: boolean };

function measure(): Reading {
  const panel = document.querySelector(".drilldown-panel");
  const tabBar = panel?.querySelector(".drilldown-tab-btn.active")?.getBoundingClientRect();
  const bodyTop = tabBar ? tabBar.bottom : 0;
  const vh = window.innerHeight;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= bodyTop - 1 && r.top < vh;
  };
  const all = [...(panel?.querySelectorAll("*") ?? [])].filter(
    (el) => el.getBoundingClientRect().top >= bodyTop - 1,
  );
  const ownText = (el: Element) =>
    [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();

  const isFigure = (el: Element) =>
    /^[+\-$]?\$?[\d,.]+(\s*(%|K|M|of|est\.))?|\d[\d,]* of [\d,]+|\d+(\.\d+)?%/.test(ownText(el)) &&
    parseFloat(getComputedStyle(el).fontSize) >= 18 &&
    visible(el);
  const isVisual = (el: Element) => {
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (style.backgroundImage.includes("conic-gradient")) return true;
    if ((el.tagName === "svg" || el.tagName === "CANVAS") && r.width >= 40 && r.height >= 40) return true;
    const cls = el.getAttribute("class") ?? "";
    return (
      /bar|band|track|fill/i.test(cls) &&
      !/toolbar|filter|tab|scroll|nav|search|pill/i.test(cls) &&
      r.width >= 40 &&
      r.height >= 4 &&
      r.height <= 40
    );
  };
  const isLongCopy = (el: Element) =>
    ["P", "LI"].includes(el.tagName) ||
    el.matches(".ceo-callout-body, .action-details, .metric-card-sub, .content-box-desc")
      ? (el as HTMLElement).innerText.trim().length >= 140
      : false;

  const firstLong = all.findIndex(isLongCopy);
  const before = firstLong < 0 ? all : all.slice(0, firstLong);
  return { x03: before.some(isFigure), x04: before.some(isVisual) };
}

async function openTab(page: Page, baseURL: string | undefined, tab: Tab): Promise<string[]> {
  const errors = await openSpokeTab(page, baseURL, tab.spoke, tab.slug);
  await expect(page.locator(".drilldown-tab-btn.active")).toContainText(tab.tab);
  return errors;
}

test.describe("figure-first audit at 1280×720 (X-03, X-04)", () => {
  test.describe.configure({ timeout: 120_000 });
  for (const tab of TABS) {
    const key = `${tab.spoke}/${tab.slug}`;
    const gap = KNOWN_GAPS[key];
    const exempt = EXEMPT[key];
    test(`${tab.area} · ${tab.tab}`, async ({ page, baseURL }, info) => {
      const errors = await openTab(page, baseURL, tab);
      if (exempt) {
        info.annotations.push({
          type: "figure-first exemption",
          description: `${key} leads with ${exempt.leads}${exempt.x04Only ? " (X-04 only)" : ""}`,
        });
        await expect
          .poll(() => page.evaluate(leadsWith, exempt.lead), { timeout: LIVE_READ_TIMEOUT })
          .toBe(true);
        if (exempt.x04Only) {
          await expect.poll(async () => (await page.evaluate(measure)).x03, { timeout: LIVE_READ_TIMEOUT }).toBe(true);
        }
        await info.attach(`${key}.png`, { body: await page.screenshot(), contentType: "image/png" });
        expect(errors).toEqual([]);
        return;
      }
      if (gap) {
        info.annotations.push({ type: "figure-first gap", description: `${key}: ${gap.owner}` });
        // Wait until the tab reads at least as well as recorded, so a slow read is not logged as a gap.
        await expect
          .poll(
            async () => {
              const now = await page.evaluate(measure);
              return (now.x03 || !gap.x03) && (now.x04 || !gap.x04);
            },
            { timeout: LIVE_READ_TIMEOUT },
          )
          .toBe(true);
        await page.waitForTimeout(3_000);
        await info.attach(`${key}.png`, { body: await page.screenshot(), contentType: "image/png" });
        const reading = await page.evaluate(measure);
        info.annotations.push({
          type: "figure-first reading",
          description:
            reading.x03 && reading.x04
              ? `${key} now passes; remove it from KNOWN_GAPS`
              : `${key}: X-03 ${reading.x03 ? "pass" : "fail"}, X-04 ${reading.x04 ? "pass" : "fail"}`,
        });
        expect(errors).toEqual([]);
        return;
      }
      await expect
        .poll(() => page.evaluate(measure), { timeout: LIVE_READ_TIMEOUT })
        .toEqual({ x03: true, x04: true });
      await info.attach(`${key}.png`, { body: await page.screenshot(), contentType: "image/png" });
      expect(errors).toEqual([]);
    });
  }

  test("Roadmap keeps only its findings tab, with no blank tabs", async ({ page, baseURL }) => {
    await openSpokeTab(page, baseURL, "roadmap", "30-60-90-day-milestones");
    await expect(page.locator(".drilldown-tab-btn")).toHaveText(["30-60-90 Days"]);
  });
});
