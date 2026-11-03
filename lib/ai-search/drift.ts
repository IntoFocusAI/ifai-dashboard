import { amazonDiffers, catalogClaim, isCatalogProbe } from "@/lib/ai-search/probe-catalog";
import { cleanPrompt, engineLabel, isCommercial, isConfirmedHallucination } from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiProbeRow } from "@/lib/ai-search/types";

export type ProbeState = "confirmed" | "no_contradiction" | "no_fact" | "provider_error" | "unverified";

export const PROBE_STATE_LABELS: Record<ProbeState, string> = {
  confirmed: "Contradiction found",
  no_contradiction: "No contradiction found for this fact",
  no_fact: "No verified fact available",
  provider_error: "No answer returned",
  unverified: "Unverified flag",
};

export function probeState(row: AiProbeRow): ProbeState {
  if (row.call_status === "error") return "provider_error";
  switch (row.material_hallucination) {
    case "confirmed":
      return row.hallucination_evidence?.trim() ? "confirmed" : "unverified";
    case "none":
      return "no_contradiction";
    case "suspected":
    case "historical_unverified":
      return "unverified";
    default:
      return "no_fact";
  }
}

export type ProbeEvidence = {
  key: string;
  auditRunId: string;
  simId: number;
  /** Matching call id on the displayed snapshot, when the probe joins a call row. */
  callId: string | null;
  /** Fact checks group by key, never by wording: a rotating key asks a different product in each repeat. */
  promptKey: string;
  /** Products are counted by this: the ASIN when the collector named one, else the question key. */
  productKey: string;
  /** The collector named the catalog product (probe_asin). */
  catalog: boolean;
  /** A catalog product asked in every run (probe_is_anchor). A fixed question is never marked. */
  anchor: boolean;
  asin: string | null;
  sku: string | null;
  specField: string | null;
  amazonValue: string | null;
  /** Amazon lists a different value for this spec than the fender.com page. */
  amazonDiffers: boolean;
  prompt: string;
  engine: string;
  model: string | null;
  state: ProbeState;
  claim: string | null;
  sourceUrl: string | null;
  evidence: string | null;
  checkedAt: string | null;
  verifiedAt: string | null;
};

export type DriftRead = {
  probes: ProbeEvidence[];
  answered: number;
  errors: number;
  /** Answered probes compared against a verified fact. */
  checked: number;
  confirmed: number;
  noContradiction: number;
  noFact: number;
  unverified: number;
  /** Commercial answers with a confirmed contradiction. They are not counted as Fender wins. */
  commercialConfirmed: number;
  /** Commercial answers the collector compared against a verified fact. */
  commercialChecked: number;
  commercialAnswered: number;
  /** Confirmed contradictions across probes and commercial answers. */
  totalConfirmed: number;
  /** Answers compared with a verified fact, probes and commercial together. */
  totalChecked: number;
  /** Distinct facts used by the fact checks, with their source page. */
  facts: Array<{ promptKey: string; claim: string; sourceUrl: string | null; verifiedAt: string | null }>;
  /** What the fact-check section leads with, in the operator's terms. */
  coverage: FactCheckCoverage;
};

export type FactCheckCoverage = {
  /** Products asked about: by ASIN when the collector named one, else by question key. */
  questionsSent: number;
  /** Those products that have a fact verified on a Fender page. */
  questionsWithFact: number;
  /** Distinct ASINs among the checks that name a catalog product. Zero before the rotation. */
  catalogProducts: number;
  /** Products whose Amazon value for the checked spec differs from fender.com. */
  amazonMismatches: number;
  /** Verified facts an answer was actually compared against. */
  factsChecked: number;
  /** Answers compared against one of those facts. */
  answersChecked: number;
  /** Checked answers that contradicted the verified fact. */
  contradictions: number;
  /** Engines that returned a checked answer. */
  checkedEngines: string[];
  /** Questions with no verified fact yet, and the answers left unevaluated. */
  questionsWithoutFact: string[];
  answersWithoutFact: number;
  /** Fact-check calls an engine failed to answer. */
  failedCalls: number;
  failedEngines: string[];
};

function engineNames(rows: ProbeEvidence[]): string[] {
  return [...new Set(rows.map((row) => engineLabel(row.engine)))].sort();
}

