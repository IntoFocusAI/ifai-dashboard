import type { AiCallRow, AiProbeRow, AiSearchSnapshot } from "@/lib/ai-search/types";

/** Brian Watson's API job. The slugs are the stored engine values. */
export const API_ENGINE_LABELS: Record<string, string> = {
  openai_api: "ChatGPT API",
  gemini_api: "Gemini API",
  claude_api: "Claude API",
  grok_api: "Grok API",
  crescent_api: "Crescent API",
};

export const API_ENGINES = Object.keys(API_ENGINE_LABELS);

export type EngineGroup = "search" | "api";

export const ENGINE_GROUP_LABELS: Record<EngineGroup, string> = {
  search: "Search engine",
  api: "API",
};

export type EngineGroupChoice = "all" | "search" | "api";

export const DEFAULT_ENGINE_GROUP_CHOICE: EngineGroupChoice = "all";

export const ENGINE_GROUP_CHOICES: ReadonlyArray<readonly [EngineGroupChoice, string]> = [
  ["all", "All"],
  ["search", "Without API"],
  ["api", "API only"],
];

export function choiceLabel(choice: EngineGroupChoice): string {
  return ENGINE_GROUP_CHOICES.find(([value]) => value === choice)?.[1] ?? "All";
}

function key(engine: string | null | undefined): string {
  return (engine ?? "").trim().toLowerCase();
}

export function isApiEngine(engine: string | null | undefined): boolean {
  return key(engine) in API_ENGINE_LABELS;
}

export function engineGroup(engine: string | null | undefined): EngineGroup {
  return isApiEngine(engine) ? "api" : "search";
}

export function inEngineChoice(engine: string | null | undefined, choice: EngineGroupChoice): boolean {
  if (choice === "all") return true;
  return engineGroup(engine) === choice;
}

/** The rotating catalog slots. The API job asks only the fixed fact checks. */
export const ROTATING_FACT_CHECK_KEYS: ReadonlySet<string> = new Set(["p35", "p36", "p37"]);

/** A fact check from the catalog rotation: a rotating slot, or a catalog product that is not an anchor. */
export function isRotatingFactCheck(
  row: Pick<AiProbeRow, "prompt_key"> & Partial<Pick<AiProbeRow, "probe_asin" | "probe_is_anchor">>,
): boolean {
  if (row.prompt_key && ROTATING_FACT_CHECK_KEYS.has(row.prompt_key.trim().toLowerCase())) return true;
  return Boolean(row.probe_asin?.trim()) && row.probe_is_anchor !== true;
}

/**
 * The battery run's fixed questions: the question keys its search engines were asked, rotating
 * fact checks left out. An API run counts beside that run only when it matched at least as many.
 */
export function fixedQuestionCount(snapshot: Pick<AiSearchSnapshot, "calls" | "probes">): number {
  const rotating = new Set(snapshot.probes.filter(isRotatingFactCheck).map(callKey));
  const keys = new Set<string>();
  for (const row of snapshot.calls) {
    if (isApiEngine(row.engine) || !row.prompt_key) continue;
    if (row.prompt_kind === "probe" && (rotating.has(callKey(row)) || isRotatingFactCheck(row))) continue;
    keys.add(row.prompt_key.trim().toLowerCase());
  }
  return keys.size;
}

export const API_QUESTION_RULE =
  "An API run counts only when it asked at least as many questions as the search run's fixed questions, so a short test run is left out.";

/** What the engine switch did to the selection. Panels read it for N of M and tooltips. */
export type EngineScope = {
  choice: EngineGroupChoice;
  /** Fact checks are the fixed questions only, because API engines are in the figures. */
  fixedFactChecksOnly: boolean;
  /** Rotating fact-check calls left out to keep the fixed questions only. */
  rotatingLeftOut: number;
  /** Fact-check calls before the switch: the M in "N of M" for the fixed-only figure. */
  factChecksBefore: number;
};

function callKey(row: { audit_run_id: string; sim_id: number }): string {
  return `${row.audit_run_id}:${row.sim_id}`;
}

export function hasApiRows(snapshot: Pick<AiSearchSnapshot, "calls">): boolean {
  return snapshot.calls.some((row) => isApiEngine(row.engine));
}

export function hasSearchRows(snapshot: Pick<AiSearchSnapshot, "calls">): boolean {
  return snapshot.calls.some((row) => !isApiEngine(row.engine));
}

/**
 * The selection narrowed to one engine group. With API engines in the figures, fact checks keep
 * only the fixed questions, since the API job does not ask the rotating catalog checks.
 * Returns null when the choice leaves no call, so the panel never shows a zero for it.
 * `rotating` "drop" keeps the fixed questions only on a run whose API runs sit on another point;
 * "keep" leaves the rotating checks in for a reader that counts no fact check.
 */
