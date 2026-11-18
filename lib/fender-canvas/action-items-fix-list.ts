/**
 * Action Items · Urgent Interventions fix list: the five current findings, ranked. The plan
 * (roadmap-plan.ts) appends the decision 21 actions after them and renders the table in React.
 */

import { add, ZERO } from "@/lib/estimates/line";
import type { ClientEstimates } from "@/lib/estimates/live-inputs";
import { PHASE_1_LINES } from "@/lib/estimates/rollup";
import type { EstimateLineId, EstimateRange, EstimateResult } from "@/lib/estimates/types";
import type { BriefingFinding, BriefingFindingId } from "@/lib/fender-canvas/briefing-retail-lead";

export const FIX_LIST_TITLE = "Fixes in priority order";

export const FIX_LIST_PRIORITY_RULE =
  "Critical findings come first, then at risk, then on track, then findings with no stored reading. Within a status, the finding that affects the larger share of its listings or answers comes first. For exact official product pages and Unbranded Discovery a higher share is better, so the share affected is the rest: listings without an exact page, and answers that do not lead with the brand. After the five findings come out-of-stock listings and missing Amazon spec fields, then the brand's own pages and listings when one of their factors is below Good, then the source, competitor, and fact-check actions, by the share of answers each affects. Then come the weakest engine and the weakest Unbranded Discovery questions that trail the best by 10 points or more, and the cited sites whose share moved by 10% or more against the 30 days before, each counted over the last 30 days with at least 30 answers behind the figure. Wording the brand's pages to match shopper questions comes next. Watch lines come last: the weakest engine and questions when they trail the best by less than 10 points.";

/** The A+ content row id (action-items-aplus-row.ts builds the row). */
export const APLUS_ROW_ID = "estimate:aplus";

export const FIX_ESTIMATE_LABEL = "analyst estimate";

/**
 * The estimate line behind each fix-list row (E4, decision 112). One line per row, so no dollar is
 * counted twice: missing specs sit on the spec row, and A+ content sits on its own row (Brian,
 * 18 Nov 2026), never on the own-pages row, which keeps its other factors. MAP leakage sits beside Phase 1, never in it. The
 * AI rows wait for the AI lines (chunk E5); line 6 waits for D-12.
 */
export const FIX_ROW_LINES: Readonly<Record<string, EstimateLineId>> = {
  "finding:buy_box": "buy_box",
  "finding:map_leakage": "map_leakage",
  "finding:splintered_bundles": "splintered",
  "signal:out_of_stock": "out_of_stock",
  "signal:missing_specs": "missing_specs",
  [APLUS_ROW_ID]: "aplus",
};

export type LineListingsEstimate = {
  lineId: EstimateLineId;
  /** The line itself, for its trail. */
  line: EstimateResult;
  /** The sum of the listings' parts. null when none of them has a sales figure. */
  range: EstimateRange | null;
  /** Listings the line touches, and those with a sales figure. */
  listings: number;
  priced: number;
  /** estimated: at least one listing priced. not_available: every listing Not available*. none: no listing touched. */
  status: "estimated" | "not_available" | "none";
  /** True when the line adds to Phase 1. */
  inPhase1: boolean;
};

/** A line's figure added from the shared per-listing parts (live-inputs byListing), with its trail. */
export function lineFromListings(est: ClientEstimates, lineId: EstimateLineId): LineListingsEstimate | null {
  const line = est.lines.find((entry) => entry.lineId === lineId);
  if (!line) return null;
  let range: EstimateRange | null = null;
  let listings = 0;
  let priced = 0;
  for (const entry of est.byListing.values()) {
    if (!(lineId in entry.lines)) continue;
    listings += 1;
    const part = entry.lines[lineId];
    if (part) {
      priced += 1;
      range = add(range ?? ZERO, part);
    }
  }
  return {
    lineId,
    line,
    range,
    listings,
    priced,
    status: listings === 0 ? "none" : priced === 0 ? "not_available" : "estimated",
    inPhase1: line.countsInTotal && PHASE_1_LINES.includes(lineId),
  };
}

/** The dollar on one fix-list row, or null for a row no estimate line covers yet. */
export function fixRowEstimate(itemId: string, est: ClientEstimates): LineListingsEstimate | null {
  const lineId = FIX_ROW_LINES[itemId];
  return lineId ? lineFromListings(est, lineId) : null;
}

/** Findings whose figure counts what is going well; the gap is the rest of the population. */
const HIGHER_IS_BETTER: ReadonlySet<BriefingFindingId> = new Set([
  "exact_official_product",
  "unbranded_discovery",
]);

export type FixStatus = "critical" | "at_risk" | "on_track" | "no_reading";

const STATUS: Record<FixStatus, { label: string; rank: number }> = {
  critical: { label: "Critical", rank: 0 },
  at_risk: { label: "At risk", rank: 1 },
  on_track: { label: "On track", rank: 2 },
  no_reading: { label: "No reading", rank: 3 },
};

export type FixListInput = {
  finding: BriefingFinding;
  action: string;
  stored: boolean;
};

export type FixListRow = FixListInput & {
  rank: number;
  status: FixStatus;
  statusLabel: string;
  /** Share of the population the problem touches, 0 to 1. Orders rows; never shown. */
  affectedShare: number | null;
  /** An analyst-estimate dollar the dashboard already computes for this finding, if any. */
  estimate: string | null;
};

function statusOf(input: FixListInput): FixStatus {
  if (!input.stored) return "no_reading";
  if (input.finding.tone === "danger") return "critical";
  if (input.finding.tone === "warning") return "at_risk";
  return "on_track";
}

function affectedShare({ finding, stored }: FixListInput): number | null {
  const { numerator, denominator } = finding;
  if (!stored || numerator == null || denominator == null || denominator <= 0) return null;
  const share = numerator / denominator;
  return HIGHER_IS_BETTER.has(finding.id) ? 1 - share : share;
}

/** Ranks by status, then by the larger share affected. Ties keep the briefing order. */
export function rankFixList(
  inputs: readonly FixListInput[],
  estimates: Partial<Record<BriefingFindingId, string>> = {},
): FixListRow[] {
  return inputs
    .map((input, order) => {
      const status = statusOf(input);
      const row = {
        ...input,
        rank: 0,
        status,
        statusLabel: STATUS[status].label,
        affectedShare: affectedShare(input),
        estimate: estimates[input.finding.id] ?? null,
      };
      return { row, order };
    })
    .sort(
      (a, b) =>
        STATUS[a.row.status].rank - STATUS[b.row.status].rank ||
        (b.row.affectedShare ?? -1) - (a.row.affectedShare ?? -1) ||
        a.order - b.order,
    )
    .map(({ row }, index) => ({ ...row, rank: index + 1 }));
}
