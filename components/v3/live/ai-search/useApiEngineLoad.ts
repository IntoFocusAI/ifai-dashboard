"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import {
  apiEngineViewsEnabled,
  apiRunsInScope,
  loadApiRunCatalog,
  loadApiRunSnapshot,
  type ApiCatalogResult,
  type ApiRunSummary,
  type ApiSnapshotResult,
} from "@/lib/ai-search/api-runs";
import type { ApiEngineLoad } from "@/lib/ai-search/engine-group-read";
import { runDay } from "@/lib/ai-search/default-window";
import type { HistoryMode } from "@/lib/ai-search/history-mode";
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
  const read = loadApiRunSnapshot(getCanvasSupabase() as never, run).then((result) => {
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

/**
 * The counted API runs dated in the selection the shared date pill names, loaded for the switch.
 * A single run gets the API run nearest its day.
 */
export function useApiEngineLoad(): ApiEngineLoad {
  const history = useAiHistoryOptional();
  const mode = history?.mode ?? MONTH;
  const windowEnd = history?.windowEnd ?? null;
  const selectedDay = selectedRunDay(history);
  const catalog = useApiRunCatalog();

  const inScope = useMemo(
    () => (catalog.phase === "ready" ? apiRunsInScope(catalog.runs, mode, windowEnd, selectedDay) : []),
    [catalog, mode, windowEnd, selectedDay],
  );
  const key = inScope.map((run) => run.audit_run_id).join(",");
  const [loaded, setLoaded] = useState<{ key: string; load: ApiEngineLoad }>({ key: "", load: { phase: "loading" } });

  useEffect(() => {
    if (inScope.length === 0) return;
    let cancelled = false;
    void Promise.all(inScope.map(readRun)).then((results) => {
      if (cancelled) return;
      const failed = results.find((result) => result.phase === "error");
      const load: ApiEngineLoad = results.some((result) => result.phase === "missing")
        ? { phase: "missing" }
        : failed && failed.phase === "error"
          ? { phase: "error", message: failed.message }
          : { phase: "ready", snapshots: results.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : [])) };
      setLoaded({ key: inScope.map((run) => run.audit_run_id).join(","), load });
    });
    return () => {
      cancelled = true;
    };
  }, [inScope]);

  if (catalog.phase === "off") return { phase: "missing" };
  if (catalog.phase === "loading") return { phase: "loading" };
  if (catalog.phase === "missing") return { phase: "missing" };
  if (catalog.phase === "error") return { phase: "error", message: catalog.message };
  if (inScope.length === 0) return { phase: "ready", snapshots: [] };
  return loaded.key === key ? loaded.load : { phase: "loading" };
}
