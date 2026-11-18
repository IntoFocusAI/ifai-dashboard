import { brandName } from "@/lib/brand-copy";
import type { ClientEstimatesRead } from "@/lib/estimates/live-inputs";
import type { EstimateResult } from "@/lib/estimates/types";
import { formatEstimate, formatMoneyShort } from "@/lib/fender-canvas/format";

/**
 * Phase 1 and Enterprise Potential as short figures for the map, the tour, the deck and the
 * Summary template: the formula mid from lib/estimates (decision 112), never a hand-entered figure.
 * Every client reads the same formulas from its own data and settings.
 */

/** Shown in place of an analyst figure that is not prepared or did not load. */
export const NO_ANALYST_ESTIMATE = "Not available*";

/** Shown while the estimates read. */
export const ESTIMATE_LOADING = "Loading";

/** The tooltip on an estimate a client does not have yet (decision 105). */
export function notPreparedTip(): string {
  return `Analyst estimate not prepared yet for ${brandName()}`;
}

/** The estimates the bundle carries; absent reads as loading. */
type WithEstimates = { estimates?: ClientEstimatesRead } | null | undefined;

function shortFigure(result: EstimateResult | null): string {
  if (!result || result.status !== "estimated" || !result.range) return NO_ANALYST_ESTIMATE;
  return formatEstimate(`+${formatMoneyShort(result.range.mid)}${result.asterisk ? "*" : ""}`);
}

function pick(bundle: WithEstimates, which: "phase1" | "enterprise" | "mapLeakage"): string {
  const read = bundle?.estimates;
  if (!read || read.phase === "loading") return ESTIMATE_LOADING;
  if (read.phase === "error") return NO_ANALYST_ESTIMATE;
  // Enterprise Potential waits for its AI part (lines 8 and 9) while the AI read loads.
  if (which === "enterprise" && read.estimates.ai?.phase === "loading") return ESTIMATE_LOADING;
  return shortFigure(read.estimates[which]);
}

/** Near-term upside (Phase 1), mid: "+$1.23M* est.". */
export function phaseOneLiftEstimate(bundle?: WithEstimates): string {
  return pick(bundle, "phase1");
}

/** Enterprise Potential, mid. Not available* when the client has no revenue figure in settings. */
export function enterprisePotentialEstimate(bundle?: WithEstimates): string {
  return pick(bundle, "enterprise");
}

/** The estimate result when ready, else null. */
export function readyEstimate(bundle: WithEstimates, which: "phase1" | "enterprise" | "mapLeakage"): EstimateResult | null {
  const read = bundle?.estimates;
  return read?.phase === "ready" ? read.estimates[which] : null;
}
