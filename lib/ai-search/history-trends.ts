import type { HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { compareRuns, utcDay } from "@/lib/ai-search/history-eligibility";
import { batteryGaps } from "@/lib/ai-search/prompt-battery";
import { questionRole, roleTally, type HeadlineRole } from "@/lib/ai-search/question-role";
import { queryVersionKey } from "@/lib/ai-search/query-version";
import { isReviewHistoryRun, scoringMethodFor, type ScoringMethod } from "@/lib/ai-search/review-runs";
import { callOutcome, engineLabel, isSmallSample } from "@/lib/ai-search/run-metrics";
import { formatObservedRate, SMALL_SAMPLE_LABEL } from "@/lib/ai-search/summary";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";

export type TrendMetric = HeadlineRole;
export type TrendBreakdown = "overall" | "engine";

export type QueryChoice =
  | { kind: "all" }
  | { kind: "version"; versionKey: string; promptKey: string; promptText: string }
  | { kind: "lineage"; promptKey: string };

export type QuestionVersion = {
  versionKey: string;
  promptKey: string;
  promptText: string;
  promptKind: string | null;
  role: ReturnType<typeof questionRole>;
};

export type TrendPoint = {
  runId: string;
  day: string;
  promptSetHash: string;
  engine: string | null;
  wins: number;
  resolved: number;
  unresolved: number;
  errors: number;
  winPct: number | null;
  smallSample: boolean;
  /** False when the run returned no call rows. The point is not plotted as zero. */
  callsLoaded: boolean;
  partial: boolean;
  /** Question-engine pairs that were not stored. They are not wins, losses, or zeros. */
  notStored: number;
  scoringMethod: ScoringMethod | null;
};

export type TrendBoundary = {
  afterRunId: string;
  beforeRunId: string;
  afterDay: string;
  beforeDay: string;
  promptSetChanged: boolean;
  queryVersionChanged: boolean;
  /** Visible marker. The line may still connect the two scoring methods. */
  scoringMethodChanged: boolean;
  /** A run that fits this view sits between the two runs, so they are not adjacent. */
  gap: boolean;
  beforeQuestions: QuestionVersion[];
  afterQuestions: QuestionVersion[];
};

export type TrendSeries = {
  key: string;
  label: string;
  points: TrendPoint[];
};

export type TrendModel = {
  status: "loading" | "unavailable" | "empty" | "one-run" | "ready";
  message: string | null;
  series: TrendSeries[];
  boundaries: TrendBoundary[];
  /** Run ids that were eligible to plot, in time order. */
  runIds: string[];
};

export const ONE_RUN_TREND_MESSAGE = "Trend begins after the next comparable published run.";

const EMPTY_RANGE = "No review run falls in this range.";
const NONE_YET = "No review run is available for a trend yet.";

/**
 * Fact checks are one question per key: a rotating key asks about a different catalog
 * product in each repeat, so its wording is not a new question.
 */
function questionVersionKey(call: Pick<AiCallRow, "prompt_key" | "prompt" | "prompt_kind">): string {
  return queryVersionKey(call.prompt_key, call.prompt_kind === "probe" ? null : call.prompt);
}

export function questionsInRun(calls: readonly AiCallRow[]): QuestionVersion[] {
  const seen = new Map<string, QuestionVersion>();
  for (const call of calls) {
    if (call.prompt_kind !== "commercial" && call.prompt_kind !== "probe") continue;
    const versionKey = questionVersionKey(call);
    if (seen.has(versionKey)) continue;
    seen.set(versionKey, {
      versionKey,
      promptKey: call.prompt_key ?? "",
      promptText: call.prompt ?? "",
      promptKind: call.prompt_kind,
      role: questionRole(call),
    });
  }
  return [...seen.values()].sort((a, b) => a.promptKey.localeCompare(b.promptKey) || a.versionKey.localeCompare(b.versionKey));
}

export function callsForRun(snapshot: AiSearchSnapshot): AiCallRow[] {
  return snapshot.calls.filter((call) => call.audit_run_id === snapshot.run.audit_run_id);
}

function dayOf(snapshot: AiSearchSnapshot): string | null {
  return utcDay(snapshot.run.published_at ?? snapshot.run.completed_at);
}

function inRange(day: string, from: string | null, to: string | null): boolean {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function versionOnRun(calls: readonly AiCallRow[], promptKey: string): string | null {
  const keys = new Set(
    calls.filter((call) => call.prompt_key === promptKey).map((call) => queryVersionKey(call.prompt_key, call.prompt)),
  );
  if (keys.size !== 1) return null;
  return [...keys][0];
}

function runMatchesQuery(calls: readonly AiCallRow[], query: QueryChoice): boolean {
  if (query.kind === "all") return true;
  if (query.kind === "version") {
    return calls.some((call) => queryVersionKey(call.prompt_key, call.prompt) === query.versionKey);
  }
  const versions = new Set(
    calls.filter((call) => call.prompt_key === query.promptKey).map((call) => queryVersionKey(call.prompt_key, call.prompt)),
  );
  return versions.size === 1;
}

function metricCalls(calls: readonly AiCallRow[], metric: TrendMetric, engine: string | null, query: QueryChoice): AiCallRow[] {
  return calls.filter((call) => {
    if (questionRole(call) !== metric) return false;
    if (engine && (call.engine ?? "").toLowerCase() !== engine) return false;
    if (query.kind === "version" && queryVersionKey(call.prompt_key, call.prompt) !== query.versionKey) return false;
    if (query.kind === "lineage" && call.prompt_key !== query.promptKey) return false;
    return true;
  });
}

function scopedGaps(calls: readonly AiCallRow[], metric: TrendMetric, engine: string | null, query: QueryChoice): number {
  return batteryGaps(calls).filter((gap) => {
    if (questionRole({ prompt_kind: gap.promptKind, prompt: gap.promptText }) !== metric) return false;
    if (engine && gap.engine !== engine) return false;
    if (query.kind === "version" && gap.promptKey !== query.promptKey) return false;
    if (query.kind === "lineage" && gap.promptKey !== query.promptKey) return false;
    return true;
  }).length;
}

function pointFor(
  snapshot: AiSearchSnapshot,
  calls: readonly AiCallRow[],
  metric: TrendMetric,
  engine: string | null,
  query: QueryChoice,
): TrendPoint {
  const day = dayOf(snapshot) ?? "";
  const scoped = metricCalls(calls, metric, engine, query);
  const tally = roleTally(scoped, metric);
  const notStored = scopedGaps(calls, metric, engine, query);
  const pureGap = notStored > 0 && tally.resolved === 0 && tally.unresolved === 0 && tally.errors === 0;
  return {
    runId: snapshot.run.audit_run_id,
    day,
    promptSetHash: snapshot.run.prompt_set_hash ?? "",
    engine,
    wins: tally.fenderWins,
    resolved: tally.resolved,
    unresolved: tally.unresolved,
    errors: tally.errors,
    winPct: calls.length === 0 || pureGap ? null : tally.winPct,
    smallSample: false,
    callsLoaded: calls.length > 0,
    partial: snapshot.run.run_state === "partial",
    notStored,
    scoringMethod: scoringMethodFor(snapshot.run),
  };
}

function withSample(points: TrendPoint[]): TrendPoint[] {
  const largest = Math.max(0, ...points.map((point) => point.resolved));
  return points.map((point) => ({
    ...point,
    smallSample: point.callsLoaded && point.resolved > 0 && isSmallSample(point.resolved, largest),
  }));
}

export function rateLabel(
  point: Pick<TrendPoint, "wins" | "resolved" | "smallSample" | "callsLoaded" | "winPct"> & {
    notStored?: number;
    unresolved?: number;
    errors?: number;
  },
): string {
  if (!point.callsLoaded) return "Calls not available";
  const notStored = point.notStored ?? 0;
  const unresolved = point.unresolved ?? 0;
  const errors = point.errors ?? 0;
  if (notStored > 0 && point.resolved === 0 && point.wins === 0 && unresolved === 0 && errors === 0) return "Not stored";
  const figure = formatObservedRate(point.wins, point.resolved);
  if (figure == null) return "No resolved answers";
  const labeled = figure.replace(/\)$/, " resolved)");
  return point.smallSample ? `${labeled} ${SMALL_SAMPLE_LABEL}` : labeled;
}

export function coverageLabel(point: Pick<TrendPoint, "unresolved" | "errors" | "callsLoaded"> & { notStored?: number }): string {
  if (!point.callsLoaded) return "Not available";
  const parts: string[] = [];
  if ((point.notStored ?? 0) > 0) parts.push(`${point.notStored} not stored`);
  if (point.unresolved > 0) parts.push(`${point.unresolved} unresolved`);
  if (point.errors > 0) parts.push(`${point.errors} provider ${point.errors === 1 ? "error" : "errors"}`);
  return parts.length ? parts.join(", ") : "None";
}

function enginesIn(snapshots: readonly AiSearchSnapshot[]): string[] {
  const engines = new Set<string>();
  for (const snapshot of snapshots) {
    for (const call of callsForRun(snapshot)) {
      if (call.prompt_kind !== "commercial") continue;
      engines.add((call.engine ?? "").toLowerCase());
    }
  }
  return [...engines].sort((a, b) => engineLabel(a).localeCompare(engineLabel(b)));
}

/**
 * Which questions a question-set check compares. A shopping rate counts only shopping-question
 * changes; a fact-check swap does not mark it (agreed 12 Nov 2026). A fact-check figure checks its
 * own questions, and a figure over every answer checks both.
 */
export type QuestionSetKind = "commercial" | "probe" | "all";

function questionIdentity(calls: readonly AiCallRow[], kind: QuestionSetKind = "all"): string {
  return questionsInRun(calls)
    .filter((question) => kind === "all" || question.promptKind === kind)
    .map((question) => question.versionKey)
    .sort()
    .join("\n");
}

function adjacentBreak(
  previous: AiSearchSnapshot,
  next: AiSearchSnapshot,
  orderedIds: readonly string[],
  query: QueryChoice,
  kind: QuestionSetKind = "all",
): { promptSetChanged: boolean; queryVersionChanged: boolean; gap: boolean } {
  const previousIndex = orderedIds.indexOf(previous.run.audit_run_id);
  const nextIndex = orderedIds.indexOf(next.run.audit_run_id);
  const gap = nextIndex - previousIndex > 1;
  const previousCalls = callsForRun(previous);
  const nextCalls = callsForRun(next);
  const previousHash = previous.run.prompt_set_hash ?? "";
  const nextHash = next.run.prompt_set_hash ?? "";
  const callsLoaded = previousCalls.length > 0 && nextCalls.length > 0;
  // Matching stored wording is the same question set, even when an older run
  // never recorded a prompt-set hash. A future wording change still breaks.
  const promptSetChanged = callsLoaded
    ? questionIdentity(previousCalls, kind) !== questionIdentity(nextCalls, kind)
    : previousHash !== nextHash && previousHash !== "" && nextHash !== "";
  let queryVersionChanged = false;
  if (query.kind === "lineage") {
    const before = versionOnRun(previousCalls, query.promptKey);
    const after = versionOnRun(nextCalls, query.promptKey);
    queryVersionChanged = before != null && after != null && before !== after;
  }
  return { promptSetChanged, queryVersionChanged, gap };
}

export function buildHistoryTrend(input: {
  snapshots: readonly AiSearchSnapshot[];
  metric: TrendMetric;
  breakdown: TrendBreakdown;
  fromDay: string | null;
  toDay: string | null;
  query: QueryChoice;
}): TrendModel {
  const trusted = input.snapshots
    .filter((snapshot) => isReviewHistoryRun(snapshot.run as HistoryRunSummary))
    .map((snapshot) => ({ ...snapshot, calls: callsForRun(snapshot) }))
    .filter((snapshot) => {
      const day = dayOf(snapshot);
      return day != null && inRange(day, input.fromDay, input.toDay);
    })
    .sort((a, b) => compareRuns(a.run as HistoryRunSummary, b.run as HistoryRunSummary));

  const matching = trusted.filter((snapshot) => runMatchesQuery(snapshot.calls, input.query));
  const runIds = matching.map((snapshot) => snapshot.run.audit_run_id);
  if (matching.length === 0) {
    return { status: "empty", message: input.fromDay || input.toDay ? EMPTY_RANGE : NONE_YET, series: [], boundaries: [], runIds };
  }
  if (matching.length === 1) {
    return { status: "one-run", message: ONE_RUN_TREND_MESSAGE, series: [], boundaries: [], runIds };
  }

  const orderedIds = trusted.map((snapshot) => snapshot.run.audit_run_id);
  const boundaries: TrendBoundary[] = [];
  const breakAfter = new Set<string>();
  for (let index = 1; index < matching.length; index += 1) {
    const before = matching[index - 1];
    const after = matching[index];
    const change = adjacentBreak(before, after, orderedIds, input.query);
    const beforeMethod = scoringMethodFor(before.run);
    const afterMethod = scoringMethodFor(after.run);
    const scoringMethodChanged = beforeMethod != null && afterMethod != null && beforeMethod !== afterMethod;
    if (!change.promptSetChanged && !change.queryVersionChanged && !change.gap && !scoringMethodChanged) continue;
    if (change.promptSetChanged || change.queryVersionChanged || change.gap) breakAfter.add(before.run.audit_run_id);
    boundaries.push({
      afterRunId: before.run.audit_run_id,
      beforeRunId: after.run.audit_run_id,
      afterDay: dayOf(before) ?? "",
      beforeDay: dayOf(after) ?? "",
      promptSetChanged: change.promptSetChanged,
      queryVersionChanged: change.queryVersionChanged,
      scoringMethodChanged,
      gap: change.gap,
      beforeQuestions: questionsInRun(before.calls),
      afterQuestions: questionsInRun(after.calls),
    });
  }

  const groups: Array<{ key: string; label: string; engine: string | null }> =
    input.breakdown === "overall"
      ? [{ key: "overall", label: "Overall", engine: null }]
      : enginesIn(matching).map((engine) => ({ key: engine, label: engineLabel(engine), engine }));

  const series = groups.map((group) => ({
    key: group.key,
    label: group.label,
    points: withSample(matching.map((snapshot) => pointFor(snapshot, snapshot.calls, input.metric, group.engine, input.query))),
    breakAfter,
  }));

  return {
    status: "ready",
    message: null,
    series: series.map(({ key, label, points }) => ({ key, label, points })),
    boundaries,
    runIds,
  };
}

/** Straight segments only. A boundary, a gap, or a missing rate ends the segment. */
export function trendSegments(points: readonly TrendPoint[], breakAfter: ReadonlySet<string>): TrendPoint[][] {
  const segments: TrendPoint[][] = [];
  let current: TrendPoint[] = [];
  for (const point of points) {
    const plottable = point.callsLoaded && point.winPct != null;
    if (!plottable) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push(point);
    if (breakAfter.has(point.runId)) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

/** Question-set and wording breaks end a line. A scoring-method marker does not. */
export function boundaryBreaks(boundaries: readonly TrendBoundary[]): Set<string> {
  return new Set(
    boundaries
      .filter((boundary) => boundary.promptSetChanged || boundary.queryVersionChanged)
      .map((boundary) => boundary.afterRunId),
  );
}

export function callsBehindPoint(
  snapshot: AiSearchSnapshot,
  point: TrendPoint,
  metric: TrendMetric,
  query: QueryChoice,
): { inRate: AiCallRow[]; outside: AiCallRow[] } {
  const scoped = metricCalls(callsForRun(snapshot), metric, point.engine, query);
  const inRate: AiCallRow[] = [];
  const outside: AiCallRow[] = [];
  for (const call of scoped) {
    const outcome = callOutcome(call);
    if (outcome === "fender_win" || outcome === "fender_win_disqualified" || outcome === "competitor_win") inRate.push(call);
    else if (outcome === "unresolved" || outcome === "error") outside.push(call);
  }
  return { inRate, outside };
}

export function queryChoices(snapshots: readonly AiSearchSnapshot[], metric: TrendMetric): QueryChoice[] {
  const versions = new Map<string, { promptKey: string; promptText: string }>();
  const lineages = new Set<string>();
  for (const snapshot of snapshots) {
    if (!isReviewHistoryRun(snapshot.run as HistoryRunSummary)) continue;
    for (const call of callsForRun(snapshot)) {
      if (questionRole(call) !== metric) continue;
      const promptKey = call.prompt_key ?? "";
      const versionKey = queryVersionKey(call.prompt_key, call.prompt);
      versions.set(versionKey, { promptKey, promptText: call.prompt ?? "" });
      lineages.add(promptKey);
    }
  }
  const choices: QueryChoice[] = [{ kind: "all" }];
  for (const promptKey of [...lineages].sort()) {
    const wordings = [...versions.entries()].filter(([, value]) => value.promptKey === promptKey);
    if (wordings.length > 1) choices.push({ kind: "lineage", promptKey });
    for (const [versionKey, value] of wordings.sort((a, b) => a[1].promptText.localeCompare(b[1].promptText))) {
      choices.push({ kind: "version", versionKey, promptKey: value.promptKey, promptText: value.promptText });
    }
  }
  return choices;
}

export function boundaryLabel(boundary: TrendBoundary): string {
  if (boundary.scoringMethodChanged && !boundary.promptSetChanged && !boundary.queryVersionChanged) {
    return "Scoring method changed";
  }
  if (boundary.promptSetChanged && boundary.queryVersionChanged) {
    return "Question set changed. The exact question wording also changed.";
  }
  if (boundary.queryVersionChanged) return "Question wording changed";
  if (boundary.promptSetChanged) return "Question set changed";
  return "No run with this exact question between these dates";
}

function shortDay(day: string, withYear: boolean): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/**
 * Plain words for a dashed line on the trend chart: what changed, between which two dates.
 * afterDay is the earlier run and beforeDay the later one (the field names read the other way).
 */
export function boundaryReason(boundary: TrendBoundary): string {
  const withYear = boundary.afterDay.slice(0, 4) !== boundary.beforeDay.slice(0, 4);
  const between = `between ${shortDay(boundary.afterDay, withYear)} and ${shortDay(boundary.beforeDay, withYear)}`;
  const reasons: string[] = [];
  if (boundary.promptSetChanged) reasons.push(`The question set changed ${between}.`);
  if (boundary.queryVersionChanged) reasons.push(`A question's wording changed ${between}.`);
  if (boundary.scoringMethodChanged) reasons.push(`The scoring method changed ${between}.`);
  if (boundary.gap) reasons.push(`There is a gap in the stored runs ${between}.`);
  if (reasons.length === 0) reasons.push(`The runs ${between} differ.`);
  return `${reasons.join(" ")} Runs on either side are not directly comparable.`;
}

/**
 * The day the question set changed inside a window of review runs (the later run's day), or null
 * when one question set covers the whole window. The trend's boundary rule decides it, so a
 * headline rate and the trend line break on the same run. The latest change wins. `kind` names
 * the questions the figure counts: a shopping rate (the default) ignores fact-check swaps.
 */
export function windowQuestionSetChange(
  snapshots: readonly AiSearchSnapshot[],
  kind: QuestionSetKind = "commercial",
): string | null {
  const runs = snapshots
    .filter((snapshot) => isReviewHistoryRun(snapshot.run as HistoryRunSummary))
    .sort((a, b) => compareRuns(a.run as HistoryRunSummary, b.run as HistoryRunSummary));
  const ids = runs.map((snapshot) => snapshot.run.audit_run_id);
  let changed: string | null = null;
  for (let index = 1; index < runs.length; index += 1) {
    if (adjacentBreak(runs[index - 1], runs[index], ids, { kind: "all" }, kind).promptSetChanged) {
      changed = dayOf(runs[index]) ?? changed;
    }
  }
  return changed;
}
