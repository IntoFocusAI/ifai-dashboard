/**
 * Action Items fix list: the A+ content row (Brian, 18 Nov 2026). Line 7 (weak or missing A+
 * content) gets its own row whenever its mid is above $0 or any listing in it is Not available*.
 * Its dollars sit on this row only, so the own-pages row never counts them twice. One template for
 * every client.
 */

import type { ClientEstimates } from "@/lib/estimates/live-inputs";
import { APLUS_ROW_ID, fixRowMonthly, lineFromListings } from "@/lib/fender-canvas/action-items-fix-list";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import { RECOMMENDED_LABEL, rankPlan, type PlanItem, type UnrankedPlanItem } from "@/lib/fender-canvas/roadmap-plan";

/** "Add A+ content to 1 listing." / "Add A+ content to 12 listings." */
export function aplusActionText(listings: number): string {
  return `Add A+ content to ${listings} ${listings === 1 ? "listing" : "listings"}.`;
}

/** The row, or null when line 7 touches no listing, is $0, and has no Not available* listing. */
export function aplusPlanItem(est: ClientEstimates): UnrankedPlanItem | null {
  const figure = lineFromListings(est, "aplus");
  if (!figure || figure.status === "none") return null;
  const mid = figure.range?.mid ?? 0;
  if (!(mid > 0) && figure.priced >= figure.listings) return null;
  const total = Math.max(est.byListing.size, figure.listings);
  return {
    id: APLUS_ROW_ID,
    kind: "signal",
    label: "Weak or missing A+ content",
    percent: formatPct((100 * figure.listings) / total),
    ratio: formatRatio(figure.listings, total),
    tone: null,
    statusLabel: RECOMMENDED_LABEL,
    fact: `${formatRatio(figure.listings, total)} listings have weak or missing A+ content.`,
    action: aplusActionText(figure.listings),
    needsAction: true,
    noReading: false,
    loading: false,
    partial: null,
    open: { spokeId: "specs", tab: "Amazon A+ Matrix" },
    siteType: null,
    pages: [],
    evidence: null,
    categories: [],
    // Listings with weak or missing A+ of the listings estimated; catalog content (M, 21g).
    inputs: {
      affected: figure.listings,
      base: total,
      unit: "listings",
      monthly: fixRowMonthly(APLUS_ROW_ID, est),
      effort: "M",
      dependsOn: [],
      tier: "action",
    },
  };
}

/**
 * The plan with the A+ row added and every item ranked again by the central rule, so the row
 * takes the place its own inputs give it. Returns the plan unchanged when the row does not apply.
 */
export function planWithAplus(plan: readonly PlanItem[], est: ClientEstimates | null): readonly PlanItem[] {
  const row = est ? aplusPlanItem(est) : null;
  if (!row || plan.some((item) => item.id === APLUS_ROW_ID)) return plan;
  return rankPlan([...plan, row]);
}
