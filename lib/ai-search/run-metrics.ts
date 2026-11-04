import { API_ENGINE_LABELS } from "@/lib/ai-search/engine-group";
import type { AiCallRow, AiCurrentRun } from "@/lib/ai-search/types";

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  claude: "Claude",
  copilot: "Copilot",
};

export const FENDER_BRAND = "Fender/Squier";

/** Below this many resolved answers, an engine or category is not compared with the others. */
export const MIN_COMPARABLE_RESOLVED = 10;

export function engineLabel(engine: string | null | undefined): string {
  const key = (engine ?? "").trim().toLowerCase();
  if (!key) return "Engine not recorded";
  return ENGINE_LABELS[key] ?? API_ENGINE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function modelLabel(model: string | null | undefined): string {
  const text = model?.trim();
  return text ? text : "not recorded";
}

export function categoryLabel(category: string | null | undefined): string {
  const text = category?.trim();
  if (!text) return "Uncategorized";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ENGINE_NAMES = Object.keys(ENGINE_LABELS).join("|");
const TRAILING_ENGINE_TAG = new RegExp(
  `\\s*(?:[\\[(]\\s*(?:via\\s+|engine:\\s*)?(?:${ENGINE_NAMES})[^\\])]*[\\])]|[|#:-]+\\s*(?:${ENGINE_NAMES})\\b.*)$`,
  "i",
);

/** The stored prompt without any engine tag a collector appended. */
export function cleanPrompt(prompt: string | null | undefined): string {
  let text = (prompt ?? "").trim();
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(TRAILING_ENGINE_TAG, "").trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

export const isCommercial = (row: AiCallRow) => row.prompt_kind === "commercial";
export const isProbe = (row: AiCallRow) => row.prompt_kind === "probe";
export const isError = (row: AiCallRow) => row.call_status === "error" || row.outcome === "error";
export const isConfirmedHallucination = (row: { material_hallucination: string | null }) =>
  row.material_hallucination === "confirmed";

/** Contract outcomes. A row outside that vocabulary is shown as unsupported, never counted. */
export type CallOutcome =
  | "fender_win"
  | "fender_win_disqualified"
  | "competitor_win"
  | "unresolved"
  | "error"
  | "probe"
  | "unsupported";

export function callOutcome(row: AiCallRow): CallOutcome {
  if (isError(row)) return "error";
  if (isProbe(row)) return "probe";
  if (!isCommercial(row)) return "unsupported";
  switch (row.outcome) {
    case "fender_win":
      return isConfirmedHallucination(row) ? "fender_win_disqualified" : "fender_win";
    case "competitor_win":
      return "competitor_win";
    case "unresolved":
      return "unresolved";
    default:
      return "unsupported";
  }
}

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  fender_win: "Fender/Squier named most",
  fender_win_disqualified: "Fender/Squier named most, with a confirmed error",
  competitor_win: "Competitor named most",
  unresolved: "No clear leader",
  error: "Provider error",
  probe: "Product fact check",
  unsupported: "Not in the contract",
};

export type OutcomeTally = {
  calls: number;
  answered: number;
  resolved: number;
  fenderWins: number;
  disqualified: number;
  competitorWins: number;
  unresolved: number;
  errors: number;
  unsupported: number;
  /** Fender wins with no confirmed hallucination, over resolved. Null when nothing resolved. */
  winPct: number | null;
};

export function tallyCommercial(rows: AiCallRow[]): OutcomeTally {
  const tally: OutcomeTally = {
    calls: 0,
    answered: 0,
    resolved: 0,
    fenderWins: 0,
    disqualified: 0,
    competitorWins: 0,
    unresolved: 0,
    errors: 0,
    unsupported: 0,
    winPct: null,
  };
  for (const row of rows) {
    if (!isCommercial(row)) continue;
    tally.calls += 1;
    const outcome = callOutcome(row);
    if (outcome !== "error") tally.answered += 1;
    if (outcome === "fender_win") tally.fenderWins += 1;
    if (outcome === "fender_win_disqualified") tally.disqualified += 1;
    if (outcome === "competitor_win") tally.competitorWins += 1;
    if (outcome === "unresolved") tally.unresolved += 1;
    if (outcome === "error") tally.errors += 1;
    if (outcome === "unsupported") tally.unsupported += 1;
  }
  tally.resolved = tally.fenderWins + tally.disqualified + tally.competitorWins;
  tally.winPct = tally.resolved > 0 ? (100 * tally.fenderWins) / tally.resolved : null;
  return tally;
}

export type GroupTally = OutcomeTally & { key: string; models: string[] };

function groupBy(rows: AiCallRow[], keyOf: (row: AiCallRow) => string): GroupTally[] {
  const buckets = new Map<string, AiCallRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  return [...buckets.entries()].map(([key, bucket]) => {
    const answered = bucket.filter((row) => !isError(row));
    return {
      key,
      models: [...new Set((answered.length ? answered : bucket).map((row) => modelLabel(row.model)))].sort(),
      ...tallyCommercial(bucket),
    };
  });
}

export function engineTallies(rows: AiCallRow[]): GroupTally[] {
  return groupBy(rows.filter(isCommercial), (row) => (row.engine ?? "").toLowerCase()).sort(
    (a, b) => b.resolved - a.resolved || a.key.localeCompare(b.key),
  );
}

/**
 * True when every call for this engine failed or came back empty.
 * That engine is not a client result: no win rate, bar, or result tile.
 * Provider-error counts stay on `errorLine` / `errorsByEngine`.
 */
export function isFailedResultEngine(tally: Pick<OutcomeTally, "calls" | "answered">): boolean {
  return tally.calls > 0 && tally.answered <= 0;
}

/** Commercial engine tallies that returned at least one answer. Failed engines are omitted. */
export function engineResultTallies(rows: AiCallRow[]): GroupTally[] {
  return engineTallies(rows).filter((engine) => !isFailedResultEngine(engine));
}

export function categoryTallies(rows: AiCallRow[]): GroupTally[] {
  return groupBy(rows.filter(isCommercial), (row) => row.category ?? "").sort(
    (a, b) => (a.winPct ?? 101) - (b.winPct ?? 101) || a.key.localeCompare(b.key),
  );
}

/** True when this sample is too small to rank against the largest sample beside it. */
export function isSmallSample(resolved: number, largestResolved: number): boolean {
  return resolved < MIN_COMPARABLE_RESOLVED || resolved * 2 < largestResolved;
}

export type EngineModel = { engine: string; models: string[] };

/** Every engine in the run, with each model it reported. Probes and errors included. */
export function enginesAndModels(rows: AiCallRow[]): EngineModel[] {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const engine = (row.engine ?? "").toLowerCase();
    const set = map.get(engine) ?? new Set<string>();
    if (row.model?.trim()) set.add(row.model.trim());
    map.set(engine, set);
  }
  return [...map.entries()]
    .map(([engine, models]) => ({ engine, models: [...models].sort() }))
    .sort((a, b) => a.engine.localeCompare(b.engine));
}

export type ErrorEngine = { engine: string; errors: number; calls: number };

export function errorsByEngine(rows: AiCallRow[]): ErrorEngine[] {
  const map = new Map<string, ErrorEngine>();
  for (const row of rows) {
    const engine = (row.engine ?? "").toLowerCase();
    const entry = map.get(engine) ?? { engine, errors: 0, calls: 0 };
    entry.calls += 1;
    if (isError(row)) entry.errors += 1;
    map.set(engine, entry);
  }
  return [...map.values()].filter((e) => e.errors > 0).sort((a, b) => b.errors - a.errors);
}

export type RunCompleteness = {
  state: string;
  isPartial: boolean;
  isComplete: boolean;
  expected: number | null;
  answered: number | null;
  errors: number | null;
  missing: number | null;
  /** Rows the views returned for this run. Compared with expected to catch a short read. */
  rowsRead: number;
  /** Of those rows, the ones with an answer. Provider errors are the rest. */
  answeredRows: number;
};

export function runCompleteness(run: AiCurrentRun, rows: AiCallRow[]): RunCompleteness {
  return {
    state: run.run_state,
    isPartial: run.run_state === "partial",
    isComplete: run.run_state === "completed",
    expected: run.expected_calls,
    answered: run.answered_calls,
    errors: run.error_calls,
    missing: run.missing_calls,
    rowsRead: rows.length,
    answeredRows: rows.filter((row) => row.call_status === "answered").length,
  };
}

export function formatRunTime(iso: string | null | undefined): string {
  if (!iso) return "Time not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function formatShare(numerator: number, denominator: number): string {
  if (denominator <= 0) return "No resolved answers";
  return `${((100 * numerator) / denominator).toFixed(1)}%`;
}
