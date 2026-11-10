import {
  apiEngineViewsEnabled,
  apiRunsCoveringBattery,
  apiRunsInScope,
  batteryQuestions,
  loadApiRunCatalog,
  loadApiRunSnapshot,
} from "@/lib/ai-search/api-runs";
import { pooledCitationSnapshot } from "@/lib/ai-search/citation-aggregate";
import { clientWindowSnapshots, runDay } from "@/lib/ai-search/default-window";
import { displayedAiRead } from "@/lib/ai-search/displayed-read";
import { engineGroupRead, engineSwitchState, type ApiEngineLoad } from "@/lib/ai-search/engine-group-read";
import { engineGroupTrend } from "@/lib/ai-search/engine-group-window";
import { compareRuns, utcDay } from "@/lib/ai-search/history-eligibility";
import {
  loadHistoryCatalog,
  loadHistorySnapshot,
  type HistoryReadClient,
  type HistoryReadOptions,
} from "@/lib/ai-search/history-queries";
import { loadAiSearchRead, type AiReadClient } from "@/lib/ai-search/queries";
import { runsInSelection, selectionPillLabel, type AiSelectionScope } from "@/lib/ai-search/selection";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * One AI Search selection, read the way the tabs read it: the published run, the battery runs
 * the date pill names, the API runs beside them, and the engine switch. The browser hooks
 * (AiHistoryProvider, useApiEngineLoad, useCitationAggregate) run these same steps with the
 * same functions; this is the path a server download takes.
 */
export type AiSelection = {
  scope: AiSelectionScope;
  /** What Run Summary, Run Details, and Product Fact Checks show. */
  read: AiSearchRead;
  /** What Citation Ecosystem shows: only runs that stored their cited URLs. Null when none did. */
  citationSnapshot: AiSearchSnapshot | null;
  /** One snapshot per battery run of a window, narrowed by the switch. Empty for a single run. */
  trend: AiSearchSnapshot[];
  /** Battery run id to the days of the API runs on its trend point. */
  apiDays: ReadonlyMap<string, string[]>;
  /** False when the engine switch reads Not available*, so every figure is the search engines'. */
  enginesReady: boolean;
  /** The date pill's words for this selection. */
  pillLabel: string;
  /** Battery runs in the selection. */
  runCount: number;
  /** When the newest run in the selection was published (ISO), or null. */
  newestRunAt: string | null;
};

export type AiSelectionResult = { ok: true; selection: AiSelection } | { ok: false; message: string };

const SELECTION_FAILED = "The runs in this selection could not be read.";
const API_ENGINES_FAILED = "The API-engine runs in this selection could not be read. Try the download again.";

type Loaded = { phase: "ready"; snapshot: AiSearchSnapshot } | { phase: "failed"; message: string };

async function loadRun(client: HistoryReadClient, runId: string, options: HistoryReadOptions): Promise<Loaded> {
  const result = await loadHistorySnapshot(client, runId, options);
  return result.phase === "ready" ? result : { phase: "failed", message: result.message };
}

async function loadApiEngines(
  client: HistoryReadClient,
  scope: AiSelectionScope,
  battery: readonly AiSearchSnapshot[],
  windowEnd: string | null,
  selectedDay: string | null,
): Promise<ApiEngineLoad> {
  if (!apiEngineViewsEnabled()) return { phase: "missing" };
  const catalog = await loadApiRunCatalog(client);
  if (catalog.phase === "missing") return { phase: "missing" };
  if (catalog.phase === "error") return { phase: "error", message: catalog.message };
  const eligible = apiRunsCoveringBattery(catalog.runs, batteryQuestions(battery));
  const inScope = apiRunsInScope(eligible, scope.mode, windowEnd, selectedDay);
  const results = await Promise.all(inScope.map((run) => loadApiRunSnapshot(client, run)));
  if (results.some((result) => result.phase === "missing")) return { phase: "missing" };
  const failed = results.find((result) => result.phase === "error");
  if (failed && failed.phase === "error") return { phase: "error", message: failed.message };
  return { phase: "ready", snapshots: results.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : [])) };
}

