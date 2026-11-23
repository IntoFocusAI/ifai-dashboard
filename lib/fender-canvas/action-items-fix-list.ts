/**
 * Action Items · Urgent Interventions fix list: the five current findings, ranked. The plan
 * (roadmap-plan.ts) appends the decision 21 actions after them and renders the table in React.
 */

import { buyBoxForPeriod, buyBoxKnownMid } from "@/lib/estimates/buy-box";
import { add, ZERO } from "@/lib/estimates/line";
import { DEFAULT_PERIOD_DAYS } from "@/lib/estimates/period";
import type { ClientEstimates } from "@/lib/estimates/live-inputs";
import { PHASE_1_LINES } from "@/lib/estimates/rollup";
import type { EstimateLineId, EstimateRange, EstimateResult } from "@/lib/estimates/types";
import type { BriefingFinding, BriefingFindingId } from "@/lib/fender-canvas/briefing-retail-lead";
import { brandName } from "@/lib/brand-copy";
import {
  rankPriorities,
  severityOf,
  SEVERITY_FLOOR_SENTENCE,
  type Effort,
  type ItemCount,
  type RankInputs,
} from "@/lib/fender-canvas/priority-rank";
import { MONTHS_PER_YEAR } from "@/lib/estimates/monthly";

export const FIX_LIST_TITLE = "Fixes in priority order";

export const FIX_LIST_PRIORITY_RULE = `One ranking for every list: Priorities, this table, the Roadmap, the deck, and the map. Critical items come first, then At risk, then the rest. ${SEVERITY_FLOOR_SENTENCE} Within each, first by reach: the share of all resolved AI answers, or of all monitored listings, each gap touches, compared in whole percentage points. Ties go to the larger monthly analyst estimate, then to the smaller effort (small: a listing or offer fix; medium: catalog and site content; large: an outreach program). Items with no answer or listing count, such as verified links, follow the counted ones. Watch lines and findings on track follow the items that need action. Unbranded Discovery is the result every fix moves, so it is tracked last rather than ranked.`;

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
  /** The Not available* tooltip, when the line has its own (the Buy Box figure with no sales). */
  tip?: string;
};

/**
 * A line's figure added from the shared per-listing parts (live-inputs byListing), with its trail.
 * `keep` narrows it to some of the line's listings (a cause row); the trail is then the caller's.
 */
export function lineFromListings(
  est: ClientEstimates,
  lineId: EstimateLineId,
  keep?: (asin: string) => boolean,
): LineListingsEstimate | null {
  const line = est.lines.find((entry) => entry.lineId === lineId);
  if (!line) return null;
  let range: EstimateRange | null = null;
  let listings = 0;
  let priced = 0;
  for (const entry of est.byListing.values()) {
    if (!(lineId in entry.lines)) continue;
    if (keep && !keep(entry.asin)) continue;
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

/**
 * Rule 2: the row's estimate line, its yearly mid divided by 12. The Buy Box row reads the one Buy
 * Box figure over 30 days, R-06's monthly opportunity, or null when no priced listing has sales. Null
 * when no line covers the row or it has no range.
 */
export function fixRowMonthly(itemId: string, est: ClientEstimates | null): number | null {
  if (!est) return null;
  if (FIX_ROW_LINES[itemId] === "buy_box") return buyBoxKnownMid(buyBoxForPeriod(est, DEFAULT_PERIOD_DAYS));
  const figure = fixRowEstimate(itemId, est);
  return figure?.range ? figure.range.mid / MONTHS_PER_YEAR : null;
}

/** Findings whose figure counts what is going well; the gap is the rest of the population. */
const HIGHER_IS_BETTER: ReadonlySet<BriefingFindingId> = new Set([
  "exact_official_product",
  "unbranded_discovery",
]);

/**
 * What a higher-is-better finding's count counts, as the problem (its label counts what is going
 * well). Read per call, so the brand is the request's client.
 */
function problemLabel(id: BriefingFindingId): string | undefined {
  if (id === "exact_official_product") return "Listings without an exact official product page";
  if (id === "unbranded_discovery") return `Unbranded answers ${brandName()} did not lead`;
  return undefined;
}

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
  /** The central rank's inputs (priority-rank.ts). */
  inputs: RankInputs;
  status: FixStatus;
  statusLabel: string;
  /** Share of the population the problem touches, 0 to 1. Orders rows; never shown. */
  affectedShare: number | null;
  /** An analyst-estimate dollar the dashboard already computes for this finding, if any. */
  estimate: string | null;
  /** The row's one count (priority-rank.ts), the problem count its figure and reason show. */
  count: ItemCount | null;
};

function statusOf(input: FixListInput): FixStatus {
  if (!input.stored) return "no_reading";
  if (input.finding.tone === "danger") return "critical";
  if (input.finding.tone === "warning") return "at_risk";
  return "on_track";
}

/** Effort (rule 3) from 21g's work type: offer fixes are S, the official-page content is M. */
const FINDING_EFFORT: Record<BriefingFindingId, Effort> = {
  buy_box: "S",
  map_leakage: "S",
  splintered_bundles: "S",
  exact_official_product: "M",
  unbranded_discovery: "M",
};

/** A finding's rank inputs: the listings its gap touches, its estimate, its effort, its tier. */
export function findingRankInputs(input: FixListInput, status: FixStatus, est: ClientEstimates | null): RankInputs {
  const { finding, stored } = input;
  const { numerator, denominator } = finding;
  const counted = stored && numerator != null && denominator != null && denominator > 0;
  const affected = counted ? (HIGHER_IS_BETTER.has(finding.id) ? denominator - numerator : numerator) : null;
  const counts = problemLabel(finding.id);
  return {
    severity: severityOf(status),
    affected,
    base: counted ? denominator : null,
    unit: counted ? (finding.id === "unbranded_discovery" ? "answers" : "listings") : null,
    ...(counts ? { counts } : {}),
    monthly: fixRowMonthly(`finding:${finding.id}`, est),
    effort: FINDING_EFFORT[finding.id],
    dependsOn: [],
    tier: finding.id === "unbranded_discovery" ? "outcome" : status === "on_track" ? "on_track" : "action",
  };
}

function affectedShare({ finding, stored }: FixListInput): number | null {
  const { numerator, denominator } = finding;
  if (!stored || numerator == null || denominator == null || denominator <= 0) return null;
  const share = numerator / denominator;
  return HIGHER_IS_BETTER.has(finding.id) ? 1 - share : share;
}

/** The findings in the central order (priority-rank.ts), each on the common base. Ties keep the briefing order. */
export function rankFixList(
  inputs: readonly FixListInput[],
  est: ClientEstimates | null = null,
  estimates: Partial<Record<BriefingFindingId, string>> = {},
): FixListRow[] {
  const rows = inputs.map((input) => {
    const status = statusOf(input);
    return {
      ...input,
      rank: 0,
      inputs: findingRankInputs(input, status, est),
      status,
      statusLabel: STATUS[status].label,
      affectedShare: affectedShare(input),
      estimate: estimates[input.finding.id] ?? null,
    };
  });
  // The same ranking every list reads; each row gains its one count (label and partial from the finding).
  return rankPriorities(rows.map((row) => ({ ...row, label: row.finding.label, partial: row.finding.partial })));
}
