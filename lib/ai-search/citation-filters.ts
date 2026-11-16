import type { CitationScope } from "@/lib/ai-search/citations";
import {
  API_ENGINE_LABELS,
  isApiEngine,
  withCallCounts,
  type EngineGroupChoice,
} from "@/lib/ai-search/engine-group";
import { questionRole } from "@/lib/ai-search/question-role";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * Citation Ecosystem filters (decision 86): engine chips beside the engine presets, and one
 * question control. Both narrow every figure and table on the tab, inside the date pill's window.
 */

export type CitationQuestion = "shopping" | "unbranded" | "branded" | "probe" | "all";

export const CITATION_QUESTIONS: ReadonlyArray<readonly [CitationQuestion, string]> = [
  ["shopping", "All shopping"],
  ["unbranded", "Unbranded shopping"],
  ["branded", "Branded shopping"],
  ["probe", "Product fact checks"],
  ["all", "All answers"],
];

export const DEFAULT_CITATION_QUESTION: CitationQuestion = "shopping";

const QUESTION_KEYS: ReadonlySet<string> = new Set(CITATION_QUESTIONS.map(([value]) => value));

export function isCitationQuestion(value: unknown): value is CitationQuestion {
  return typeof value === "string" && QUESTION_KEYS.has(value);
}

export function citationQuestionLabel(question: CitationQuestion): string {
  return CITATION_QUESTIONS.find(([value]) => value === question)?.[1] ?? "All shopping";
}

/** The prompt kind a question choice counts. Unbranded and branded are shopping questions. */
export function questionScope(question: CitationQuestion): CitationScope {
  if (question === "probe") return "probe";
  if (question === "all") return "all";
  return "commercial";
}

/** The question choice the old three scope buttons meant, for a download sent before decision 86. */
export function questionForScope(scope: CitationScope): CitationQuestion {
  if (scope === "probe") return "probe";
  if (scope === "all") return "all";
  return "shopping";
}

/** "unbranded shopping answers": the noun the figures use for the question choice. */
export function questionNoun(question: CitationQuestion): string {
  if (question === "probe") return "fact-check answers";
  if (question === "all") return "answers";
  if (question === "unbranded") return "unbranded shopping answers";
  if (question === "branded") return "branded shopping answers";
  return "shopping answers";
}

/**
 * Unbranded and branded shopping are the two headline question roles: unbranded discovery, and
 * branded consideration. Other shopping questions count under All shopping and All answers.
 */
function inQuestion(call: Pick<AiCallRow, "prompt_kind" | "prompt">, question: CitationQuestion): boolean {
  if (question === "unbranded") return call.prompt_kind === "commercial" && questionRole(call) === "unbranded_discovery";
  if (question === "branded") return call.prompt_kind === "commercial" && questionRole(call) === "branded_consideration";
  return true;
}

/** The snapshot narrowed to a question choice. Citations join to calls by id, so they follow. */
export function snapshotForQuestion(snapshot: AiSearchSnapshot, question: CitationQuestion): AiSearchSnapshot {
  if (question !== "unbranded" && question !== "branded") return snapshot;
  return { ...snapshot, calls: snapshot.calls.filter((call) => inQuestion(call, question)) };
}

// ---- Engine chips

function engineKey(engine: string | null | undefined): string {
  return (engine ?? "").trim().toLowerCase();
}

/** "ChatGPT (search)" or "ChatGPT (API)", so the two kinds of the same assistant stay apart. */
export function engineKindLabel(engine: string | null | undefined): string {
  const key = engineKey(engine);
  if (isApiEngine(key)) return `${API_ENGINE_LABELS[key].replace(/\s+API$/, "")} (API)`;
  return `${engineLabel(key)} (search)`;
}

/** Search engines first, then API engines, each by label. */
export function sortEngines(engines: Iterable<string>): string[] {
  return [...new Set([...engines].map(engineKey).filter(Boolean))].sort(
    (a, b) => Number(isApiEngine(a)) - Number(isApiEngine(b)) || engineKindLabel(a).localeCompare(engineKindLabel(b)),
  );
}

/** Engines with at least one answered call. A chip for any other engine would be empty on every row. */
export function answeredEngines(snapshots: Iterable<Pick<AiSearchSnapshot, "calls">>): string[] {
  const engines = new Set<string>();
  for (const snapshot of snapshots) {
    for (const call of snapshot.calls) {
      if (call.call_status === "answered" && engineKey(call.engine)) engines.add(engineKey(call.engine));
    }
  }
  return sortEngines(engines);
}

/** The chips a preset turns on. */
export function presetEngines(choice: EngineGroupChoice, available: readonly string[]): string[] {
  if (choice === "all") return [...available];
  return available.filter((engine) => (choice === "api") === isApiEngine(engine));
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

/**
 * The preset a set of chips matches, or "custom" for any other mix. With no API engine in the
 * selection, every chip on reads All. `presets` lists the presets the switch can choose.
 */
export function presetForEngines(
  selected: readonly string[],
  available: readonly string[],
  presets: readonly EngineGroupChoice[] = ["all", "search", "api"],
): EngineGroupChoice | "custom" {
  for (const preset of presets) {
    const engines = presetEngines(preset, available);
    if (engines.length > 0 && sameSet(engines, selected)) return preset;
  }
  return "custom";
}

/**
 * The smallest engine group that holds every chip. The tab reads that group, so the API run
 * pairing and the fact-check population stay what the matching preset shows, and then narrows it.
 */
export function coveringChoice(selected: readonly string[]): EngineGroupChoice {
  const api = selected.some(isApiEngine);
  const search = selected.some((engine) => !isApiEngine(engine));
  if (api && !search) return "api";
  if (search && !api) return "search";
  return "all";
}

/** One chip turned on or off. The last chip stays on. */
export function toggleEngine(selected: readonly string[], engine: string): string[] {
  const key = engineKey(engine);
  if (selected.includes(key)) return selected.length > 1 ? selected.filter((item) => item !== key) : [...selected];
  return sortEngines([...selected, key]);
}

/**
 * The snapshot narrowed to the chosen engines: calls, fact checks, and citations. Returns the
 * snapshot as it is when the chips leave every call in.
 */
export function snapshotForEngines(snapshot: AiSearchSnapshot, engines: readonly string[] | null): AiSearchSnapshot {
  if (engines == null) return snapshot;
  const keep = new Set(engines.map(engineKey));
  const calls = snapshot.calls.filter((call) => keep.has(engineKey(call.engine)));
  if (calls.length === snapshot.calls.length) return snapshot;
  const ids = new Set(calls.map((call) => call.id));
  const citations = snapshot.citations.filter((row) => ids.has(row.simulation_id));
  return {
    ...snapshot,
    run: withCallCounts(snapshot, calls),
    calls,
    probes: snapshot.probes.filter((row) => keep.has(engineKey(row.engine))),
    citations,
    storedCitationCount: citations.length,
  };
}

/** Engine slugs a download sent, cleaned. Null when it named none. */
export function parseEngineList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const engines = sortEngines(
    value.filter((item): item is string => typeof item === "string" && /^[a-z0-9_.-]{1,40}$/i.test(item.trim())).slice(0, 30),
  );
  return engines.length ? engines : null;
}
