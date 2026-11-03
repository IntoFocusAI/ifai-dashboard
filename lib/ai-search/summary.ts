import { citationEvidence, groupCitations } from "@/lib/ai-search/citations";
import { largestCompetitorGap, type CategoryBattle, competitorTallies } from "@/lib/ai-search/competitors";
import { driftRead, type DriftRead } from "@/lib/ai-search/drift";
import { roleTally, type RoleTally } from "@/lib/ai-search/question-role";
import {
  categoryTallies,
  engineLabel,
  engineResultTallies,
  enginesAndModels,
  errorsByEngine,
  formatRunTime,
  isSmallSample,
  runCompleteness,
  tallyCommercial,
  type EngineModel,
  type ErrorEngine,
  type GroupTally,
  type OutcomeTally,
  type RunCompleteness,
} from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

/** Everything the map, widgets, tour, and command center say about the published run. */
export type AiRunSummary = {
  runId: string;
  shortRunId: string;
  completeness: RunCompleteness;
  completedAt: string;
  commercial: OutcomeTally;
  roles: {
    unbranded: RoleTally;
    branded: RoleTally;
    associated: RoleTally;
    guidance: RoleTally;
    productFact: RoleTally;
  };
  probesAnswered: number;
  engines: GroupTally[];
  /** Engines whose resolved sample is too small to rank against the largest one. */
  smallSampleEngines: string[];
  categories: GroupTally[];
  enginesAndModels: EngineModel[];
  errorEngines: ErrorEngine[];
  drift: DriftRead;
  citations: {
    rows: number;
    domains: number;
    answered: number;
    answersWithCitation: number;
    fenderOwnedRows: number;
    stored: number;
    invalid: number;
    duplicates: number;
  };
  /** Competitor wins on unbranded discovery only (counts, not an average of rates). */
  competitorWins: number;
  /** Top competitor by unbranded discovery wins; `resolved` is the unbranded discovery denominator. */
  topCompetitor: { brand: string; wins: number; resolved: number } | null;
  largestGap: CategoryBattle | null;
};

export function summarizeRun(snapshot: AiSearchSnapshot): AiRunSummary {
  const { run, calls, probes, citations } = snapshot;
  // Failed engines (all errors / all empty) stay off result lists; errorEngines keeps the count.
  const engines = engineResultTallies(calls);
  const largest = Math.max(0, ...engines.map((engine) => engine.resolved));
  const cited = citationEvidence(calls, citations, "commercial");
  const competitors = competitorTallies(calls);
  const drift = driftRead(calls, probes);

  return {
    runId: run.audit_run_id,
    shortRunId: run.audit_run_id.slice(0, 8),
    completeness: runCompleteness(run, calls),
    completedAt: formatRunTime(run.completed_at),
    commercial: tallyCommercial(calls),
    roles: {
      unbranded: roleTally(calls, "unbranded_discovery"),
      branded: roleTally(calls, "branded_consideration"),
      associated: roleTally(calls, "brand_associated_discovery"),
      guidance: roleTally(calls, "shopping_guidance"),
      productFact: roleTally(calls, "product_fact"),
    },
    probesAnswered: drift.answered,
    engines,
    smallSampleEngines: engines
      .filter((engine) => isSmallSample(engine.resolved, largest))
      .map((engine) => engine.key),
    categories: categoryTallies(calls),
    enginesAndModels: enginesAndModels(calls),
    errorEngines: errorsByEngine(calls),
    drift,
    citations: {
      rows: cited.rows.length,
      domains: groupCitations(cited.rows, (row) => row.domain).length,
      answered: cited.answered,
      answersWithCitation: cited.answersWithCitation,
      fenderOwnedRows: cited.rows.filter((row) => row.sourceClass === "fender_owned").length,
      stored: cited.stored,
      invalid: cited.invalid,
      duplicates: cited.duplicates,
    },
    competitorWins: competitors.reduce((sum, c) => sum + c.wins, 0),
    topCompetitor: competitors[0]
      ? { brand: competitors[0].brand, wins: competitors[0].wins, resolved: competitors[0].resolved }
      : null,
    largestGap: largestCompetitorGap(calls),
  };
}

