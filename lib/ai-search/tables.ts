import { citationCategoryLabel, snapshotInCategory } from "@/lib/ai-search/citation-top-sources";
import {
  SOURCE_CLASS_LABELS,
  citationEvidence,
  citedAnswers,
  groupCitations,
  type CitationEvidence,
  type CitationScope,
} from "@/lib/ai-search/citations";
import { PROBE_STATE_LABELS, driftRead, type ProbeEvidence } from "@/lib/ai-search/drift";
import {
  ACCURACY_LABELS,
  DEFAULT_FILTER,
  applyExplorerFilter,
  factCheckColumnLabel,
  sortExplorerRows,
  type ExplorerFilter,
} from "@/lib/ai-search/explorer-filter";
import { formatDay } from "@/lib/ai-search/history-eligibility";
import {
  buildHistoryTrend,
  callsBehindPoint,
  coverageLabel,
  rateLabel,
  type QueryChoice,
  type TrendBreakdown,
  type TrendMetric,
  type TrendPoint,
} from "@/lib/ai-search/history-trends";
import { catalogCoverage } from "@/lib/ai-search/probe-catalog";
import {
  ROLE_LABELS,
  categoryRoleTallies,
  engineResultRoleTallies,
  headlineAside,
  type HeadlineRole,
  type QuestionRole,
  type RoleGroupTally,
} from "@/lib/ai-search/question-role";
import { SCORING_LABELS } from "@/lib/ai-search/review-runs";
import {
  OUTCOME_LABELS,
  callOutcome,
  categoryLabel,
  cleanPrompt,
  engineLabel,
  formatRunTime,
  modelLabel,
} from "@/lib/ai-search/run-metrics";
import { formatObservedRate, roleRatePlainText } from "@/lib/ai-search/summary";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandName, brandOwned } from "@/lib/brand-copy";
import { formatInt } from "@/lib/fender-canvas/format";

/**
 * What each AI Search table shows, as plain rows: a key and one text cell per column.
 * The screen draws these rows with links and badges; Download CSV writes the same cells from
 * the same functions on the server (X-10), so a file never differs from the table it came from.
 */

export type AiTableRow = { key: string; cells: string[] };

export type AiTableBuild = {
  header: string[];
  rows: AiTableRow[];
  /** The order the table shows before a column header is clicked. */
  sort: string;
  /** The filter the tab's own controls apply, in plain words. Null when they apply none. */
  filter: string | null;
};

// ---- Run Summary: by engine and model, by commercial category

export const RUN_ENGINE_HEADER = [
  "Engine",
  "Model",
  ROLE_LABELS.unbranded_discovery,
  ROLE_LABELS.branded_consideration,
  "No leader",
  "Errors",
];

export const RUN_CATEGORY_HEADER = [
  "Category",
  ROLE_LABELS.unbranded_discovery,
  ROLE_LABELS.branded_consideration,
  "No leader",
  "Errors",
];

function largestResolved(groups: readonly RoleGroupTally[], role: HeadlineRole): number {
  return Math.max(0, ...groups.map((group) => group.roles[role].resolved));
}

/** "66.4% (10 of 20)", marked Small sample on a single run only, as RoleCount shows it. */
export function roleCellText(
  tally: { fenderWins: number; resolved: number },
  largest: number,
  showSmallSample: boolean,
): string {
  if (showSmallSample) return roleRatePlainText(tally.fenderWins, tally.resolved, largest);
  return formatObservedRate(tally.fenderWins, tally.resolved) ?? "No resolved answers";
}

function roleGroupCells(group: RoleGroupTally, label: string, groups: readonly RoleGroupTally[], single: boolean): string[] {
  const aside = headlineAside(group);
  return [
    label,
    roleCellText(group.roles.unbranded_discovery, largestResolved(groups, "unbranded_discovery"), single),
    roleCellText(group.roles.branded_consideration, largestResolved(groups, "branded_consideration"), single),
    formatInt(aside.unresolved),
    formatInt(aside.errors),
  ];
}

