// Reads lines 8 and 9's inputs from the AI answers in the date-pill window, the same read the
// Briefing lead shows (summarizeRun on the map's window read), and joins the AI lines and the AI
// part of Enterprise Potential to a client's estimates. Nothing here names a client.

import { citationEvidence } from "@/lib/ai-search/citations";
import { questionRole } from "@/lib/ai-search/question-role";
import { memoByRead } from "@/lib/ai-search/read-memo";
import { callOutcome } from "@/lib/ai-search/run-metrics";
import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import { estimateAiLines, type AiEstimatesRead, type AiGapInputs } from "./ai-gap";
import { estimateEnterprise } from "./enterprise";
import type { ClientEstimates, ClientEstimatesRead } from "./live-inputs";

/** Shown when the AI answers behind lines 8 and 9 did not load: left out, never $0. */
export const AI_ESTIMATE_READ_FAILED = "The AI answers behind this estimate did not load, so it is left out rather than shown as zero.";

/** The window's rates, top rival and rival-led citations, computed once per snapshot. */
export const aiGapInputs: (snapshot: AiSearchSnapshot) => AiGapInputs = memoByRead((snapshot: AiSearchSnapshot): AiGapInputs => {
  const summary = summarizeRun(snapshot);
  const rivalLed = snapshot.calls.filter((call) => questionRole(call) === "unbranded_discovery" && callOutcome(call) === "competitor_win");
  const rows = citationEvidence(rivalLed, snapshot.citations, "commercial").rows;
  return {
    unbranded: { wins: summary.roles.unbranded.fenderWins, resolved: summary.roles.unbranded.resolved },
    branded: { wins: summary.roles.branded.fenderWins, resolved: summary.roles.branded.resolved },
    topRival: summary.topCompetitor,
    rivalLedCitations: { total: rows.length, retailer: rows.filter((row) => row.sourceClass === "retailer").length },
    asOf: (snapshot.run.completed_at ?? snapshot.run.published_at ?? "").slice(0, 10) || null,
  };
});

/** Lines 8 and 9 for one client's estimates and the AI read. */
export function aiEstimatesFor(estimates: ClientEstimates, ai: AiSearchRead): AiEstimatesRead {
  if (ai.phase === "loading") return { phase: "loading" };
  if (ai.phase !== "ready") return { phase: "error", message: ai.phase === "error" ? ai.message : "No AI run in the window" };
  return estimateAiLines(aiGapInputs(ai.snapshot), estimates.catalog, estimates.dataAsOf);
}

const joined = new WeakMap<ClientEstimates, WeakMap<object, ClientEstimates>>();
const LOADING_KEY = {};
const ERROR_KEY = {};

/**
 * The estimates with lines 8 and 9 and Enterprise Potential's AI part. While the AI read loads,
 * Enterprise keeps its listing-fix figure and the screen reads it as loading; when the AI read fails,
 * the AI lines read Not available* and Enterprise is the listing-fix part with its note.
 */
export function withAiEstimates(read: ClientEstimatesRead | undefined, ai: AiSearchRead): ClientEstimatesRead | undefined {
  if (!read || read.phase !== "ready") return read;
  const base = read.estimates;
  const key = ai.phase === "ready" ? ai.snapshot : ai.phase === "loading" ? LOADING_KEY : ERROR_KEY;
  let byAi = joined.get(base);
  if (!byAi) {
    byAi = new WeakMap();
    joined.set(base, byAi);
  }
  const hit = byAi.get(key);
  if (hit) return { phase: "ready", estimates: hit };
  const lines = aiEstimatesFor(base, ai);
  const enterprise =
    lines.phase === "ready"
      ? estimateEnterprise(base.phase1, base.catalog, base.revenue ?? null, base.dataAsOf, { rates: lines.rates, retailerShare: lines.retailerShare })
      : base.enterprise;
  const estimates: ClientEstimates = { ...base, ai: lines, enterprise };
  byAi.set(key, estimates);
  return { phase: "ready", estimates };
}