export function pct(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((100 * numerator) / denominator).toFixed(1)}%` : "No resolved answers";
}

/** Map hero bands for Unbranded Discovery (red below 30, green above 65). */
export const UNBRANDED_RATE_BANDS = { redBelow: 30, greenAbove: 65 } as const;

/** Map hero bands for Branded Consideration (red below 70, green above 90). */
export const BRANDED_RATE_BANDS = { redBelow: 70, greenAbove: 90 } as const;

/**
 * One Run Details lead rate: pct() string and the same traffic-light color as the map
 * heroes (red below redBelow, yellow through greenAbove inclusive, green above).
 * Zero resolved never becomes a percentage or a color.
 */
export function roleRateLead(
  tally: Pick<RoleTally, "fenderWins" | "resolved">,
  bands: { redBelow: number; greenAbove: number },
): { rate: string | null; color: string | null } {
  if (tally.resolved <= 0) {
    return { rate: null, color: null };
  }
  const rateNum = (100 * tally.fenderWins) / tally.resolved;
  const color =
    rateNum < bands.redBelow
      ? "var(--danger-red)"
      : rateNum > bands.greenAbove
        ? "var(--success-green)"
        : "var(--warning-amber)";
  return { rate: pct(tally.fenderWins, tally.resolved), color };
}

/** Visible label on a rate that is too small to rank against the rows beside it. */
export const SMALL_SAMPLE_LABEL = "Small sample";

/** Exact observed rate, such as "25.0% (1 of 4)". Null when the denominator is zero. */
export function formatObservedRate(wins: number, resolved: number): string | null {
  if (resolved <= 0) return null;
  return `${pct(wins, resolved)} (${wins} of ${resolved})`;
}

/** The words a role cell shows. A small sample keeps its percentage and is marked. */
export function roleRatePlainText(wins: number, resolved: number, largestResolved: number): string {
  const figure = formatObservedRate(wins, resolved);
  if (figure == null) return "No resolved answers";
  if (isSmallSample(resolved, largestResolved)) return `${figure} ${SMALL_SAMPLE_LABEL}`;
  return figure;
}

/** A ranked rate sorts by its share. A small sample sorts as missing, so it is not ranked. */
export function roleRateSort(
  tally: { fenderWins: number; resolved: number },
  largestResolved: number,
): number | null {
  if (tally.resolved <= 0 || isSmallSample(tally.resolved, largestResolved)) return null;
  return tally.fenderWins / tally.resolved;
}

/** "ChatGPT (not recorded), Gemini (3.6 Flash), Perplexity (turbo)" */
export function engineModelLine(list: EngineModel[]): string {
  return list
    .map(({ engine, models }) =>
      `${engineLabel(engine)} (${models.length ? models.join(", ") : "not recorded"})`,
    )
    .join(", ");
}

/** "27 provider errors, all Perplexity" or "9 provider errors (6 Perplexity, 3 Gemini)". */
export function errorLine(summary: AiRunSummary): string {
  const engines = summary.errorEngines;
  if (engines.length === 0) return "No provider errors";
  const total = engines.reduce((sum, entry) => sum + entry.errors, 0);
  const noun = total === 1 ? "provider error" : "provider errors";
  if (engines.length === 1) return `${total} ${noun}, all ${engineLabel(engines[0].engine)}`;
  return `${total} ${noun} (${engines.map((e) => `${e.errors} ${engineLabel(e.engine)}`).join(", ")})`;
}

/** "4,601 answered of 6,628 calls", both counts from the call rows this read returned. */
export function answeredOfCallsLine(c: RunCompleteness): string {
  const count = (n: number) => n.toLocaleString("en-US");
  return `${count(c.answeredRows)} answered of ${count(c.rowsRead)} ${c.rowsRead === 1 ? "call" : "calls"}`;
}

export function runStateLabel(state: string): string {
  if (state === "completed") return "Complete";
  if (state === "partial") return "Partial";
  return state ? state.charAt(0).toUpperCase() + state.slice(1) : "State not recorded";
}

/** "13 of 23 resolved answers (56.5%)", or a non-zero phrase when nothing resolved. */
export function resolvedPhrase(tally: OutcomeTally): string {
  if (tally.resolved <= 0) return "no resolved answers";
  return `${tally.fenderWins} of ${tally.resolved} resolved answers (${pct(tally.fenderWins, tally.resolved)})`;
}

/** The two rates that lead AI Search. Shopping guidance and product-fact questions are not in either one. */
export function headlineLine(summary: AiRunSummary): string {
  return `Unbranded discovery: Fender/Squier named most in ${resolvedPhrase(summary.roles.unbranded)}. Branded consideration: ${resolvedPhrase(summary.roles.branded)}.`;
}
