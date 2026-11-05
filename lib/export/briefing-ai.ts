import { displayedAiRead } from "@/lib/ai-search/displayed-read";
import { clientWindowSnapshots, defaultWindowLabel, defaultWindowRuns } from "@/lib/ai-search/default-window";
import { compareRuns, utcDay } from "@/lib/ai-search/history-eligibility";
import { DEFAULT_HISTORY_MODE } from "@/lib/ai-search/history-mode";
import {
  loadHistoryCatalog,
  loadHistorySnapshot,
  type HistorySnapshotResult,
} from "@/lib/ai-search/history-queries";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export type BriefingAi = {
  read: AiSearchRead;
  /** Screen label for the default window, when that window is the Unbranded discovery read. */
  windowLabel: string | null;
};

/**
 * The AI Search read Summary Briefing shows: the last 30 days of published review runs,
 * pooled the same way the dashboard pools them. The published run alone is the fallback
 * only when that run itself has not loaded.
 */
export async function loadBriefingAi(current: AiSearchRead): Promise<BriefingAi> {
  if (current.phase !== "ready") return { read: current, windowLabel: null };
  const windowEnd = utcDay(current.snapshot.run.published_at ?? current.snapshot.run.completed_at);
  const windowLabel = defaultWindowLabel(windowEnd);
  let catalog: Awaited<ReturnType<typeof loadHistoryCatalog>>;
  try {
    catalog = await loadHistoryCatalog(getCanvasSupabase() as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      read: displayedAiRead(DEFAULT_HISTORY_MODE, { phase: "idle" }, { phase: "error", message }, current),
      windowLabel: null,
    };
  }
  if (catalog.phase !== "ready") {
    return {
      read: displayedAiRead(
        DEFAULT_HISTORY_MODE,
        { phase: "idle" },
        { phase: "error", message: catalog.message },
        current,
      ),
      windowLabel: null,
    };
  }

  const included = [...defaultWindowRuns(catalog.runs, windowEnd).included].sort(compareRuns);
  const stop = new AbortController();
  let failed: Exclude<HistorySnapshotResult, { phase: "ready" }> | null = null;
  const loaded = await Promise.all(
    included.map((run) =>
      loadHistorySnapshot(getCanvasSupabase() as never, run.audit_run_id, { signal: stop.signal }).then((result) => {
        if (result.phase !== "ready" && !failed && !stop.signal.aborted) {
          failed = result;
          stop.abort();
        }
        return result;
      }),
    ),
  );
  if (failed) {
    const trend =
      failed.phase === "unavailable"
        ? { phase: "unavailable" as const, message: failed.message }
        : { phase: "error" as const, message: failed.message };
    return {
      read: displayedAiRead(DEFAULT_HISTORY_MODE, { phase: "idle" }, trend, current),
      windowLabel: null,
    };
  }
  const snapshots = clientWindowSnapshots(
    loaded.flatMap((result) => (result.phase === "ready" ? [result.snapshot] : [])),
  );
  return {
    read: displayedAiRead(DEFAULT_HISTORY_MODE, { phase: "idle" }, { phase: "ready", snapshots }, current),
    windowLabel,
  };
}
