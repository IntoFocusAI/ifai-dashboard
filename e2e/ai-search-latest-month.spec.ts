import type { Page, Route } from "@playwright/test";
import { STORED_RUN_COPY_DATA } from "../lib/ai-search/stored-run-copy-data";
import { expect, test as base } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

/* AI Search opens on the latest month (FDD X-09). The AI views are served from the stored-run
   copy plus synthetic runs, so the month's contents are fixed: published runs with answered
   calls count, and unpublished, failed, fragment, and all-error runs do not. The map stays on
   the published run. */

type Entry = (typeof STORED_RUN_COPY_DATA.runs)[number];
type Row = Record<string, unknown>;
type Run = { run: Row; calls: Row[]; probes: Row[]; citations: Row[] };

const [OCTOBER_11, EARLIER_OCTOBER_12, PUBLISHED_OCTOBER_12] = STORED_RUN_COPY_DATA.runs;

function copyOf(entry: Entry, id: string, run: Row = {}, call: (row: Row) => Row = (row) => row): Run {
  const ids = new Map<string, string>();
  const calls = entry.calls.map((row) => {
    const next = { ...call({ ...row }), id: `${id.slice(0, 8)}-${row.id}`, audit_run_id: id };
    ids.set(String(row.id), String(next.id));
    return next;
  });
  return {
    run: { ...entry.run, ...run, audit_run_id: id },
    calls,
    probes: entry.probes.map((row) => ({ ...row, audit_run_id: id })),
    citations: entry.citations.map((row) => ({
      ...row,
      audit_run_id: id,
      simulation_id: ids.get(String(row.simulation_id)) ?? row.simulation_id,
    })),
  };
}

const original = (entry: Entry): Run => ({
  run: { ...entry.run },
  calls: entry.calls,
  probes: entry.probes,
  citations: entry.citations,
});

/** Published on 20 Oct with the earlier 12 Oct run's answers: 13 of 20 unbranded, 18 of 18 branded. */
const OCTOBER_20 = copyOf(EARLIER_OCTOBER_12, "20202020-0000-4000-8000-000000000020", {
  is_published: true,
  published_at: "2026-10-20T07:00:00.000Z",
  started_at: "2026-10-20T06:00:00.000Z",
  completed_at: "2026-10-20T06:55:00.000Z",
});

/** Published on 18 Oct, every call a provider error. The catalog row does not record answered calls. */
const OCTOBER_18_ERRORS = copyOf(
  PUBLISHED_OCTOBER_12,
  "18181818-0000-4000-8000-000000000018",
  { published_at: "2026-10-18T07:00:00.000Z", completed_at: "2026-10-18T06:55:00.000Z", answered_calls: null, error_calls: null },
  (row) => ({ ...row, call_status: "error", outcome: "error", primary_brand: null }),
);

const SEPTEMBER_30 = copyOf(PUBLISHED_OCTOBER_12, "30303030-0000-4000-8000-000000000930", {
  published_at: "2026-09-30T07:00:00.000Z",
  completed_at: "2026-09-30T06:55:00.000Z",
});

/** The published run on 3 Nov. Its catalog row is a fragment, so November holds no client run. */
const NOVEMBER_3 = copyOf(EARLIER_OCTOBER_12, "03030303-0000-4000-8000-000000001103", {
  is_published: true,
  published_at: "2026-11-03T07:00:00.000Z",
  started_at: "2026-11-03T06:00:00.000Z",
  completed_at: "2026-11-03T06:55:00.000Z",
});

const OCTOBER_CATALOG = [original(OCTOBER_11), original(EARLIER_OCTOBER_12), original(PUBLISHED_OCTOBER_12), OCTOBER_18_ERRORS, OCTOBER_20, SEPTEMBER_30];

/** `canvas_ai_run_history` has no missing_calls column. */
function catalogRow(entry: Run): Row {
  const row = { ...entry.run };
  delete row.missing_calls;
  return row;
}

async function fulfill(route: Route, rows: Row[]) {
  const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? 0);
  const page = offset > 0 ? [] : rows;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "content-range": page.length === 0 ? "*/0" : `0-${page.length - 1}/${page.length}`,
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "content-range",
    },
    body: JSON.stringify(page),
  });
}

