"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { citationMonthBounds } from "@/lib/ai-search/citation-aggregate";
import { displayedAiRead } from "@/lib/ai-search/displayed-read";
import { compareRuns, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { historyFixtureSnapshot, historyFixtureSummaries } from "@/lib/ai-search/history-fixtures";
import { historyControlLabel, rangeFromMode, type HistoryMode } from "@/lib/ai-search/history-mode";
import { loadHistoryCatalog, loadHistorySnapshot, type HistorySnapshotResult } from "@/lib/ai-search/history-queries";
import { isReviewHistoryRun } from "@/lib/ai-search/review-runs";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
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
  viewMonth: () => void;
  viewRun: (runId: string) => void;
  /** Shows the published run the map already read, without another database read. */
  viewPublished: () => void;
  viewLegacy: (runId: string) => void;
  viewRange: (from: string, to: string) => void;
  viewAll: () => void;
};

const AiHistoryContext = createContext<AiHistoryValue | null>(null);

function runsInScope(
  runs: readonly HistoryRunSummary[],
  mode: HistoryMode,
  publishedDay: string | null,
): HistoryRunSummary[] {
  if (mode.kind === "month") {
    if (!publishedDay) return [];
    const bounds = citationMonthBounds(publishedDay);
    if (!bounds) return [];
    return runs.filter(isReviewHistoryRun).filter((run) => {
      const day = utcDay(run.published_at ?? run.completed_at);
      if (!day) return false;
      return day >= bounds.from && day <= bounds.to;
    });
  }
  const { from, to } = rangeFromMode(mode);
  return runs.filter(isReviewHistoryRun).filter((run) => {
    const day = utcDay(run.published_at ?? run.completed_at);
    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

function isWindowMode(mode: HistoryMode): boolean {
  return mode.kind === "month" || mode.kind === "range" || mode.kind === "all";
}

export function AiHistoryProvider({ current, children }: { current: AiSearchRead; children: ReactNode }) {
  const params = useSearchParams();
  const source = params.get("ai-history") === "fixture" ? "fixture" : "live";
  const [mode, setMode] = useState<HistoryMode>({ kind: "month" });
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
    void loadHistorySnapshot(getCanvasSupabase() as never, runId).then(setSelected);
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

  const trendKey = useMemo(() => {
    const trusted = catalog.phase === "ready" ? runsInScope(catalog.runs, mode, publishedDay) : [];
    const range = mode.kind === "range" ? `${mode.from}:${mode.to}` : "";
    return `${source}:${mode.kind}:${range}:${publishedDay ?? ""}:${trusted.map((run) => run.audit_run_id).join(",")}`;
  }, [catalog, mode, publishedDay, source]);
  const localTrend = useMemo<TrendLoad | null>(() => {
    const trusted = catalog.phase === "ready" ? runsInScope(catalog.runs, mode, publishedDay) : [];
    if (!isWindowMode(mode)) return { phase: "idle" };
    if (mode.kind === "month" && !publishedDay && current.phase === "loading") return { phase: "loading" };
    if (catalog.phase === "loading") return { phase: "loading" };
    if (catalog.phase === "error") return { phase: "error", message: catalog.message };
    if (trusted.length < 2 || source === "fixture") {
      const snapshots = trusted
        .map((run) => (source === "fixture" ? historyFixtureSnapshot(run.audit_run_id) : null))
        .filter((snapshot): snapshot is AiSearchSnapshot => snapshot != null);
      return { phase: "ready", snapshots };
    }
    return null;
  }, [catalog, current.phase, mode, publishedDay, source]);
  const trend = useMemo<TrendLoad>(
    () => localTrend ?? (remoteTrend.key === trendKey ? remoteTrend.trend : { phase: "loading" }),
    [localTrend, remoteTrend, trendKey],
  );

  useEffect(() => {
    if (localTrend || catalog.phase !== "ready") return;
    if (!isWindowMode(mode)) return;
    const key = trendKey;
    const trusted = [...runsInScope(catalog.runs, mode, publishedDay)].sort(compareRuns);
    const stop = new AbortController();
    let cancelled = false;
    void (async () => {
      // The first run that fails names the failure; the runs still queued behind it stop.
      const first: { failed: Exclude<HistorySnapshotResult, { phase: "ready" }> | null } = { failed: null };
      const loaded = await Promise.all(
        trusted.map((run) =>
          loadHistorySnapshot(getCanvasSupabase() as never, run.audit_run_id, { signal: stop.signal }).then((result) => {
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
  }, [catalog, localTrend, mode, publishedDay, source, trendKey]);

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
      controlLabel: historyControlLabel(mode, publishedDay, selectedDay, publishedRunId),
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
      publishedDay,
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
