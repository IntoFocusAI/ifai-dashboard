"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAiHistoryOptional, useDisplayedAiSearch } from "@/components/v3/live/ai-search/AiHistoryContext";
import {
  apiEngineViewsEnabled,
  apiRunsCoveringBattery,
  apiRunsInScope,
  batteryQuestions,
  loadApiRunCatalog,
  loadApiRunSnapshot,
  type ApiCatalogResult,
  type ApiRunSummary,
  type ApiSnapshotResult,
} from "@/lib/ai-search/api-runs";
import { useEngineGroupChoice } from "@/components/v3/live/ai-search/engine-group-store";
import { engineGroupRead, type ApiEngineLoad } from "@/lib/ai-search/engine-group-read";
import { runDay } from "@/lib/ai-search/default-window";
import type { HistoryMode } from "@/lib/ai-search/history-mode";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";

import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** Every tab shares one catalog read and one read per API run. A failed read is tried again next time. */
let catalogRead: Promise<ApiCatalogResult> | null = null;
const runReads = new Map<string, Promise<ApiSnapshotResult>>();

function readCatalog(): Promise<ApiCatalogResult> {
  if (!catalogRead) {
    catalogRead = loadApiRunCatalog(getCanvasSupabase() as never).then((result) => {
      if (result.phase === "error") catalogRead = null;
      return result;
    });
  }
  return catalogRead;
}

function readRun(run: ApiRunSummary): Promise<ApiSnapshotResult> {
  const cached = runReads.get(run.audit_run_id);
  if (cached) return cached;
  // No answer text: the map and every tab read many API runs, and a drawer reads its answer on demand.
  const read = loadApiRunSnapshot(getCanvasSupabase() as never, run, { withAnswers: false }).then((result) => {
    if (result.phase === "error") runReads.delete(run.audit_run_id);
    return result;
  });
  runReads.set(run.audit_run_id, read);
  return read;
}

const noSubscribe = () => () => {};
const serverOff = () => false;

const MONTH: HistoryMode = { kind: "month" };

export type ApiCatalogLoad = ApiCatalogResult | { phase: "loading" } | { phase: "off" };

