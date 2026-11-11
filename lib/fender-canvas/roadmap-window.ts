/**
 * The two 30-day windows the 21d focus items read (Brian, 11 Nov 2026). The current window is the
 * last 30 days ending on the published run's day, the window the AI Search tabs open on. The
 * previous window is the 30 days before it. Each pools its published review runs with the counted
 * API runs dated in it, as the map reads a run (decision 7).
 */

import { addUtcDays, poolWindowSnapshots } from "@/lib/ai-search/citation-aggregate";
import { clientWindowSnapshots, defaultWindowRuns, runDay } from "@/lib/ai-search/default-window";
import { withApiSnapshots } from "@/lib/ai-search/engine-group";
import type { HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { engineCounts, questionCounts } from "@/lib/fender-canvas/roadmap-focus";

/** Days in each window. */
export const FOCUS_WINDOW_DAYS = 30;

/** The last day of the window before the one ending on `end`. */
export function previousWindowEnd(end: string | null): string | null {
  return end ? addUtcDays(end, -FOCUS_WINDOW_DAYS) : null;
}

/** Published review runs counted in each window, oldest first. */
export function focusWindowRuns(
  runs: readonly HistoryRunSummary[],
  end: string | null,
): { current: HistoryRunSummary[]; previous: HistoryRunSummary[] } {
  return {
    current: defaultWindowRuns(runs, end).included,
    previous: defaultWindowRuns(runs, previousWindowEnd(end)).included,
  };
}

/** One window: its battery runs pooled, with its API runs' API-engine calls added. */
export function poolFocusWindow(
  battery: readonly AiSearchSnapshot[],
  api: readonly AiSearchSnapshot[],
): AiSearchSnapshot | null {
  const pooled = poolWindowSnapshots(clientWindowSnapshots(battery));
  return pooled ? withApiSnapshots(pooled, api) : null;
}

export type WindowRunCount = {
  id: string;
  day: string | null;
  source: "battery" | "api";
  /** Resolved unbranded discovery answers the run adds, and the questions it answered. */
  resolved: number;
  questions: number;
};

export type WindowSummary = {
  engines: Array<{ key: string; resolved: number }>;
  questions: Array<{ question: string; resolved: number }>;
  runs: WindowRunCount[];
};

function runCount(snapshot: AiSearchSnapshot, source: "battery" | "api"): WindowRunCount {
  const scoped = source === "api" ? withApiSnapshots({ ...snapshot, calls: [], citations: [], probes: [] }, [snapshot]) : snapshot;
  const questions = questionCounts(scoped);
  return {
    id: snapshot.run.audit_run_id,
    day: runDay(snapshot.run),
    source,
    resolved: questions.reduce((sum, entry) => sum + entry.tally.resolved, 0),
    questions: questions.length,
  };
}

/** Answer counts behind the window's figures, per engine, question, and run. */
export function windowSummary(
  pooled: AiSearchSnapshot | null,
  battery: readonly AiSearchSnapshot[],
  api: readonly AiSearchSnapshot[],
): WindowSummary {
  return {
    engines: pooled ? engineCounts(pooled).map((engine) => ({ key: engine.key, resolved: engine.tally.resolved })) : [],
    questions: pooled
      ? questionCounts(pooled)
          .map((entry) => ({ question: entry.question, resolved: entry.tally.resolved }))
          .sort((a, b) => a.resolved - b.resolved || a.question.localeCompare(b.question))
      : [],
    runs: [
      ...clientWindowSnapshots(battery).map((snapshot) => runCount(snapshot, "battery")),
      ...api.map((snapshot) => runCount(snapshot, "api")),
    ],
  };
}
