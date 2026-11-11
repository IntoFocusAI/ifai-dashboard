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

/** The rotating catalog slots. Only the search engines ask them; the API job asks the fixed fact checks. */
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

/** Repeats of each API question per engine that count: the question set × 3 repeats (Brian Magazu). */
export const API_REPEAT_CAP = 3;

export const API_REPEAT_RULE = `Only repeats 1 to ${API_REPEAT_CAP} of each API question per engine are counted.`;

/**
 * An API run's calls up to the repeat cap, with the fact checks and citations of those calls.
 * The run's counts are recounted; expected and missing are not known for the capped subset.
 * `repeats` is the run's own repeat count: above the cap, the calls may already arrive capped
 * by the read, and the run's counts still cover every repeat.
 */
export function capApiRepeats(snapshot: AiSearchSnapshot, cap = API_REPEAT_CAP, repeats?: number | null): AiSearchSnapshot {
  const calls = snapshot.calls.filter((row) => {
    const repeat = row.repeat_no ?? 1;
    return repeat >= 1 && repeat <= cap;
  });
  const kept = new Set(calls.map(callKey));
  const ids = new Set(calls.map((row) => row.id));
  const probes = snapshot.probes.filter((row) => kept.has(callKey(row)));
  const citations = snapshot.citations.filter((row) => ids.has(row.simulation_id));
  const capped =
    (repeats ?? 0) > cap ||
    calls.length !== snapshot.calls.length ||
    probes.length !== snapshot.probes.length ||
    citations.length !== snapshot.citations.length;
  if (!capped) return snapshot;
  return {
    ...snapshot,
    run: withCallCounts(snapshot, calls),
    calls,
    probes,
    citations,
    storedCitationCount: citations.length,
  };
}

/** What the engine switch did to the selection. Panels read it for N of M and tooltips. */
export type EngineScope = {
  choice: EngineGroupChoice;
  /**
   * The selection's fact checks before the switch narrowed them. A choice whose engines ask no
   * rotating catalog question still names the engines that do, and the catalog in scope.
   */
  probesBefore: readonly AiProbeRow[];
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
 * The selection narrowed to one engine group. Every choice counts the rotating catalog fact
 * checks its engines asked (Brian Magazu, 9 Nov 2026). Only the search engines ask them, so
 * the scope keeps the selection's fact checks for the tooltips, and the catalog coverage rows
 * stay whole so "N of M catalog products" keeps its M on every choice.
 * Returns null when the choice leaves no call, so the panel never shows a zero for it.
 */
export function filterSnapshotByEngineGroup(
  snapshot: AiSearchSnapshot,
  choice: EngineGroupChoice,
): AiSearchSnapshot | null {
  const calls = snapshot.calls.filter((row) => inEngineChoice(row.engine, choice));
  if (calls.length === 0) return null;
  const probes = snapshot.probes.filter((row) => inEngineChoice(row.engine, choice));
  const keptIds = new Set(calls.map((row) => row.id));
  const citations = snapshot.citations.filter(
    (row) => inEngineChoice(row.engine, choice) && keptIds.has(row.simulation_id),
  );
  const scope: EngineScope = { choice, probesBefore: snapshot.probes };
  const narrowed = calls.length !== snapshot.calls.length;
  return {
    ...snapshot,
    run: narrowed ? withCallCounts(snapshot, calls) : snapshot.run,
    calls,
    probes,
    citations,
    storedCitationCount: narrowed ? citations.length : snapshot.storedCitationCount,
    engineScope: scope,
  };
}

/**
 * Citation Ecosystem's population. With API engines in the figures, its fact-check answers are
 * the fixed questions only: the API job does not ask the rotating catalog checks, so their cited
 * links sit out, as they always have on this tab. Decision 13 (every engine choice counts the
 * rotating questions) is about Product Fact Checks, not about citation totals.
 * `apiInWindow` is true when any run of the window has an API run beside it.
 */
export function citationPopulation(snapshot: AiSearchSnapshot, apiInWindow = false): AiSearchSnapshot {
  if (!apiInWindow && !hasApiRows(snapshot)) return snapshot;
  const rotating = new Set(snapshot.probes.filter(isRotatingFactCheck).map(callKey));
  const calls = snapshot.calls.filter(
    (row) => row.prompt_kind !== "probe" || !(rotating.has(callKey(row)) || isRotatingFactCheck(row)),
  );
  if (calls.length === snapshot.calls.length) return snapshot;
  const kept = new Set(calls.map((row) => row.id));
  const citations = snapshot.citations.filter((row) => kept.has(row.simulation_id));
  return {
    ...snapshot,
    run: withCallCounts(snapshot, calls),
    calls,
    probes: snapshot.probes.filter((row) => !rotating.has(callKey(row))),
    citations,
    storedCitationCount: citations.length,
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