/** Every API run the views list, counted or not. "off" until the API views are read. */
export function useApiRunCatalog(): ApiCatalogLoad {
  const history = useAiHistoryOptional();
  const flagOn = useSyncExternalStore(noSubscribe, () => apiEngineViewsEnabled(), serverOff);
  const enabled = (history?.source ?? "live") !== "fixture" && flagOn;
  const [catalog, setCatalog] = useState<ApiCatalogResult | { phase: "loading" }>({ phase: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void readCatalog().then((result) => {
      if (!cancelled) setCatalog(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? catalog : { phase: "off" };
}

/** The battery run a single-run selection shows, by its day. */
function selectedRunDay(history: ReturnType<typeof useAiHistoryOptional>): string | null {
  if (!history || history.mode.kind !== "run") return null;
  const runId = history.mode.runId;
  const listed = history.catalog.phase === "ready" ? history.catalog.runs.find((run) => run.audit_run_id === runId) : null;
  if (listed) return runDay(listed);
  if (history.selected.phase === "ready" && history.selected.snapshot.run.audit_run_id === runId) {
    return runDay(history.selected.snapshot.run);
  }
  return null;
}

type HistoryValue = NonNullable<ReturnType<typeof useAiHistoryOptional>>;

/** The battery runs the selection shows, for the shopping-question floor. Null while they load. */
function batteryInScope(
  kind: HistoryMode["kind"] | null,
  selected: HistoryValue["selected"] | null,
  trend: HistoryValue["trend"] | null,
): readonly AiSearchSnapshot[] | null {
  if (!kind || kind === "legacy") return [];
  if (kind === "run") {
    if (selected?.phase === "ready") return [selected.snapshot];
    return selected?.phase === "loading" || selected?.phase === "idle" ? null : [];
  }
  if (trend?.phase === "ready") return trend.snapshots;
  return trend?.phase === "loading" || trend?.phase === "idle" ? null : [];
}

/** The given API runs' snapshots, read once each and shared by every tab and the map. */
export function useApiSnapshots(runs: readonly ApiRunSummary[]): ApiEngineLoad {
  const key = runs.map((run) => run.audit_run_id).join(",");
  const [loaded, setLoaded] = useState<{ key: string; load: ApiEngineLoad }>({ key: "", load: { phase: "loading" } });

  useEffect(() => {
    if (runs.length === 0) return;
    let cancelled = false;
    void Promise.all(runs.map(readRun)).then((results) => {
      if (cancelled) return;
      const failed = results.find((result) => result.phase === "error");
      const load: ApiEngineLoad = results.some((result) => result.phase === "missing")
        ? { phase: "missing" }
        : failed && failed.phase === "error"
          ? { phase: "error", message: failed.message }
          : { phase: "ready", snapshots: results.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : [])) };
      setLoaded({ key, load });
    });
    return () => {
      cancelled = true;
    };
  }, [key, runs]);

  if (runs.length === 0) return NO_API_RUNS;
  return loaded.key === key ? loaded.load : LOADING;
}

const NO_API_RUNS: ApiEngineLoad = { phase: "ready", snapshots: [] };
const LOADING: ApiEngineLoad = { phase: "loading" };

/** The catalog's read state for the switch, before any run is chosen. Null once the runs are known. */
export function catalogLoadState(catalog: ApiCatalogLoad): ApiEngineLoad | null {
  if (catalog.phase === "off" || catalog.phase === "missing") return { phase: "missing" };
  if (catalog.phase === "loading") return { phase: "loading" };
  if (catalog.phase === "error") return { phase: "error", message: catalog.message };
  return null;
}

/**
 * The counted API runs dated in the selection the shared date pill names, loaded for the switch.
 * Each must have asked the shopping questions of the battery run nearest its day. A single run gets
 * the nearest API run that did.
 */
export function useApiEngineLoad(): ApiEngineLoad {
  const history = useAiHistoryOptional();
  const mode = history?.mode ?? MONTH;
  const windowEnd = history?.windowEnd ?? null;
  const selectedDay = selectedRunDay(history);
  const kind = history?.mode.kind ?? null;
  const selected = history?.selected ?? null;
  const trend = history?.trend ?? null;
  const battery = useMemo(() => batteryInScope(kind, selected, trend), [kind, selected, trend]);
  const catalog = useApiRunCatalog();

  const inScope = useMemo(() => {
    if (catalog.phase !== "ready" || !battery) return [];
    const eligible = apiRunsCoveringBattery(catalog.runs, batteryQuestions(battery));
    return apiRunsInScope(eligible, mode, windowEnd, selectedDay);
  }, [battery, catalog, mode, windowEnd, selectedDay]);
  const load = useApiSnapshots(inScope);

  // The shopping-question floor waits on the battery runs; start reading the candidates meanwhile.
  useEffect(() => {
    if (catalog.phase !== "ready" || battery) return;
    for (const run of apiRunsInScope(catalog.runs, mode, windowEnd, selectedDay)) void readRun(run);
  }, [battery, catalog, mode, windowEnd, selectedDay]);

  const pending = catalogLoadState(catalog);
  if (pending) return pending;
  if (!battery) return { phase: "loading" };
  return load;
}

/**
 * The map's AI Search read (Brian Magazu, 12 Nov 2026; replaces decision 7): the date-pill window
 * with the API runs in it, narrowed by the engine switch, exactly as the AI Search and Competitive
 * Radar tabs read it. Every map bubble, Minimal, Summary, the Roadmap, Action Items and the deck
 * read this one population. `published` is the published run the window ends on.
 */
export function useMapAiSearch(published: AiSearchRead): AiSearchRead {
  const displayed = useDisplayedAiSearch(published);
  const windowApi = useApiEngineLoad();
  const [choice] = useEngineGroupChoice();
  return useMemo(() => engineGroupRead(displayed, windowApi, choice), [displayed, windowApi, choice]);
}
