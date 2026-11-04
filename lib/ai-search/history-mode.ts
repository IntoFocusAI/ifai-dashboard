import { formatDay } from "@/lib/ai-search/history-eligibility";
import { calendarMonthBounds, monthName } from "@/lib/ai-search/latest-month";

export type HistoryMode =
  | { kind: "month" }
  | { kind: "run"; runId: string }
  | { kind: "legacy"; runId: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "all" };

/** The window a history session opens on. A window the reader picked stays until they change it. */
export const DEFAULT_HISTORY_MODE: HistoryMode = { kind: "month" };

export const LATEST_MONTH_LABEL = "Latest month";

/** `monthDay` is any day in the latest month: the published run's day. */
export function historyControlLabel(
  mode: HistoryMode,
  monthDay: string | null,
  selectedDay: string | null,
  publishedRunId: string | null = null,
): string {
  if (mode.kind === "month") return monthName(monthDay) ?? LATEST_MONTH_LABEL;
  if (mode.kind === "all") return "All time";
  if (mode.kind === "range") return `${formatDay(mode.from)} to ${formatDay(mode.to)}`;
  if (mode.kind === "legacy") return selectedDay ? `Legacy run · ${formatDay(selectedDay)}` : "Legacy run";
  if (mode.kind === "run" && mode.runId === publishedRunId) {
    const day = selectedDay ?? monthDay;
    return day ? `Published run · ${formatDay(day)}` : "Published run";
  }
  return selectedDay ? `Historical run · ${formatDay(selectedDay)}` : "Historical run";
}

export function rangeFromMode(mode: HistoryMode): { from: string | null; to: string | null } {
  if (mode.kind === "range") return { from: mode.from, to: mode.to };
  return { from: null, to: null };
}

/** Inclusive days the window covers. All time and single runs have no bounds. */
export function windowBounds(mode: HistoryMode, monthDay: string | null): { from: string | null; to: string | null } {
  if (mode.kind === "month") {
    const bounds = calendarMonthBounds(monthDay);
    return bounds ?? { from: null, to: null };
  }
  return rangeFromMode(mode);
}

/**
 * Panel introduction while history is open. Null keeps the normal area description.
 * Month, range, all, and a loaded single run stay null: the pill already names the selection.
 * The map is not given this string.
 */
export function historySpokeDescription(input: {
  mode: HistoryMode["kind"];
  source: "live" | "fixture";
  selectedPhase: "idle" | "loading" | "ready" | "unavailable" | "error";
  selectedMessage: string | null;
  runDescription: string | null;
}): string | null {
  if (input.mode === "month" || input.mode === "range" || input.mode === "all") {
    return null;
  }
  if (input.mode === "legacy") {
    return "Legacy test run. These calls stay out of the two rates and out of the trend.";
  }
  if (input.selectedPhase === "loading" || input.selectedPhase === "idle") return "Loading the selected run.";
  if (input.selectedPhase === "error") return "The selected run did not load.";
  if (input.selectedPhase === "unavailable") return input.selectedMessage;
  return null;
}
