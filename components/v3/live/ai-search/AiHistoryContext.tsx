"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { clientWindowSnapshots, latestPublishedDay } from "@/lib/ai-search/default-window";
import { displayedAiRead } from "@/lib/ai-search/displayed-read";
import { compareRuns, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { historyFixtureSnapshot, historyFixtureSummaries } from "@/lib/ai-search/history-fixtures";
import {
  DEFAULT_HISTORY_MODE,
  historyControlLabel,
  windowBounds,
  type HistoryMode,
} from "@/lib/ai-search/history-mode";
import { afterSiteTypes } from "@/lib/ai-search/site-types";
import { loadHistoryCatalog,loadHistorySnapshot, type HistorySnapshotResult } from "@/lib/ai-search/history-queries";
import { loadPublishedRunRow } from "@/lib/ai-search/queries";
import { runsInSelection } from "@/lib/ai-search/selection";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import { readsWindowRemotely } from "@/lib/ai-search/window-read";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

type CatalogState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; runs: HistoryRunSummary[] };

export type TrendLoad =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "unavailable"; message: string }
  | { phase: "error"; message: string }
  | { phase: "ready"; snapshots: AiSearchSnapshot[] };

type SelectedState = { phase: "idle" } | { phase: "loading" } | HistorySnapshotResult;

type AiHistoryValue = {
  source: "live" | "fixture";
  mode: HistoryMode;
  catalog: CatalogState;
  current: AiSearchRead;
  selected: SelectedState;
  trend: TrendLoad;
  controlLabel: string;
  /** Last day of the default window: the published run's day, or the copy's latest published run. */
  windowEnd: string | null;
  /** Inclusive days of the selected window. Null on either side when the window is open there. */
  bounds: { from: string | null; to: string | null };
  /** Catalog runs the selected window adds. Empty for a single run. */
  windowRuns: HistoryRunSummary[];
  viewMonth: () => void;
  viewRun: (runId: string) => void;
  /** Shows the published run the map already read, without another database read. */
  viewPublished: () => void;
  viewLegacy: (runId: string) => void;
  viewRange: (from: string, to: string) => void;
  viewAll: () => void;
};

const AiHistoryContext = createContext<AiHistoryValue | null>(null);

function isWindowMode(mode: HistoryMode): boolean {
  return mode.kind === "month" || mode.kind === "range" || mode.kind === "all";
}

