// The Briefing card "Monthly potential lost brand revenue": Phase 1 divided by 12 (Brian, 18 Nov 2026).
// Same inputs, sources, coverage and confidence as Phase 1; only the period changes.

import type { EstimateRange, EstimateResult, SalesSource, SalesSourceSplit } from "./types";

export const MONTHS_PER_YEAR = 12;

export const MONTHLY_POTENTIAL_TITLE = "Monthly potential lost brand revenue";

/** Phase 1 divided by 12, with the same range, asterisk, and trail. Not available* when Phase 1 is. */
export function estimateMonthlyPotential(phase1: EstimateResult): EstimateResult {
  const range: EstimateRange | null =
    phase1.status === "estimated" && phase1.range
      ? {
          low: Math.round(phase1.range.low / MONTHS_PER_YEAR),
          mid: Math.round(phase1.range.mid / MONTHS_PER_YEAR),
          high: Math.round(phase1.range.high / MONTHS_PER_YEAR),
        }
      : null;
  // The split by sales source is divided too, so its parts still add to this figure.
  const salesSources = Object.fromEntries(
    (Object.keys(phase1.trail.salesSources) as SalesSource[]).map((key) => {
      const { estimate, ...rest } = phase1.trail.salesSources[key];
      return [key, estimate != null ? { ...rest, estimate: estimate / MONTHS_PER_YEAR } : rest];
    }),
  ) as SalesSourceSplit;
  const { trail } = phase1;
  return {
    lineId: "monthly_potential",
    status: range ? "estimated" : "not_available",
    range,
    label: "analyst estimate",
    asterisk: phase1.asterisk,
    countsInTotal: false,
    trail: {
      ...trail,
      lineId: "monthly_potential",
      title: MONTHLY_POTENTIAL_TITLE,
      means: trail.means.replace("in a year", "in a month"),
      formula: `Phase 1 divided by 12. ${trail.formula}`,
      salesSources,
    },
  };
}
