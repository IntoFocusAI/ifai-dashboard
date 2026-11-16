import { loadCanvas } from "@/lib/canvasData";
import {
  apiEngineViewsEnabled,
  loadApiRunCatalog,
  loadApiRunSnapshot,
  pairedApiRuns,
  type ApiCatalogResult,
  type ApiRunSummary,
  type ApiSnapshotResult,
} from "@/lib/ai-search/api-runs";
import { engineGroupRead, type ApiEngineLoad } from "@/lib/ai-search/engine-group-read";
import { compareRuns, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import type { HistoryMode } from "@/lib/ai-search/history-mode";
import {
  loadHistoryCatalog,
  loadHistorySnapshot,
  type HistoryReadClient,
  type HistorySnapshotResult,
} from "@/lib/ai-search/history-queries";
import { loadAiSearchRead, type AiReadClient } from "@/lib/ai-search/queries";
import { ensureSiteTypes } from "@/lib/ai-search/site-types";
import { windowQuestionSetChange } from "@/lib/ai-search/history-trends";
import { parseAiSelectionScope, type AiSelectionScope } from "@/lib/ai-search/selection";
import { loadAiSelection } from "@/lib/ai-search/selection-load";
import { aiSearchStale, aiWindowPartial, questionSetMixed, selectionEndsOnPublishedRun } from "@/lib/ai-search/stale";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import { activeClient } from "@/lib/client/active-client";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import { loadExceptions } from "@/lib/export/map-export";
import type { ExportSource, SourceRead } from "@/lib/export/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { withMapApprovedExceptions } from "@/lib/fender-canvas/map-approved-exceptions";
import type { StockLossRead } from "@/lib/fender-canvas/minimal-metric-kit";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { staffFocus, type PlanFocus } from "@/lib/fender-canvas/roadmap-focus";
import {
  assembleRoadmapPlan,
  FIX_LIST_HEADER,
  fixListCells,
  focusWindowApiRuns,
  focusWindowsReady,
  priorRunIds,
  sourceRunsRead,
  type FocusWindowsRead,
  type RoadmapPlanRead,
} from "@/lib/fender-canvas/roadmap-plan-read";
import { focusWindowRuns } from "@/lib/fender-canvas/roadmap-window";
import { loadStockLossRows } from "@/lib/fender-canvas/stock-loss";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import { loadFindabilityRead, type FindabilityClient } from "@/lib/findability/queries";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export const ACTION_ITEMS_EXPORT_TABLE = "action-items-fixes";

/** The date-pill window every AI figure reads, with its stored battery runs and the pill's mode. */
export type ActionItemsWindow =
  | { phase: "ready"; read: AiSearchRead; battery: AiSearchSnapshot[]; mode: HistoryMode }
  | { phase: "error"; message: string };

/** The reads behind the fix list, each the read the browser makes. Tests pass fixtures. */
export type ActionItemsReads = {
  retail: () => Promise<RetailCanvasRead>;
  bundle: () => Promise<CanvasBundle | null>;
  findability: () => Promise<FindabilityRead>;
  stock: () => Promise<StockLossRead>;
  /** The published AI run (AiSearchContext). */
  published: () => Promise<AiSearchRead>;
  /** The date-pill window with its API runs and the engine switch (useMapAiSearch). */
  window: () => Promise<ActionItemsWindow>;
  /** The catalog of published runs (AiHistoryProvider). */
  historyCatalog: () => Promise<{ phase: "ready"; runs: HistoryRunSummary[] } | { phase: "error"; message: string }>;
  /** The API run catalog; "off" when the API-engine views are not read (useApiRunCatalog). */
  apiCatalog: () => Promise<ApiCatalogResult | { phase: "off" }>;
  /** One earlier published run (readPublishedRun). */
  run: (runId: string) => Promise<HistorySnapshotResult>;
  /** One API run (useApiSnapshots). */
  apiRun: (run: ApiRunSummary) => Promise<ApiSnapshotResult>;
};

const READY_NONE: ApiEngineLoad = { phase: "ready", snapshots: [] };

/** useApiSnapshots: no runs reads as none; a missing view or a failed read wins over the rest. */
async function apiSnapshots(reads: ActionItemsReads, runs: readonly ApiRunSummary[]): Promise<ApiEngineLoad> {
  if (runs.length === 0) return READY_NONE;
  const results = await Promise.all(runs.map((run) => reads.apiRun(run)));
  if (results.some((result) => result.phase === "missing")) return { phase: "missing" };
  const failed = results.find((result) => result.phase === "error");
  if (failed && failed.phase === "error") return { phase: "error", message: failed.message };
  return { phase: "ready", snapshots: results.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : [])) };
}

