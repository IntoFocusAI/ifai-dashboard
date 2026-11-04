import { poolWindowSnapshots } from "@/lib/ai-search/citation-aggregate";
import type { HistoryMode } from "@/lib/ai-search/history-mode";
import { poolProbeCoverage } from "@/lib/ai-search/probe-catalog";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";

type Pending =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "unavailable"; message: string }
  | { phase: "error"; message: string };

export const EMPTY_SELECTION_MESSAGE = "No stored review runs in this selection have calls.";

/** "selected run" for one historical run, else "selected period". */
export function selectionSubject(single: boolean): string {
  return single ? "selected run" : "selected period";
}

/** Names what failed. The database error stays in a tooltip, never in this line. */
export function selectionLine(selection: "failed" | "empty", single: boolean): string {
  const what = selectionSubject(single);
  return selection === "empty" ? `The ${what} has no stored calls` : `The ${what} did not load`;
}

/**
 * What the AI Search panels show for the history selection. A failed or empty selection is
 * marked as the selection's, so the panels never report it as the published run failing.
 */
export function displayedAiRead(
  mode: HistoryMode,
  selected: Pending | { phase: "ready"; snapshot: AiSearchSnapshot },
  trend: Pending | { phase: "ready"; snapshots: AiSearchSnapshot[] },
  current: AiSearchRead,
): AiSearchRead {
  if (mode.kind === "legacy") return current;
  if (mode.kind === "run") {
    if (selected.phase === "loading" || selected.phase === "idle") return { phase: "loading" };
    if (selected.phase === "unavailable") return current;
    if (selected.phase === "error") return { phase: "error", message: selected.message, selection: "failed" };
    return { phase: "ready", snapshot: selected.snapshot };
  }
  // The latest month is the published run's month, so its own failure is the one to name.
  if (mode.kind === "month" && current.phase !== "ready") return current;
  if (trend.phase === "idle" || trend.phase === "loading") return { phase: "loading" };
  if (trend.phase === "error" || trend.phase === "unavailable") {
    return { phase: "error", message: trend.message, selection: "failed" };
  }
  const pooled = poolWindowSnapshots(trend.snapshots);
  if (!pooled) return { phase: "error", message: EMPTY_SELECTION_MESSAGE, selection: "empty" };
  const probeCoverage = poolProbeCoverage(trend.snapshots);
  return { phase: "ready", snapshot: probeCoverage === undefined ? pooled : { ...pooled, probeCoverage } };
}