function factCheckCoverage(rows: ProbeEvidence[]): FactCheckCoverage {
  const checkedStates: ProbeState[] = ["confirmed", "no_contradiction"];
  const checked = rows.filter((row) => checkedStates.includes(row.state));
  const failed = rows.filter((row) => row.state === "provider_error");
  const withoutFact = rows.filter((row) => row.state === "no_fact");

  return {
    questionsSent: new Set(rows.map((row) => row.productKey)).size,
    questionsWithFact: new Set(rows.filter((row) => row.claim).map((row) => row.productKey)).size,
    catalogProducts: new Set(rows.filter((row) => row.catalog).map((row) => row.productKey)).size,
    amazonMismatches: new Set(rows.filter((row) => row.amazonDiffers).map((row) => row.productKey)).size,
    factsChecked: new Set(checked.map((row) => row.productKey)).size,
    answersChecked: checked.length,
    contradictions: checked.filter((row) => row.state === "confirmed").length,
    checkedEngines: engineNames(checked),
    questionsWithoutFact: [...new Set(withoutFact.map((row) => row.productKey))].sort(),
    answersWithoutFact: withoutFact.length,
    failedCalls: failed.length,
    failedEngines: engineNames(failed),
  };
}

export function driftRead(calls: AiCallRow[], probes: AiProbeRow[]): DriftRead {
  const callIdByProbe = new Map<string, string>();
  for (const call of calls) {
    callIdByProbe.set(`${call.audit_run_id}:${call.sim_id}`, call.id);
  }
  const rows: ProbeEvidence[] = probes
    .map((row) => {
      const key = `${row.audit_run_id}:${row.sim_id}`;
      const catalog = isCatalogProbe(row);
      const promptKey = row.prompt_key ?? "";
      return {
        key,
        auditRunId: row.audit_run_id,
        simId: row.sim_id,
        callId: callIdByProbe.get(key) ?? null,
        promptKey,
        productKey: catalog ? row.probe_asin!.trim() : promptKey,
        catalog,
        anchor: catalog && row.probe_is_anchor === true,
        asin: catalog ? row.probe_asin!.trim() : null,
        sku: row.probe_fender_sku?.trim() || null,
        specField: row.probe_spec_field?.trim() || null,
        amazonValue: row.probe_amazon_value?.trim() || null,
        amazonDiffers: catalog && amazonDiffers(row),
        prompt: cleanPrompt(row.prompt),
        engine: (row.engine ?? "").toLowerCase(),
        model: row.model,
        state: probeState(row),
        // A catalog check compares against its own fender.com value and page, not the question's fact.
        claim: catalog ? catalogClaim(row) : row.verified_claim?.trim() || null,
        sourceUrl: (catalog ? row.probe_source_url : row.verified_source_url)?.trim() || null,
        evidence: row.hallucination_evidence?.trim() || null,
        checkedAt: row.created_at,
        verifiedAt: row.verified_at,
      };
    })
    .sort((a, b) => a.promptKey.localeCompare(b.promptKey) || a.engine.localeCompare(b.engine));

  const count = (state: ProbeState) => rows.filter((row) => row.state === state).length;
  const commercial = calls.filter(isCommercial);
  const commercialAnswered = commercial.filter((row) => row.call_status === "answered");

  const facts = new Map<string, DriftRead["facts"][number]>();
  for (const row of rows) {
    const factKey = row.catalog ? `${row.productKey}|${row.specField ?? ""}` : row.promptKey;
    if (row.claim && !facts.has(factKey)) {
      facts.set(factKey, {
        promptKey: row.promptKey,
        claim: row.claim,
        sourceUrl: row.sourceUrl,
        verifiedAt: row.verifiedAt,
      });
    }
  }

  const commercialConfirmed = commercialAnswered.filter(isConfirmedHallucination).length;
  const commercialChecked = commercialAnswered.filter(
    (row) => row.material_hallucination === "confirmed" || row.material_hallucination === "none",
  ).length;
  const checked = count("confirmed") + count("no_contradiction");

  return {
    probes: rows,
    answered: rows.filter((row) => row.state !== "provider_error").length,
    errors: count("provider_error"),
    checked,
    confirmed: count("confirmed"),
    noContradiction: count("no_contradiction"),
    noFact: count("no_fact"),
    unverified: count("unverified"),
    commercialConfirmed,
    commercialChecked,
    commercialAnswered: commercialAnswered.length,
    totalConfirmed: count("confirmed") + commercialConfirmed,
    totalChecked: checked + commercialChecked,
    facts: [...facts.values()],
    coverage: factCheckCoverage(rows),
  };
}
