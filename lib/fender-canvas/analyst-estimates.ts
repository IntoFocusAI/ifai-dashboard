import { activeClient } from "@/lib/client/active-client";
import { formatEstimate } from "@/lib/fender-canvas/format";

/** Shown in place of an analyst figure for a client that has none yet. */
export const NO_ANALYST_ESTIMATE = "Not available*";

const hasFenderEstimates = activeClient().key === "fender";

/** Analyst figures entered by hand for Fender. Nothing on the canvas computes them. */
export const PHASE_ONE_LIFT_ESTIMATE = hasFenderEstimates ? formatEstimate("+$680K") : NO_ANALYST_ESTIMATE;
export const ENTERPRISE_POTENTIAL_ESTIMATE = hasFenderEstimates
  ? formatEstimate("+$38M to $62M")
  : NO_ANALYST_ESTIMATE;
