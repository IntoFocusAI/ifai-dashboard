import { activeClient } from "@/lib/client/active-client";
import { formatEstimate } from "@/lib/fender-canvas/format";

/** Shown in place of an analyst figure for a client that has none yet. */
export const NO_ANALYST_ESTIMATE = "Not available*";

/* Read the client per call, never at import: a server export sets the client per request. */
function hasFenderEstimates(): boolean {
  return activeClient().key === "fender";
}

/** Analyst figures entered by hand for Fender. Nothing on the canvas computes them. */
export function phaseOneLiftEstimate(): string {
  return hasFenderEstimates() ? formatEstimate("+$680K") : NO_ANALYST_ESTIMATE;
}

export function enterprisePotentialEstimate(): string {
  return hasFenderEstimates() ? formatEstimate("+$38M to $62M") : NO_ANALYST_ESTIMATE;
}
