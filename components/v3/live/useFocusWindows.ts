"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { catalogLoadState, useApiRunCatalog, useApiSnapshots } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { afterSiteTypes } from "@/lib/ai-search/site-types";
import { loadHistorySnapshot, type HistorySnapshotResult } from "@/lib/ai-search/history-queries";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { focusWindowApiRuns, focusWindowsReady, type FocusWindowsRead } from "@/lib/fender-canvas/roadmap-plan-read";
import { focusWindowRuns } from "@/lib/fender-canvas/roadmap-window";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** Earlier published runs, read once per run and shared by Action Items and the Roadmap. */
const runReads = new Map<string, Promise<HistorySnapshotResult>>();

export function readPublishedRun(runId: string): Promise<HistorySnapshotResult> {
  const cached = runReads.get(runId);
  if (cached) return cached;
  const read = afterSiteTypes(getCanvasSupabase(), () => loadHistorySnapshot(getCanvasSupabase() as never, runId)).then((result) => {
    if (result.phase === "error") runReads.delete(runId);
    return result;
  });
  runReads.set(runId, read);
  return read;
}

export type { FocusWindowsRead };

/** The published review runs of both windows, loaded; the published run itself is not read again. */
function useBatteryRuns(ids: string[] | null, published: AiSearchSnapshot | null) {
  const key = ids?.join(",") ?? "";
  const [state, setState] = useState<{ key: string; snapshots: AiSearchSnapshot[] | null; error: string | null }>({
    key: "",
    snapshots: null,
    error: null,
  });
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    void Promise.all(
      ids.map((id) =>
        published && id === published.run.audit_run_id
          ? Promise.resolve<HistorySnapshotResult>({ phase: "ready", snapshot: published })
          : readPublishedRun(id),
      ),
    ).then((results) => {
      if (cancelled) return;
      const failed = results.find((result) => result.phase !== "ready");
      setState({
        key,
        snapshots: results.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : [])),
        error: failed && "message" in failed ? failed.message : null,
      });
    });
    return () => {
      cancelled = true;
    };
    // `key` names the ids; the array itself changes on every catalog read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, published]);
  return state.key === key && ids ? state : null;
}

/**
 * The 21d windows: the last 30 days ending on the published run, and the 30 days before, each
 * read as the AI Search tabs read the last 30 days with the API runs in it (decision 7). The
 * labeled sample copy has no catalog of earlier runs, so it reads the published run alone.
 */
export function useFocusWindows(): FocusWindowsRead {
  const history = useAiHistory();
  const published = history.current.phase === "ready" ? history.current.snapshot : null;
  const end = history.windowEnd;
  const runs = useMemo(() => {
    if (history.source !== "live" || history.catalog.phase !== "ready" || !end) return null;
    return focusWindowRuns(history.catalog.runs, end);
  }, [end, history.catalog, history.source]);
  const ids = useMemo(
    () => (runs ? [...runs.current, ...runs.previous].map((run) => run.audit_run_id) : null),
    [runs],
  );
  const battery = useBatteryRuns(ids, published);
  const split = useMemo(() => {
    if (!runs || !battery?.snapshots) return null;
    const byId = new Map(battery.snapshots.map((snapshot) => [snapshot.run.audit_run_id, snapshot]));
    const pick = (list: typeof runs.current) => list.flatMap((run) => byId.get(run.audit_run_id) ?? []);
    return { current: pick(runs.current), previous: pick(runs.previous) };
  }, [battery, runs]);

  const catalog = useApiRunCatalog();
  const apiRuns = useMemo(
    () => (catalog.phase === "ready" && split ? focusWindowApiRuns(catalog.runs, split, end) : { current: [], previous: [] }),
    [catalog, end, split],
  );
  const currentApi = useApiSnapshots(apiRuns.current);
  const previousApi = useApiSnapshots(apiRuns.previous);
  const pending = catalogLoadState(catalog);

  return useMemo<FocusWindowsRead>(() => {
    if (history.source === "fixture") {
      if (!published) return { phase: "loading" };
      const empty = { engines: [], questions: [], runs: [] };
      return { phase: "ready", windows: { current: published, previous: null }, summary: { current: empty, previous: empty } };
    }
    if (history.catalog.phase === "error") return { phase: "error", message: history.catalog.message };
    if (!split || !battery) return { phase: "loading" };
    if (battery.error) return { phase: "error", message: battery.error };
    return focusWindowsReady(split, pending, currentApi, previousApi);
  }, [battery, currentApi, history.catalog, history.source, pending, previousApi, published, split]);
}