/** `single` is true for one run, where a small sample is marked. */
export function runEngineTable(snapshot: AiSearchSnapshot, single: boolean): AiTableBuild {
  const engines = engineResultRoleTallies(snapshot.calls);
  return {
    header: RUN_ENGINE_HEADER,
    rows: engines.map((engine) => {
      const [label, ...rest] = roleGroupCells(engine, engineLabel(engine.key), engines, single);
      return { key: engine.key, cells: [label, engine.models.join(", "), ...rest] };
    }),
    sort: "Resolved answers in the two rates, most first, then engine",
    filter: null,
  };
}

export function runCategoryTable(snapshot: AiSearchSnapshot, single: boolean): AiTableBuild {
  const categories = categoryRoleTallies(snapshot.calls);
  return {
    header: RUN_CATEGORY_HEADER,
    rows: categories.map((row) => ({ key: row.key, cells: roleGroupCells(row, categoryLabel(row.key), categories, single) })),
    sort: "Category, A to Z",
    filter: null,
  };
}

// ---- Run Details

export const SIMULATION_HEADER = ["Prompt", "Outcome", "Engine", "Model", "Category", "Fact check", "Cited links", "Checked"];

export function simulationOutcomeLabel(row: AiCallRow): string {
  const outcome = callOutcome(row);
  return outcome === "competitor_win" && row.primary_brand ? `${row.primary_brand} named most` : OUTCOME_LABELS[outcome];
}

export function simulationCategoryLabel(row: AiCallRow): string {
  return row.prompt_kind === "probe" ? "Product fact check" : categoryLabel(row.category);
}

export function simulationCells(row: AiCallRow, cited: number): string[] {
  return [
    cleanPrompt(row.prompt),
    simulationOutcomeLabel(row),
    engineLabel(row.engine),
    modelLabel(row.model),
    simulationCategoryLabel(row),
    factCheckColumnLabel(row),
    formatInt(cited),
    formatRunTime(row.created_at),
  ];
}

/** Valid, de-duplicated cited links per call id, as the Run Details rows count them. */
export function citedLinksByCall(snapshot: AiSearchSnapshot): Map<string, CitationEvidence[]> {
  const byCall = new Map<string, CitationEvidence[]>();
  for (const row of citationEvidence(snapshot.calls, snapshot.citations, "all").rows) {
    byCall.set(row.simulationId, [...(byCall.get(row.simulationId) ?? []), row]);
  }
  return byCall;
}

const SCOPE_WORDS: Record<ExplorerFilter["scope"], string> = {
  commercial: "Shopping prompts",
  probe: "Product fact checks",
  all: "Every call",
};

const OUTCOME_FILTER_WORDS: Record<string, string> = { resolved: "A clear leader" };

/** The Run Details filter in plain words, for the Filter line of a download. */
export function explorerFilterSentence(filter: ExplorerFilter): string {
  if (filter.callId != null || filter.simId != null) return "One call";
  const parts = [SCOPE_WORDS[filter.scope]];
  if (filter.role) parts.push(ROLE_LABELS[filter.role]);
  if (filter.engine) parts.push(`Engine: ${engineLabel(filter.engine)}`);
  if (filter.model) parts.push(`Model: ${filter.model}`);
  if (filter.category) parts.push(`Category: ${categoryLabel(filter.category)}`);
  if (filter.outcome) {
    const words = OUTCOME_FILTER_WORDS[filter.outcome] ?? OUTCOME_LABELS[filter.outcome as keyof typeof OUTCOME_LABELS];
    parts.push(`Outcome: ${words ?? filter.outcome}`);
  }
  if (filter.accuracy) parts.push(`Fact check: ${ACCURACY_LABELS[filter.accuracy]}`);
  if (filter.brand) parts.push(`Named most: ${filter.brand}`);
  return parts.join(". ");
}