export function filterSnapshotByEngineGroup(
  snapshot: AiSearchSnapshot,
  choice: EngineGroupChoice,
  rotating: "auto" | "drop" | "keep" = "auto",
): AiSearchSnapshot | null {
  const calls = snapshot.calls.filter((row) => inEngineChoice(row.engine, choice));
  if (calls.length === 0) return null;
  const fixedFactChecksOnly =
    rotating === "keep" ? false : (rotating === "drop" && choice !== "search") || calls.some((row) => isApiEngine(row.engine));
  const factChecksBefore = calls.filter((row) => row.prompt_kind === "probe").length;
  let probes = snapshot.probes.filter((row) => inEngineChoice(row.engine, choice));
  let kept: AiCallRow[] = calls;
  if (fixedFactChecksOnly) {
    const rotating = new Set(probes.filter(isRotatingFactCheck).map(callKey));
    probes = probes.filter((row) => !rotating.has(callKey(row)));
    kept = calls.filter(
      (row) => row.prompt_kind !== "probe" || !(rotating.has(callKey(row)) || isRotatingFactCheck(row)),
    );
  }
  const keptIds = new Set(kept.map((row) => row.id));
  const droppedIds = new Set(snapshot.calls.filter((row) => !keptIds.has(row.id)).map((row) => row.id));
  const citations = snapshot.citations.filter(
    (row) => inEngineChoice(row.engine, choice) && !droppedIds.has(row.simulation_id),
  );
  const probeCoverage =
    snapshot.probeCoverage == null
      ? snapshot.probeCoverage
      : snapshot.probeCoverage.filter((row) => inEngineChoice(row.engine, choice));
  const scope: EngineScope = {
    choice,
    fixedFactChecksOnly,
    rotatingLeftOut: calls.length - kept.length,
    factChecksBefore,
  };
  const narrowed = kept.length !== snapshot.calls.length;
  return {
    ...snapshot,
    run: narrowed ? withCallCounts(snapshot, kept) : snapshot.run,
    calls: kept,
    probes,
    citations,
    storedCitationCount: narrowed ? citations.length : snapshot.storedCitationCount,
    ...(probeCoverage === undefined ? {} : { probeCoverage }),
    engineScope: scope,
  };
}

/** Run counts recounted from the calls the switch kept. Expected and missing are not known for a subset. */
function withCallCounts(snapshot: AiSearchSnapshot, calls: readonly AiCallRow[]): AiSearchSnapshot["run"] {
  const answered = calls.filter((row) => row.call_status === "answered").length;
  const errors = calls.filter((row) => row.call_status === "error" || row.outcome === "error").length;
  return {
    ...snapshot.run,
    attempted_calls: calls.length,
    answered_calls: answered,
    error_calls: errors,
    expected_calls: null,
    missing_calls: null,
  };
}

/**
 * The displayed selection with the API runs beside it. Call ids get the run prefix the pooled
 * selection uses, so a call and its citations stay paired. The selection's run stays the run row.
 */
export function withApiSnapshots(base: AiSearchSnapshot, api: readonly AiSearchSnapshot[]): AiSearchSnapshot {
  if (api.length === 0) return base;
  const calls = [...base.calls];
  const probes = [...base.probes];
  const citations = [...base.citations];
  for (const snapshot of api) {
    const prefix = snapshot.run.audit_run_id;
    const ids = new Map<string, string>();
    for (const call of snapshot.calls) {
      if (!isApiEngine(call.engine)) continue;
      const id = `${prefix}:${call.id}`;
      ids.set(call.id, id);
      calls.push({ ...call, id });
    }
    probes.push(...snapshot.probes.filter((row) => isApiEngine(row.engine)));
    for (const citation of snapshot.citations) {
      const id = ids.get(citation.simulation_id);
      if (id) citations.push({ ...citation, simulation_id: id });
    }
  }
  return {
    ...base,
    calls,
    probes,
    citations,
    storedCitationCount: (base.storedCitationCount ?? base.citations.length) + (citations.length - base.citations.length),
  };
}

/** "With API engines included, fact checks count the fixed questions only: 120 of 150 checks." */
export function fixedFactChecksTip(scope: EngineScope | undefined, kept: number): string | null {
  if (!scope?.fixedFactChecksOnly) return null;
  const counted = scope.rotatingLeftOut > 0 ? ` ${kept} of ${scope.factChecksBefore} fact-check calls are counted.` : "";
  return `With API engines included, fact checks count the fixed questions only. The API job does not ask the rotating catalog fact checks.${counted}`;
}