export function AiHistoryProvider({ current, children }: { current: AiSearchRead; children: ReactNode }) {
  const params = useSearchParams();
  const source = params.get("ai-history") === "fixture" ? "fixture" : "live";
  const [mode, setMode] = useState<HistoryMode>(DEFAULT_HISTORY_MODE);
  const [liveCatalog, setLiveCatalog] = useState<CatalogState>({ phase: "loading" });
  const [selected, setSelected] = useState<SelectedState>({ phase: "idle" });
  const [remoteTrend, setRemoteTrend] = useState<{ key: string; trend: TrendLoad }>({
    key: "",
    trend: { phase: "idle" },
  });
  const fixtureRuns = useMemo(() => historyFixtureSummaries(), []);
  const catalog = useMemo<CatalogState>(
    () => (source === "fixture" ? { phase: "ready", runs: fixtureRuns } : liveCatalog),
    [fixtureRuns, liveCatalog, source],
  );
  const publishedDay =
    current.phase === "ready" ? utcDay(current.snapshot.run.published_at ?? current.snapshot.run.completed_at) : null;
  const publishedRunId = current.phase === "ready" ? current.snapshot.run.audit_run_id : null;
  // The published run's day arrives with its row, before its calls do, so the window starts early.
  const [earlyDay, setEarlyDay] = useState<string | null>(null);
  const liveEnd = publishedDay ?? (current.phase === "loading" ? earlyDay : null);
  const windowEnd = source === "fixture" ? latestPublishedDay(fixtureRuns) : liveEnd;

  useEffect(() => {
    if (source === "fixture") return;
    let cancelled = false;
    void loadPublishedRunRow(getCanvasSupabase() as never).then((run) => {
      if (!cancelled && run) setEarlyDay(utcDay(run.published_at ?? run.completed_at));
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source === "fixture") return;
    let cancelled = false;
    void loadHistoryCatalog(getCanvasSupabase() as never).then((result) => {
      if (!cancelled) setLiveCatalog(result);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const viewMonth = useCallback(() => {
    setMode({ kind: "month" });
    setSelected({ phase: "idle" });
  }, []);

  const viewRun = useCallback((runId: string) => {
    setMode({ kind: "run", runId });
    if (source === "fixture") {
      const snapshot = historyFixtureSnapshot(runId);
      setSelected(
        snapshot
          ? { phase: "ready", snapshot }
          : { phase: "unavailable", message: "That sample run has no stored calls, so no rate is shown." },
      );
      return;
    }
    setSelected({ phase: "loading" });
    const client = getCanvasSupabase();
    void afterSiteTypes(client, () => loadHistorySnapshot(client as never, runId)).then(setSelected);
  }, [source]);

  const viewPublished = useCallback(() => {
    if (current.phase !== "ready") return;
    setMode({ kind: "run", runId: current.snapshot.run.audit_run_id });
    setSelected({ phase: "ready", snapshot: current.snapshot });
  }, [current]);

  const viewLegacy = useCallback((runId: string) => {
    setMode({ kind: "legacy", runId });
    setSelected({ phase: "idle" });
  }, []);

  const viewRange = useCallback((from: string, to: string) => {
    const [start, end] = from <= to ? [from, to] : [to, from];
    setMode({ kind: "range", from: start, to: end });
    setSelected({ phase: "idle" });
  }, []);

  const viewAll = useCallback(() => {
    setMode({ kind: "all" });
    setSelected({ phase: "idle" });
  }, []);

  const windowRuns = useMemo(
    () => (catalog.phase === "ready" ? runsInSelection(catalog.runs, mode, windowEnd) : []),
    [catalog, mode, windowEnd],
  );
  const trendKey = useMemo(() => {
    const range = mode.kind === "range" ? `${mode.from}:${mode.to}` : "";
    return `${source}:${mode.kind}:${range}:${windowEnd ?? ""}:${windowRuns.map((run) => run.audit_run_id).join(",")}`;
  }, [mode, windowEnd, source, windowRuns]);
  const localTrend = useMemo<TrendLoad | null>(() => {
    const trusted = windowRuns;
    if (!isWindowMode(mode)) return { phase: "idle" };
    if (mode.kind === "month" && !windowEnd && current.phase === "loading") return { phase: "loading" };
    if (catalog.phase === "loading") return { phase: "loading" };
    if (catalog.phase === "error") return { phase: "error", message: catalog.message };
    if (!readsWindowRemotely(source, trusted.length)) {
      const snapshots = trusted
        .map((run) => (source === "fixture" ? historyFixtureSnapshot(run.audit_run_id) : null))
        .filter((snapshot): snapshot is AiSearchSnapshot => snapshot != null);
      return { phase: "ready", snapshots };
    }
    return null;
  }, [catalog, current.phase, mode, windowEnd, source, windowRuns]);
  const trend = useMemo<TrendLoad>(() => {
    const loaded = localTrend ?? (remoteTrend.key === trendKey ? remoteTrend.trend : { phase: "loading" });
    if (mode.kind !== "month" || loaded.phase !== "ready") return loaded;
    return { phase: "ready", snapshots: clientWindowSnapshots(loaded.snapshots) };
  }, [localTrend, mode.kind, remoteTrend, trendKey]);

  useEffect(() => {
    if (localTrend || catalog.phase !== "ready") return;
    if (!isWindowMode(mode)) return;
    const key = trendKey;
    const trusted = [...windowRuns].sort(compareRuns);
    const stop = new AbortController();
    let cancelled = false;
    void (async () => {
      // The first run that fails names the failure; the runs still queued behind it stop.
      const first: { failed: Exclude<HistorySnapshotResult, { phase: "ready" }> | null } = { failed: null };
      const loaded = await Promise.all(
        trusted.map((run) =>
          // No answer text: a window holds thousands of calls, and an evidence drawer reads its answer on demand.
          afterSiteTypes(getCanvasSupabase(), () =>
            loadHistorySnapshot(getCanvasSupabase() as never, run.audit_run_id, { signal: stop.signal, withAnswers: false }),
          ).then((result) => {
            if (result.phase !== "ready" && !first.failed && !stop.signal.aborted) {
              first.failed = result;
              stop.abort();
            }
            return result;
          }),
        ),
      );
      if (cancelled) return;
      if (first.failed) {
        setRemoteTrend({ key, trend: first.failed });
        return;
      }
      const snapshots = loaded.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : []));
      setRemoteTrend({ key, trend: { phase: "ready", snapshots } });
    })();
    return () => {
      cancelled = true;
      stop.abort();
    };
  }, [catalog.phase, localTrend, mode, source, trendKey, windowRuns]);

  const selectedDay = useMemo(() => {
    if (catalog.phase !== "ready") return null;
    const runId = mode.kind === "run" || mode.kind === "legacy" ? mode.runId : null;
    if (!runId) return null;
    const run = catalog.runs.find((item) => item.audit_run_id === runId);
    return run ? utcDay(run.published_at ?? run.completed_at) : null;
  }, [catalog, mode]);

  const value = useMemo<AiHistoryValue>(
    () => ({
      source,
      mode,
      catalog,
      current,
      selected,
      trend,
      controlLabel: historyControlLabel(mode, windowEnd, selectedDay, publishedRunId),
      windowEnd,
      bounds: windowBounds(mode, windowEnd),
      windowRuns,
      viewMonth,
      viewRun,
      viewPublished,
      viewLegacy,
      viewRange,
      viewAll,
    }),
    [
      catalog,
      current,
      mode,
      windowEnd,
      publishedRunId,
      selected,
      selectedDay,
      source,
      trend,
      viewAll,
      viewMonth,
      viewLegacy,
      viewPublished,
      viewRange,
      viewRun,
      windowRuns,
    ],
  );

  return <AiHistoryContext.Provider value={value}>{children}</AiHistoryContext.Provider>;
}

export function useAiHistory(): AiHistoryValue {
  const value = useContext(AiHistoryContext);
  if (!value) throw new Error("AI Search history is unavailable outside the dashboard.");
  return value;
}

export function useAiHistoryOptional(): AiHistoryValue | null {
  return useContext(AiHistoryContext);
}

/** Panels read this. The map keeps the live published run passed beside the provider. */
export function useDisplayedAiSearch(current: AiSearchRead): AiSearchRead {
  const history = useAiHistory();
  return displayedAiRead(history.mode, history.selected, history.trend, current);
}