const FILTER_SCOPES = new Set(["commercial", "probe", "all"]);

/** Reads a Run Details filter out of a download request. Unknown fields fall back to the default. */
export function parseExplorerFilter(value: unknown): ExplorerFilter {
  if (!value || typeof value !== "object") return DEFAULT_FILTER;
  const input = value as Record<string, unknown>;
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string).slice(0, 200) : "");
  return {
    scope: FILTER_SCOPES.has(text("scope")) ? (text("scope") as ExplorerFilter["scope"]) : DEFAULT_FILTER.scope,
    engine: text("engine"),
    model: text("model"),
    category: text("category"),
    outcome: text("outcome") as ExplorerFilter["outcome"],
    accuracy: (text("accuracy") in ACCURACY_LABELS ? text("accuracy") : "") as ExplorerFilter["accuracy"],
    brand: text("brand"),
    role: (text("role") in ROLE_LABELS ? text("role") : "") as QuestionRole | "",
    simId: typeof input.simId === "number" && Number.isFinite(input.simId) ? input.simId : null,
    callId: typeof input.callId === "string" ? input.callId.slice(0, 200) : null,
  };
}

export function simulationTable(snapshot: AiSearchSnapshot, filter: ExplorerFilter): AiTableBuild {
  const cited = citedLinksByCall(snapshot);
  const rows = sortExplorerRows(applyExplorerFilter(snapshot.calls, filter));
  return {
    header: SIMULATION_HEADER,
    rows: rows.map((row) => ({ key: row.id, cells: simulationCells(row, cited.get(row.id)?.length ?? 0) })),
    sort: "Question, then search engines before API engines, then engine",
    filter: explorerFilterSentence(filter),
  };
}

// ---- Product Fact Checks

export function factCheckHeader(): string[] {
  return ["Question checked", "Engine", "Model", "Result", `Verified ${brandName()} fact`, `${brandName()} source`, "Checked"];
}

export function factCheckCells(row: ProbeEvidence): string[] {
  return [
    row.prompt,
    engineLabel(row.engine),
    modelLabel(row.model),
    PROBE_STATE_LABELS[row.state],
    row.claim ?? "Not verified yet",
    row.claim ? (row.sourceUrl ?? "") : "",
    formatRunTime(row.checkedAt),
  ];
}

export function factCheckTable(snapshot: AiSearchSnapshot): AiTableBuild {
  const rows = driftRead(snapshot.calls, snapshot.probes).probes;
  return {
    header: factCheckHeader(),
    rows: rows.map((row) => ({ key: row.key, cells: factCheckCells(row) })),
    sort: "Question key, then engine",
    filter: null,
  };
}

// ---- Catalog products checked, by category and engine

export function catalogCoverageTable(snapshot: AiSearchSnapshot, windowed: boolean): AiTableBuild | null {
  const coverage = catalogCoverage(snapshot, windowed);
  if (!coverage || coverage.phase !== "ready") return null;
  return {
    header: ["Category", ...coverage.engines.map((engine) => engineLabel(engine))],
    rows: coverage.rows.map((row) => ({
      key: row.category,
      cells: [
        row.category,
        ...coverage.engines.map((engine) => `${formatInt(row.cells[engine].checked)} of ${formatInt(row.cells[engine].inScope)}`),
      ],
    })),
    sort: "Category, A to Z",
    filter: null,
  };
}

// ---- Trend over the selected runs

export const TREND_HEADER = ["Run", "Series", "Rate", "Outside the rate"];

/** "Nov 5, 2026 · Partial · API run Nov 4, 2026", as the trend table's Run cell reads. */
export function trendRunLabel(point: TrendPoint, apiDays: readonly string[] = []): string {
  return [
    formatDay(point.day),
    point.partial ? "Partial" : null,
    point.notStored > 0 ? "Partial coverage" : null,
    point.scoringMethod ? SCORING_LABELS[point.scoringMethod] : null,
    ...apiDays.map((day) => `API run ${formatDay(day)}`),
  ]
    .filter(Boolean)
    .join(" · ");
}