/** Serves every AI Search view. `catalog` rows may override a run's catalog columns. */
async function mockAiViews(page: Page, current: Run, runs: Run[], catalogPatch: Record<string, Row> = {}) {
  const byId = new Map(runs.map((entry) => [String(entry.run.audit_run_id), entry]));
  byId.set(String(current.run.audit_run_id), current);
  await page.route(/\/rest\/v1\/canvas_ai_/, async (route) => {
    const url = new URL(route.request().url());
    const view = url.pathname.split("/").pop() ?? "";
    const runId = url.searchParams.get("audit_run_id")?.replace(/^eq\./, "") ?? null;
    const entry = runId ? byId.get(runId) : undefined;
    if (view === "canvas_ai_current_run") return fulfill(route, [current.run]);
    if (view === "canvas_ai_simulations") return fulfill(route, current.calls);
    if (view === "canvas_ai_probes") return fulfill(route, current.probes);
    if (view === "canvas_ai_citations") return fulfill(route, current.citations);
    if (view === "canvas_ai_run_history") {
      return fulfill(route, [...byId.values()].map((item) => ({ ...catalogRow(item), ...catalogPatch[String(item.run.audit_run_id)] })));
    }
    if (!entry) return fulfill(route, []);
    if (view === "canvas_ai_history_runs") return fulfill(route, [{ ...entry.run, ...catalogPatch[runId ?? ""] }]);
    if (view === "canvas_ai_history_calls") return fulfill(route, entry.calls);
    if (view === "canvas_ai_history_probes") return fulfill(route, entry.probes);
    if (view === "canvas_ai_history_citations_by_run") return fulfill(route, entry.citations);
    return fulfill(route, []);
  });
}

type Scenario = { current: Run; runs: Run[]; catalogPatch?: Record<string, Row> };

/**
 * Routes are installed before the shared fixture opens the dashboard. Every other canvas read
 * gets the shared small fixture; the AI views, routed last, take precedence over it.
 */
const test = base.extend<{ aiScenario: Scenario }>({
  aiScenario: [{ current: OCTOBER_20, runs: OCTOBER_CATALOG }, { option: true }],
  page: async ({ page, aiScenario }, provide) => {
    await mockCanvasRead(page);
    await mockAiViews(page, aiScenario.current, aiScenario.runs, aiScenario.catalogPatch);
    await provide(page);
  },
});

const aiBubble = (page: Page) => page.locator(".graph-node").filter({ hasText: /AI\s*Search\s*Visibility/i });

/** The bubble's figure, without the line breaks the map and column layouts wrap differently. */
const mapFigure = async (page: Page) => (await aiBubble(page).textContent())?.replace(/\s+/g, "");

test.use({ viewport: { width: 1280, height: 720 } });