/**
 * Reads the selection. `citations: false` skips the cited-URL rows of the battery runs, for a
 * table that shows none; the published run always arrives whole.
 */
export async function loadAiSelection(
  client: HistoryReadClient & AiReadClient,
  scope: AiSelectionScope,
  options: { citations: boolean },
): Promise<AiSelectionResult> {
  const read: HistoryReadOptions = { withAnswers: false, withCitations: options.citations };
  const current = await loadAiSearchRead(client);
  const published = current.phase === "ready" ? current.snapshot : null;
  const publishedDay = published ? utcDay(published.run.published_at ?? published.run.completed_at) : null;
  // The window ends where the screen's window ended. Without one, it ends on the published run.
  const windowEnd = scope.windowEnd ?? publishedDay;
  const mode = scope.mode;

  let selected: Parameters<typeof displayedAiRead>[1] = { phase: "idle" };
  let trend: Parameters<typeof displayedAiRead>[2] = { phase: "idle" };
  let battery: AiSearchSnapshot[] = [];
  let selectedDay: string | null = null;

  if (mode.kind === "run") {
    if (published && published.run.audit_run_id === mode.runId) {
      selected = { phase: "ready", snapshot: published };
    } else {
      const loaded = await loadRun(client, mode.runId, read);
      if (loaded.phase === "failed") return { ok: false, message: loaded.message };
      selected = loaded;
    }
    battery = [selected.snapshot];
    selectedDay = runDay(selected.snapshot.run);
  } else {
    if (mode.kind === "month" && !published) return { ok: false, message: "The published AI run could not be read." };
    const catalog = await loadHistoryCatalog(client);
    if (catalog.phase === "error") return { ok: false, message: SELECTION_FAILED };
    const runs = runsInSelection(catalog.runs, mode, windowEnd).sort(compareRuns);
    const loaded = await Promise.all(runs.map((run) => loadRun(client, run.audit_run_id, read)));
    if (loaded.some((item) => item.phase === "failed")) return { ok: false, message: SELECTION_FAILED };
    const snapshots = loaded.flatMap((item) => (item.phase === "ready" ? [item.snapshot] : []));
    battery = mode.kind === "month" ? clientWindowSnapshots(snapshots) : snapshots;
    trend = { phase: "ready", snapshots: battery };
  }

  const displayed = displayedAiRead(mode, selected, trend, current);
  // The screen's switch read Not available*: its figures were the search engines', so are these.
  const load: ApiEngineLoad = scope.enginesReady
    ? await loadApiEngines(client, { ...scope, windowEnd }, battery, windowEnd, selectedDay)
    : { phase: "missing" };
  // The screen held API engines and this read cannot: fail rather than write a smaller table.
  if (scope.enginesReady && engineSwitchState(load, scope.engines).kind !== "ready") {
    return { ok: false, message: API_ENGINES_FAILED };
  }
  const narrowed = engineGroupRead(displayed, load, scope.engines);
  const window =
    mode.kind === "run"
      ? { trend: { phase: "idle" as const }, apiDays: new Map<string, string[]>() }
      : engineGroupTrend({ phase: "ready", snapshots: battery }, load, scope.engines);
  const windowSnapshots = window.trend.phase === "ready" ? window.trend.snapshots : [];
  const citationSnapshot =
    mode.kind === "run"
      ? narrowed.phase === "ready"
        ? narrowed.snapshot
        : null
      : pooledCitationSnapshot(windowSnapshots);
  const newest = [...battery].sort((a, b) => compareRuns(a.run as never, b.run as never)).at(-1) ?? null;

  return {
    ok: true,
    selection: {
      scope: { ...scope, windowEnd },
      read: narrowed,
      citationSnapshot,
      trend: windowSnapshots,
      apiDays: window.apiDays,
      enginesReady: engineSwitchState(load, scope.engines).kind === "ready",
      pillLabel: selectionPillLabel({ ...scope, windowEnd }, selectedDay, published?.run.audit_run_id ?? null),
      runCount: battery.length,
      newestRunAt: newest ? (newest.run.published_at ?? newest.run.completed_at) : null,
    },
  };
}