export type TrendTableParams = { metric: TrendMetric; breakdown: TrendBreakdown; query: QueryChoice };

export function trendTable(
  snapshots: readonly AiSearchSnapshot[],
  params: TrendTableParams,
  bounds: { from: string | null; to: string | null },
  apiDays: ReadonlyMap<string, string[]>,
): AiTableBuild | null {
  const model = buildHistoryTrend({ snapshots, ...params, fromDay: bounds.from, toDay: bounds.to });
  if (model.status !== "ready") return null;
  const question =
    params.query.kind === "all"
      ? "All questions in this rate"
      : params.query.kind === "lineage"
        ? `All wordings of ${params.query.promptKey}`
        : cleanPrompt(params.query.promptText);
  return {
    header: TREND_HEADER,
    rows: model.series.flatMap((series) =>
      series.points.map((point) => ({
        key: `${point.runId}:${series.key}`,
        cells: [trendRunLabel(point, apiDays.get(point.runId)), series.label, rateLabel(point), coverageLabel(point)],
      })),
    ),
    sort: "Series, then run date, oldest first",
    filter: `${ROLE_LABELS[params.metric]}. ${params.breakdown === "engine" ? "By engine" : "Overall"}. Question: ${question}`,
  };
}

// ---- The calls behind one trend point

export const TREND_POINT_HEADER = ["Question", "Engine", "Outcome", "In this rate"];

export type TrendPointRow = { call: AiCallRow; inRate: boolean };

/** The point's resolved calls, then the calls with no clear leader or a provider error. */
export function trendPointRows(
  snapshot: AiSearchSnapshot,
  point: TrendPoint,
  metric: TrendMetric,
  query: QueryChoice,
): TrendPointRow[] {
  const { inRate, outside } = callsBehindPoint(snapshot, point, metric, query);
  return [...inRate.map((call) => ({ call, inRate: true })), ...outside.map((call) => ({ call, inRate: false }))];
}

export function trendPointCells(row: TrendPointRow): string[] {
  return [
    cleanPrompt(row.call.prompt),
    engineLabel(row.call.engine),
    OUTCOME_LABELS[callOutcome(row.call)],
    row.inRate ? "In the rate" : "Outside the rate",
  ];
}

export function trendPointTable(
  snapshots: readonly AiSearchSnapshot[],
  params: TrendTableParams,
  bounds: { from: string | null; to: string | null },
  pick: { runId: string; seriesKey: string },
): AiTableBuild | null {
  const model = buildHistoryTrend({ snapshots, ...params, fromDay: bounds.from, toDay: bounds.to });
  if (model.status !== "ready") return null;
  const series = model.series.find((item) => item.key === pick.seriesKey);
  const point = series?.points.find((item) => item.runId === pick.runId);
  const snapshot = snapshots.find((item) => item.run.audit_run_id === pick.runId);
  if (!series || !point || !snapshot) return null;
  return {
    header: TREND_POINT_HEADER,
    rows: trendPointRows(snapshot, point, params.metric, params.query).map((row) => ({
      key: row.call.id,
      cells: trendPointCells(row),
    })),
    sort: "Calls in the rate first, then the calls outside it",
    filter: `${ROLE_LABELS[params.metric]}. ${series.label}. Run of ${formatDay(point.day)}`,
  };
}

// ---- Citation Ecosystem

/**
 * The Citation Ecosystem controls a download reads again. A picked site, class, or answer group
 * narrows the cited links on screen by row, so the request's row keys carry it.
 */
export type CitationTableParams = { scope: CitationScope; category: string | null };

