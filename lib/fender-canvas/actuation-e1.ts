/**
 * SC-03 E1 owned answers from the Citation Ecosystem data (decisions 97, 98): unbranded discovery
 * answers that cite at least one brand-owned page, out of resolved unbranded discovery answers, the
 * same count as the Citation Ecosystem "owned pages in unbranded" figure. Only engines that returned
 * at least one citation in the window count, decided from the data, so an API engine joins once its
 * answers return citations. The read is the date-pill window every Summary figure uses.
 */

import { engineKindLabel, sortEngines } from "@/lib/ai-search/citation-filters";
import { ownedByQuestionType } from "@/lib/ai-search/citation-insights";
import { citationEvidence } from "@/lib/ai-search/citations";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import {
  ownedAnswersFromEngines,
  type EngineOwnedAnswers,
  type OwnedAnswersBasis,
} from "@/lib/fender-canvas/actuation-score";

const engineOf = (engine: string | null | undefined) => (engine ?? "").trim().toLowerCase();

/** One row per engine that answered in the window: its citations and its unbranded owned answers. */
export function engineOwnedAnswers(snapshot: Pick<AiSearchSnapshot, "calls" | "citations">): EngineOwnedAnswers[] {
  const read = citationEvidence(snapshot.calls, snapshot.citations, "all");
  const answered = snapshot.calls.filter((call) => call.call_status === "answered");
  const engines = sortEngines(answered.map((call) => engineOf(call.engine)));
  return engines.map((engine) => {
    const calls = snapshot.calls.filter((call) => engineOf(call.engine) === engine);
    const unbranded = ownedByQuestionType(calls, read, "commercial")?.insight ?? { withOwned: 0, resolved: 0 };
    return {
      engine,
      citations: read.rows.filter((row) => engineOf(row.engine) === engine).length,
      withOwned: unbranded.withOwned,
      resolved: unbranded.resolved,
    };
  });
}

export type OwnedAnswersRead = {
  /** Null when no engine in the window returned a citation. */
  basis: OwnedAnswersBasis | null;
  /** Engine labels counted ("Perplexity (search)") and left out because they returned no citation. */
  counted: string[];
  leftOut: string[];
};

/** E1's inputs from the window's AI read. Null while that read is not ready. */
export function ownedAnswersFromAi(ai: AiSearchRead): OwnedAnswersRead | null {
  if (ai.phase !== "ready") return null;
  const engines = engineOwnedAnswers(ai.snapshot);
  return {
    basis: ownedAnswersFromEngines(engines),
    counted: engines.filter((row) => row.citations > 0).map((row) => engineKindLabel(row.engine)),
    leftOut: engines.filter((row) => row.citations <= 0).map((row) => engineKindLabel(row.engine)),
  };
}
