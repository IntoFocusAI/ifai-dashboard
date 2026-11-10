import { defaultWindowRuns } from "@/lib/ai-search/default-window";
import { choiceLabel, type EngineGroupChoice } from "@/lib/ai-search/engine-group";
import { utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { historyControlLabel, rangeFromMode, type HistoryMode } from "@/lib/ai-search/history-mode";
import { isReviewHistoryRun } from "@/lib/ai-search/review-runs";

/**
 * The selection an AI Search tab is showing: the shared date pill's choice and the engine switch.
 * The browser sends it with a Download CSV request, and the server reads the same runs with it,
 * so a download follows the pill exactly as the screen does (X-10).
 */
export type AiSelectionScope = {
  mode: Exclude<HistoryMode, { kind: "legacy" }>;
  /** Last day of the default window: the published run's day. Only read for the last 30 days. */
  windowEnd: string | null;
  engines: EngineGroupChoice;
};

/** The battery runs a window adds. A single run and a legacy run add none. */
export function runsInSelection(
  runs: readonly HistoryRunSummary[],
  mode: HistoryMode,
  windowEnd: string | null,
): HistoryRunSummary[] {
  if (mode.kind === "month") return defaultWindowRuns(runs, windowEnd).included;
  if (mode.kind === "run" || mode.kind === "legacy") return [];
  const { from, to } = rangeFromMode(mode);
  return runs.filter(isReviewHistoryRun).filter((run) => {
    const day = utcDay(run.published_at ?? run.completed_at);
    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RUN_ID = /^[0-9a-f-]{8,64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMode(value: unknown): AiSelectionScope["mode"] | null {
  if (!isRecord(value)) return null;
  if (value.kind === "month") return { kind: "month" };
  if (value.kind === "all") return { kind: "all" };
  if (value.kind === "run") {
    return typeof value.runId === "string" && RUN_ID.test(value.runId) ? { kind: "run", runId: value.runId } : null;
  }
  if (value.kind === "range") {
    const { from, to } = value;
    if (typeof from !== "string" || typeof to !== "string" || !DAY.test(from) || !DAY.test(to)) return null;
    return from <= to ? { kind: "range", from, to } : { kind: "range", from: to, to: from };
  }
  return null;
}

/** Reads the selection out of a download request. Anything malformed is null: no guess is made. */
export function parseAiSelectionScope(value: unknown): AiSelectionScope | null {
  if (!isRecord(value)) return null;
  const mode = parseMode(value.mode);
  if (!mode) return null;
  const engines = value.engines === "search" || value.engines === "api" || value.engines === "all" ? value.engines : null;
  if (!engines) return null;
  const windowEnd = typeof value.windowEnd === "string" && DAY.test(value.windowEnd) ? value.windowEnd : null;
  return { mode, windowEnd, engines };
}

/** "Last 30 days · Oct 10 to Nov 8, 2026. Engines: All." for the Filter line of a download. */
export function selectionFilterLabel(input: {
  pillLabel: string;
  engines: EngineGroupChoice;
  /** False when the engine switch reads Not available*, so every figure is the search engines'. */
  enginesReady: boolean;
}): string {
  const engines = input.enginesReady ? choiceLabel(input.engines) : "Search engines (API engines not available)";
  return `${input.pillLabel}. Engines: ${engines}`;
}

/** The pill's own words for a selection, as the server names it. */
export function selectionPillLabel(scope: AiSelectionScope, selectedDay: string | null, publishedRunId: string | null): string {
  return historyControlLabel(scope.mode, scope.windowEnd, selectedDay, publishedRunId);
}
