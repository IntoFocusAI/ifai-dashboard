import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { bucketLabel, OUTCOME_LABEL } from "@/lib/findability/copy";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import {
  FINDABILITY_OUTCOMES,
  type FindabilityBucket,
  type OutcomeCounts,
} from "@/lib/findability/outcomes";

/**
 * Exact-page share bands for the Findability exact-page hero figure.
 * Low share is the gap color (danger). Same traffic-light tokens as other leads.
 */
export const EXACT_PAGE_SHARE_BANDS = { redBelow: 25, greenAbove: 60 } as const;

/** Heroes shown for this read: the five outcomes, plus Other when present. */
export function findabilityLeadBuckets(counts: OutcomeCounts): FindabilityBucket[] {
  if (counts.other > 0) return [...FINDABILITY_OUTCOMES, "other"];
  return [...FINDABILITY_OUTCOMES];
}

function outcomeCount(counts: OutcomeCounts, bucket: FindabilityBucket): number {
  return counts[bucket];
}

/** Share of this outcome in the read, as a 0-100 percentage. Null when empty. */
export function outcomeSharePct(counts: OutcomeCounts, bucket: FindabilityBucket): number | null {
  if (counts.total <= 0) return null;
  return (100 * outcomeCount(counts, bucket)) / counts.total;
}

/** Large hero figure: share of this outcome. Empty reads invent no percentage. */
export function outcomeShareFigure(counts: OutcomeCounts, bucket: FindabilityBucket): string | null {
  const pct = outcomeSharePct(counts, bucket);
  if (pct == null) return null;
  return formatPct(pct);
}

/** N of M for the Findability hero. Empty reads never invent a zero figure. */
export function outcomeRatioFigure(counts: OutcomeCounts, bucket: FindabilityBucket): string | null {
  if (counts.total <= 0) return null;
  return formatRatio(outcomeCount(counts, bucket), counts.total);
}

/** Exact-page N of M. Prefer outcomeRatioFigure for other outcomes. */
export function exactPageFigure(counts: OutcomeCounts): string | null {
  return outcomeRatioFigure(counts, "exact_official_product");
}

/** Traffic-light color for the exact-page share. Null when there is no population. */
export function exactPageShareColor(counts: OutcomeCounts): string | null {
  const pct = outcomeSharePct(counts, "exact_official_product");
  if (pct == null) return null;
  if (pct < EXACT_PAGE_SHARE_BANDS.redBelow) return "var(--danger-red)";
  if (pct > EXACT_PAGE_SHARE_BANDS.greenAbove) return "var(--success-green)";
  return "var(--warning-amber)";
}

/**
 * Figure color for one Findability outcome hero.
 * Exact pages keep the share traffic light. Other outcomes use danger, warning,
 * or success tokens by outcome kind (not a new palette).
 */
export function outcomeShareColor(counts: OutcomeCounts, bucket: FindabilityBucket): string | null {
  if (counts.total <= 0) return null;
  if (bucket === "exact_official_product") return exactPageShareColor(counts);
  if (bucket === "official_family_page") return "var(--success-green)";
  if (bucket === "completed_not_found") return "var(--danger-red)";
  if (bucket === "ambiguous_candidate") return "var(--warning-amber)";
  if (bucket === "not_checked") return "var(--warning-amber)";
  return "var(--warning-amber)";
}

/**
 * Status (X-34) for one Findability outcome hero on the tab. Only the exact-page share is
 * graded, on EXACT_PAGE_SHARE_BANDS, so only it carries a status color, mark, and word. The
 * other outcomes are counts of a kind of result, not grades, and show in the plain figure color.
 */
export function outcomeShareTone(
  counts: OutcomeCounts,
  bucket: FindabilityBucket,
): Exclude<NodeStatus, "neutral"> | null {
  if (bucket !== "exact_official_product") return null;
  const pct = outcomeSharePct(counts, bucket);
  if (pct == null) return null;
  if (pct < EXACT_PAGE_SHARE_BANDS.redBelow) return "danger";
  if (pct > EXACT_PAGE_SHARE_BANDS.greenAbove) return "success";
  return "warning";
}

/** Pie slice key for this outcome so the disc uses an existing chart color. */
function outcomeSliceKey(bucket: FindabilityBucket): string {
  if (bucket === "exact_official_product") return "matched";
  if (bucket === "official_family_page") return "owned";
  if (bucket === "completed_not_found") return "contradicted";
  if (bucket === "ambiguous_candidate") return "community";
  if (bucket === "not_checked") return "other";
  return "other";
}

function outcomeLabel(bucket: FindabilityBucket): string {
  return bucket === "other" ? bucketLabel("other") : OUTCOME_LABEL[bucket];
}

/**
 * Disc of one outcome versus the rest of this read.
 * The outcome label comes from OUTCOME_LABEL so a later rename is picked up.
 */
export function outcomeLeadPie(counts: OutcomeCounts, bucket: FindabilityBucket): PieDiscData | null {
  if (counts.total <= 0) return null;
  const count = outcomeCount(counts, bucket);
  const rest = counts.total - count;
  if (count < 0 || rest < 0) return null;
  const label = outcomeLabel(bucket);
  return {
    id: `findability-${bucket}`,
    title: label,
    total: counts.total,
    totalLabel: "listings in this read",
    slices: [
      { key: outcomeSliceKey(bucket), label, count },
      { key: "none", label: "Rest of this read", count: rest },
    ].filter((slice) => slice.count > 0),
  };
}

/** Disc of exact official product pages versus the rest of this read. */
export function exactPageLeadPie(counts: OutcomeCounts): PieDiscData | null {
  return outcomeLeadPie(counts, "exact_official_product");
}

/** Plain N of M for the disc tip. */
export function outcomeLeadTip(counts: OutcomeCounts, bucket: FindabilityBucket): string {
  return `${formatInt(outcomeCount(counts, bucket))} of ${formatInt(counts.total)}`;
}

export function exactPageLeadTip(counts: OutcomeCounts): string {
  return outcomeLeadTip(counts, "exact_official_product");
}