/** catalogLoadState, for the catalog as read. */
function catalogPending(catalog: ApiCatalogResult | { phase: "off" }): ApiEngineLoad | null {
  if (catalog.phase === "off" || catalog.phase === "missing") return { phase: "missing" };
  if (catalog.phase === "error") return { phase: "error", message: catalog.message };
  return null;
}

function snapshotRead(result: HistorySnapshotResult): AiSearchRead {
  return result.phase === "ready" ? { phase: "ready", snapshot: result.snapshot } : { phase: "error", message: result.message };
}

/**
 * The plan the Action Items tab shows, built with the reads and functions the browser hooks use:
 * useSummaryAiRead (the date-pill window with its API runs and the engine switch), useSourceRuns
 * (the newest run in the window and the two runs before it, each with its API run), and
 * useFocusWindows (both 30-day windows with their API runs).
 */
export async function loadActionItemsPlan(
  reads: ActionItemsReads,
  focus: PlanFocus = staffFocus(),
): Promise<RoadmapPlanRead> {
  const [retail, bundle, findability, stock, published, history, apiCatalog, win] = await Promise.all([
    reads.retail(),
    reads.bundle(),
    reads.findability(),
    reads.stock(),
    reads.published(),
    reads.historyCatalog(),
    reads.apiCatalog(),
    reads.window(),
  ]);
  const pending = catalogPending(apiCatalog);
  const mapRead = async (read: AiSearchRead): Promise<AiSearchRead> => {
    const snapshot = read.phase === "ready" ? read.snapshot : null;
    const paired = apiCatalog.phase === "ready" ? pairedApiRuns(apiCatalog.runs, snapshot) : [];
    return engineGroupRead(read, pending ?? (await apiSnapshots(reads, paired)), "all");
  };

  const ai: AiSearchRead = win.phase === "ready" ? win.read : { phase: "error", message: win.message };
  const current = published.phase === "ready" ? published.snapshot : null;
  const aiStale = ai.phase === "ready" && win.phase === "ready" ? windowPartial(win, current) : null;

  // useSourceRuns: the newest run in the window, then the runs before it.
  const newestSnapshot = win.phase === "ready" ? ([...win.battery].sort((a, b) => compareRuns(a.run as never, b.run as never)).at(-1) ?? null) : null;
  const newest = newestSnapshot ? await mapRead({ phase: "ready", snapshot: newestSnapshot }) : ai;
  const ids =
    newest.phase === "ready" && history.phase === "ready" ? priorRunIds(history.runs, newest.snapshot.run.audit_run_id) : null;
  const prior = await Promise.all((ids ?? []).map(async (id) => mapRead(snapshotRead(await reads.run(id)))));
  const sources = sourceRunsRead({ current: newest, ids, live: true, catalogFailed: history.phase === "error", prior });

  const windows = await focusWindows(reads, history, current, apiCatalog, pending);
  return assembleRoadmapPlan({ retail, bundle, findability, ai, aiStale, stock, sources, windows, focus });
}

/** useAiStale: stale when the window ends on a stale published run; mixed across a question-set change. */
function windowPartial(win: Extract<ActionItemsWindow, { phase: "ready" }>, published: AiSearchSnapshot | null) {
  const run = published?.run ?? null;
  const day = run ? utcDay(run.published_at ?? run.completed_at) : null;
  const stale = run && selectionEndsOnPublishedRun(win.mode, run.audit_run_id, day) ? aiSearchStale(run) : null;
  const windowed = win.mode.kind !== "run" && win.mode.kind !== "legacy";
  return aiWindowPartial(stale, questionSetMixed(windowed ? windowQuestionSetChange(win.battery) : null));
}

/** The pill's default when a download names no selection: the last 30 days, every engine. */
const DEFAULT_SCOPE: AiSelectionScope = { mode: { kind: "month" }, windowEnd: null, engines: "all", enginesReady: true };

/** useFocusWindows: the 30 days ending on the published run and the 30 days before. */
async function focusWindows(
  reads: ActionItemsReads,
  history: Awaited<ReturnType<ActionItemsReads["historyCatalog"]>>,
  published: AiSearchSnapshot | null,
  apiCatalog: ApiCatalogResult | { phase: "off" },
  pending: ApiEngineLoad | null,
): Promise<FocusWindowsRead> {
  if (history.phase === "error") return { phase: "error", message: history.message };
  const end = published ? utcDay(published.run.published_at ?? published.run.completed_at) : null;
  if (!end) return { phase: "loading" };
  const runs = focusWindowRuns(history.runs, end);
  const results = await Promise.all(
    [...runs.current, ...runs.previous].map((run) =>
      published && run.audit_run_id === published.run.audit_run_id
        ? Promise.resolve<HistorySnapshotResult>({ phase: "ready", snapshot: published })
        : reads.run(run.audit_run_id),
    ),
  );
  const failed = results.find((result) => result.phase !== "ready");
  if (failed && "message" in failed) return { phase: "error", message: failed.message };
  const byId = new Map(
    results.flatMap((result) => (result.phase === "ready" ? [[result.snapshot.run.audit_run_id, result.snapshot] as const] : [])),
  );
  const pick = (list: readonly HistoryRunSummary[]) => list.flatMap((run) => byId.get(run.audit_run_id) ?? []);
  const split = { current: pick(runs.current), previous: pick(runs.previous) };
  const apiRuns = apiCatalog.phase === "ready" ? focusWindowApiRuns(apiCatalog.runs, split, end) : { current: [], previous: [] };
  const [currentApi, previousApi] = await Promise.all([apiSnapshots(reads, apiRuns.current), apiSnapshots(reads, apiRuns.previous)]);
  return focusWindowsReady(split, pending, currentApi, previousApi);
}

