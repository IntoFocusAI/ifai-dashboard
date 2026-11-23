import type { NodeStatus } from "@/lib/canvas-sdk/types";

/**
 * One band definition for Amazon spec completeness (FDD X-03), shared by Catalog Governance
 * "Specs Complete" and AI Readiness "Amazon attribute completeness" so the two cannot drift.
 * Good at or above 98%, Fair from 95% to under 98%, Poor under 95%.
 */
export const AMAZON_SPEC_BANDS = { goodAtOrAbove: 98, fairAtOrAbove: 95 } as const;

/** Status for an unrounded Amazon spec completeness percentage. */
export function amazonSpecTone(pct: number): Exclude<NodeStatus, "neutral"> {
  if (pct >= AMAZON_SPEC_BANDS.goodAtOrAbove) return "success";
  if (pct >= AMAZON_SPEC_BANDS.fairAtOrAbove) return "warning";
  return "danger";
}