test.describe("AI Search opens on the latest month", () => {
  test("the month adds published runs with answers only, and the latest run is one click away", async ({ canvas, page }) => {
    await expect(aiBubble(page)).toContainText("65.0%");
    const mapBefore = await mapFigure(page);

    await canvas.openSpokeFromMap("AI Search Visibility");
    const trigger = page.locator("[data-ai-history-trigger]");
    await expect(trigger).toHaveText(/^October 2026/);
    await expect(page.locator("[data-ai-history-banner]")).toHaveCount(0);

    // 12 Oct published (13 of 23, 22 of 23) and 20 Oct published (13 of 20, 18 of 18).
    const card = page.locator("[data-ai-window-completeness]");
    await expect(card).toContainText("Runs in this selection2");
    await expect(page.locator("[data-ai-window-calls]")).toHaveText("148 answered of 204 calls");
    await expect(page.locator("[data-ai-win-rate='unbranded_discovery']")).toHaveText("60.5%");
    await expect(page.locator("[data-ai-win-rate='branded_consideration']")).toHaveText("97.6%");
    await expect(page.locator("[data-ai-role='unbranded_discovery']")).toContainText("of 43");
    await expect(page.locator("[data-ai-trend-row$=':overall']")).toHaveCount(2);

    // X-03: the two rates, each with its N of M and disc, open the first screen above the trend.
    const lead = page.locator("[data-ai-run-summary-lead]");
    await expect(lead.locator("[data-ai-role-total='unbranded_discovery']")).toHaveText("26 Fender/Squier leads of 43 resolved answers");
    await expect(lead.locator("[data-ai-role-total='branded_consideration']")).toHaveText("40 Fender/Squier leads of 41 resolved answers");
    await expect(lead.locator("[data-citation-pie-disc]")).toHaveCount(2);
    for (const role of ["unbranded_discovery", "branded_consideration"]) {
      await expect(lead.locator(`[data-ai-win-rate='${role}']`)).toBeInViewport({ ratio: 1 });
      await expect(lead.locator(`[data-citation-pie-disc='summary-${role}']`)).toBeInViewport({ ratio: 1 });
    }
    const leadBox = await lead.boundingBox();
    const trendBox = await page.locator("[data-ai-trend-section]").boundingBox();
    expect(leadBox && trendBox && leadBox.y + leadBox.height <= trendBox.y).toBe(true);

    await page.locator(".drilldown-tab-btn", { hasText: "Run Details" }).click();
    await expect(trigger).toHaveText(/^October 2026/);
    await expect(page.locator("#ai-simulation-list")).toBeVisible();

    await trigger.click();
    const dialog = page.locator("[data-ai-history-dialog]");
    await expect(dialog.locator("[data-ai-history-latest-month]")).toHaveAttribute("aria-pressed", "true");
    await dialog.locator("[data-ai-history-latest-run]").click();
    await expect(trigger).toHaveText(/^Published run · Oct 20, 2026/);
    await page.locator(".drilldown-tab-btn", { hasText: "Run Summary" }).click();
    await expect(page.locator("[data-ai-win-rate='unbranded_discovery']")).toHaveText("65.0%");
    await expect(page.locator("[data-ai-win-rate='branded_consideration']")).toHaveText("100.0%");
    await expect(lead.locator("[data-ai-role-total='unbranded_discovery']")).toHaveText("13 Fender/Squier leads of 20 resolved answers");
    await expect(lead.locator("[data-ai-win-rate='unbranded_discovery']")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("[data-ai-trend-section]")).toHaveCount(0);
    await expect(page.locator("[data-ai-window-completeness]")).toHaveCount(0);

    await trigger.click();
    await dialog.locator("[data-ai-history-latest-month]").click();
    await expect(trigger).toHaveText(/^October 2026/);
    await expect(page.locator("[data-ai-win-rate='unbranded_discovery']")).toHaveText("60.5%");

    await trigger.click();
    await page.getByRole("button", { name: "All time" }).click();
    await expect(trigger).toHaveText(/^All time/);
    await expect(page.locator("[data-ai-window-completeness]")).toContainText("Runs in this selection6");

    expect(await mapFigure(page)).toBe(mapBefore);
  });

});

test.describe("AI Search latest month with no published run", () => {
  test.use({
    aiScenario: {
      current: NOVEMBER_3,
      runs: OCTOBER_CATALOG,
      catalogPatch: { [String(NOVEMBER_3.run.audit_run_id)]: { attempted_calls: 90 } },
    },
  });

  test("a month with no published run says so and offers the latest run", async ({ canvas, page }) => {
    await expect(aiBubble(page)).toContainText("65.0%");
    const mapBefore = await mapFigure(page);
    await canvas.openSpokeFromMap("AI Search Visibility");
    const trigger = page.locator("[data-ai-history-trigger]");
    await expect(trigger).toHaveText(/^November 2026/);

    const notice = page.locator("[data-ai-month-empty]");
    await expect(notice).toContainText("No published run this month");
    await expect(notice).toContainText("November 2026 has no published run with answered calls.");
    await expect(page.locator("[data-ai-win-rate]")).toHaveCount(0);
    await expect(page.locator("[data-ai-history-trends]")).toHaveCount(0);

    await page.locator(".drilldown-tab-btn", { hasText: "Citation Ecosystem" }).click();
    await expect(page.locator("[data-ai-month-empty]")).toContainText("No published run this month");

    await page.locator("[data-ai-month-empty] [data-ai-show-latest-run]").click();
    await expect(trigger).toHaveText(/^Published run · Nov 3, 2026/);
    await page.locator(".drilldown-tab-btn", { hasText: "Run Summary" }).click();
    await expect(page.locator("[data-ai-win-rate='unbranded_discovery']")).toHaveText("65.0%");
    expect(await mapFigure(page)).toBe(mapBefore);
  });
});