const CITATION_SCOPE_WORDS: Record<CitationScope, string> = {
  commercial: "Shopping answers",
  probe: "Fact-check answers",
  all: "Every answer",
};

export function citationFilterSentence(params: CitationTableParams): string {
  const parts = [CITATION_SCOPE_WORDS[params.scope]];
  if (params.category != null) parts.push(`Category: ${citationCategoryLabel(params.category)}`);
  return parts.join(". ");
}

/** The cited links the tab is showing for its scope and category, before a pick narrows them. */
export function citationView(snapshot: AiSearchSnapshot, params: CitationTableParams) {
  const view = snapshotInCategory(snapshot, params.category);
  const read = citationEvidence(view.calls, view.citations, params.scope);
  return { view, read };
}

/** The same four columns the By engine and By category tables show. */
function citationCountHeader(first: string): string[] {
  return [first, "Cited answers", "Links", brandOwned()];
}

function citationCountTable(
  snapshot: AiSearchSnapshot,
  params: CitationTableParams,
  first: string,
  keyOf: (call: AiCallRow) => string,
  rowKey: (row: CitationEvidence) => string,
  label: (key: string) => string,
): AiTableBuild {
  const { view, read } = citationView(snapshot, params);
  const links = new Map(groupCitations(read.rows, rowKey).map((group) => [group.key, group]));
  return {
    header: citationCountHeader(first),
    rows: citedAnswers(view.calls, read.rows, params.scope, keyOf).map((group) => ({
      key: group.key,
      cells: [
        label(group.key),
        `${formatInt(group.cited)} of ${formatInt(group.answered)}`,
        formatInt(links.get(group.key)?.rows ?? 0),
        formatInt(links.get(group.key)?.fenderOwnedRows ?? 0),
      ],
    })),
    sort: `Answers, most first, then ${first.toLowerCase()}`,
    filter: citationFilterSentence(params),
  };
}

export function citationEngineTable(snapshot: AiSearchSnapshot, params: CitationTableParams): AiTableBuild {
  return citationCountTable(
    snapshot,
    params,
    "Engine",
    (call) => (call.engine ?? "").toLowerCase(),
    (row) => row.engine,
    (key) => engineLabel(key),
  );
}

export function citationCategoryTable(snapshot: AiSearchSnapshot, params: CitationTableParams): AiTableBuild {
  return citationCountTable(
    snapshot,
    params,
    "Category",
    (call) => call.category ?? "",
    (row) => row.category,
    (key) => citationCategoryLabel(key),
  );
}

export const CITATION_EVIDENCE_HEADER = ["Prompt", "Answer", "Engine", "Model", "Cited link", "Address", "Domain", "Source class"];

export function citationEvidenceCells(row: CitationEvidence): string[] {
  return [
    row.prompt,
    String(row.simId),
    engineLabel(row.engine),
    modelLabel(row.model),
    row.title ?? row.canonicalUrl,
    row.rawUrl,
    row.domain,
    SOURCE_CLASS_LABELS[row.sourceClass],
  ];
}

export function citationEvidenceTable(snapshot: AiSearchSnapshot, params: CitationTableParams): AiTableBuild {
  const { read } = citationView(snapshot, params);
  return {
    header: CITATION_EVIDENCE_HEADER,
    rows: read.rows.map((row) => ({ key: row.key, cells: citationEvidenceCells(row) })),
    sort: "Stored order: run, call, then the link's position in the answer",
    filter: citationFilterSentence(params),
  };
}

const CITATION_SCOPES = new Set(["commercial", "probe", "all"]);

/** Reads the Citation Ecosystem controls out of a download request. */
export function parseCitationParams(value: unknown): CitationTableParams {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const scope = typeof input.scope === "string" && CITATION_SCOPES.has(input.scope) ? (input.scope as CitationScope) : "commercial";
  const category = typeof input.category === "string" ? input.category.slice(0, 200) : null;
  return { scope, category };
}
