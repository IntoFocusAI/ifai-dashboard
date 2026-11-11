import { apiRunDay, daysApart } from "@/lib/ai-search/api-runs";
import { runDay } from "@/lib/ai-search/default-window";
import {
  citationPopulation,
  filterSnapshotByEngineGroup,
  isApiEngine,
  withApiSnapshots,
  type EngineGroupChoice,
} from "@/lib/ai-search/engine-group";
import { engineSwitchState, type ApiEngineLoad } from "@/lib/ai-search/engine-group-read";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * The trend and Citation Ecosystem read one snapshot per battery run. An API run joins the battery
 * run nearest its day, so each point is that run's search engines and the API engines beside it,
 * and the point keeps the battery run's date, question set, and scoring method.
 */

/**
 * The trend keeps the rotating catalog fact checks on every switch position. Citation totals
 * count fact-check citations, so with API engines in the window they keep the fixed questions
 * on every point (citationPopulation).
 */
export type EngineWindowReader = "trend" | "citations";

export type EngineWindowLoad<T> =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "unavailable"; message: string }
  | { phase: "error"; message: string }
  | { phase: "ready"; snapshots: T[] };

export type EngineWindow = {
  snapshots: AiSearchSnapshot[];
  /** Battery run id to the days of the API runs on its point. Empty without API engines. */
  apiDays: ReadonlyMap<string, string[]>;
};

const NO_API_DAYS: ReadonlyMap<string, string[]> = new Map();

/** Each API run goes to the battery run nearest its day. A tie goes to the later battery run. */
export function pairApiRuns(
  search: readonly AiSearchSnapshot[],
  api: readonly AiSearchSnapshot[],
): Map<string, AiSearchSnapshot[]> {
  const pairs = new Map<string, AiSearchSnapshot[]>();
  const dated = search
    .map((snapshot) => ({ snapshot, day: runDay(snapshot.run) }))
    .filter((item): item is { snapshot: AiSearchSnapshot; day: string } => item.day != null)
    .sort((a, b) => a.day.localeCompare(b.day));
  for (const run of api) {
    const day = apiRunDay(run.run);
    if (!day || dated.length === 0) continue;
    let best = dated[0];
    for (const item of dated) {
      if (daysApart(item.day, day) <= daysApart(best.day, day)) best = item;
    }
    const id = best.snapshot.run.audit_run_id;
    pairs.set(id, [...(pairs.get(id) ?? []), run]);
  }
  return pairs;
}

/** The selection's battery runs with their API runs beside them, narrowed by the switch. */
export function engineGroupWindow(
  search: readonly AiSearchSnapshot[],
  api: readonly AiSearchSnapshot[],
  choice: EngineGroupChoice,
  reader: EngineWindowReader = "trend",
): EngineWindow {
  if (choice === "search" || (choice === "all" && api.length === 0)) {
    return { snapshots: [...search], apiDays: NO_API_DAYS };
  }
  const pairs = pairApiRuns(search, api);
  const snapshots: AiSearchSnapshot[] = [];
  const apiDays = new Map<string, string[]>();
  for (const base of search) {
    const id = base.run.audit_run_id;
    const paired = pairs.get(id) ?? [];
    if (choice === "api" && paired.length === 0) continue;
    const merged = withApiSnapshots(base, paired);
    // The trend counts a point's calls by run id, so the API calls carry their point's id.
    // Their call ids keep the API run's id as a prefix.
    const calls = merged.calls.map((call) => (isApiEngine(call.engine) ? { ...call, audit_run_id: id } : call));
    const filtered = filterSnapshotByEngineGroup({ ...merged, calls }, choice);
    if (!filtered) continue;
    snapshots.push({ ...filtered, run: base.run });
    const days = paired.map((run) => apiRunDay(run.run)).filter((day): day is string => day != null);
    if (days.length) apiDays.set(id, days);
  }
  if (reader === "citations") {
    return { snapshots: snapshots.map((snapshot) => citationPopulation(snapshot, pairs.size > 0)), apiDays };
  }
  return { snapshots, apiDays };
}

/**
 * The window's runs for the trend and the citation totals. Until the API runs are known, All and
 * API only wait; Without API and a switch that reads Not available* keep the battery runs as they are.
 */
export function engineGroupTrend(
  trend: EngineWindowLoad<AiSearchSnapshot>,
  load: ApiEngineLoad,
  choice: EngineGroupChoice,
  reader: EngineWindowReader = "trend",
): { trend: EngineWindowLoad<AiSearchSnapshot>; apiDays: ReadonlyMap<string, string[]> } {
  const passthrough = { trend, apiDays: NO_API_DAYS };
  if (trend.phase !== "ready") return passthrough;
  const state = engineSwitchState(load, choice);
  if (state.kind === "loading") {
    return choice === "search" ? passthrough : { trend: { phase: "loading" }, apiDays: NO_API_DAYS };
  }
  if (state.kind === "unavailable" || load.phase !== "ready") return passthrough;
  const window = engineGroupWindow(trend.snapshots, load.snapshots, choice, reader);
  return { trend: { phase: "ready", snapshots: window.snapshots }, apiDays: window.apiDays };
}