/** The reads against the live database, as the dashboard makes them, for the pill's selection. */
export function liveActionItemsReads(scope: AiSelectionScope = DEFAULT_SCOPE): ActionItemsReads {
  const client = getCanvasSupabase();
  const history = client as unknown as HistoryReadClient;
  // Site types load once per client before any run is read (afterSiteTypes in the browser).
  const siteTypes = ensureSiteTypes(client);
  return {
    retail: async () => {
      try {
        const [snapshot, exceptions] = await Promise.all([loadPortfolioRetailSnapshot(), loadExceptions()]);
        return { phase: "ready", snapshot: withMapApprovedExceptions(snapshot, exceptions.asins, { failed: exceptions.failed }) };
      } catch {
        return { phase: "error" };
      }
    },
    bundle: () => loadCanvas().catch(() => null),
    findability: () =>
      loadFindabilityRead(client as unknown as FindabilityClient).catch(
        (error: unknown): FindabilityRead => ({ phase: "error", message: error instanceof Error ? error.message : String(error) }),
      ),
    stock: async () => {
      try {
        const next = await loadStockLossRows();
        return next.available ? { phase: "ready", rows: next.rows, populationCount: next.populationCount } : { phase: "error" };
      } catch {
        return { phase: "error" };
      }
    },
    published: () =>
      siteTypes
        .then(() => loadAiSearchRead(client as unknown as AiReadClient))
        .catch((error: unknown): AiSearchRead => ({ phase: "error", message: error instanceof Error ? error.message : String(error) })),
    window: async () => {
      try {
        await siteTypes;
        const loaded = await loadAiSelection(client as never, scope, { citations: true });
        if (!loaded.ok) return { phase: "error", message: loaded.message };
        return { phase: "ready", read: loaded.selection.read, battery: loaded.selection.battery, mode: scope.mode };
      } catch (error) {
        return { phase: "error", message: error instanceof Error ? error.message : String(error) };
      }
    },
    historyCatalog: () => loadHistoryCatalog(history),
    apiCatalog: async () => (apiEngineViewsEnabled() ? loadApiRunCatalog(history) : { phase: "off" }),
    run: (runId) => siteTypes.then(() => loadHistorySnapshot(history, runId)),
    apiRun: (run) => loadApiRunSnapshot(history, run),
  };
}

function plural(count: number, one: string, many: string): string {
  return `${formatInt(count)} ${count === 1 ? one : many}`;
}

/** The fix list as a download: every row in Action Items order, cells as the screen reads them. */
export function actionItemsExportSource(read: RoadmapPlanRead, today: Date, asOf: string, focus: PlanFocus): ExportSource {
  const findings = read.plan.filter((item) => item.kind === "finding").length;
  const actions = read.plan.length - findings;
  return {
    table: ACTION_ITEMS_EXPORT_TABLE,
    header: [...FIX_LIST_HEADER],
    rows: read.plan.map((item) => ({ key: item.id, cells: fixListCells(item, today) })),
    filter: focus.kind === "category" ? `Focus: ${focus.key}.` : null,
    sort: "Priority order.",
    population: `${plural(findings, "current finding", "current findings")}, then ${plural(actions, "action", "actions")}`,
    asOf,
  };
}

/** Download CSV for the Action Items fix list (X-10), on the date pill's selection when sent. */
export async function loadActionItemsSource(scope: Record<string, unknown> | null = null): Promise<SourceRead> {
  try {
    const focus = staffFocus(activeClient().roadmapFocusCategory);
    const selection = parseAiSelectionScope(scope?.ai) ?? DEFAULT_SCOPE;
    const [read, asOf] = await Promise.all([loadActionItemsPlan(liveActionItemsReads(selection), focus), loadDashboardAsOf()]);
    return { ok: true, source: actionItemsExportSource(read, new Date(), asOf.asOf, focus) };
  } catch {
    return { ok: false, message: "The fix list could not be read. Try again." };
  }
}
