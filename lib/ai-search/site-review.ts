/**
 * Staff "Sites to review" list (decision 21a). The cited sites whose AI site type is under the
 * confidence threshold (needs_review in public.canvas_site_types), so IntoFocus staff can
 * confirm the type or pick another. Saving writes one staff override through
 * public.site_type_override; the override wins over the classifier, so the row leaves the list.
 *
 * Browser-safe: no server reads here. The page reads in site-review-read.ts.
 */

import { STORED_SITE_TYPES, type StoredSiteType } from "@/lib/ai-search/site-types";
import { formatInt } from "@/lib/fender-canvas/format";

export const SITES_TO_REVIEW_PATH = "/dashboard/sites-to-review";
export const SITES_TO_REVIEW_TABLE = "sites-to-review";

/** Plain names for the eight stored types, in the spec's order. */
export const SITE_TYPE_LABELS: Record<StoredSiteType, string> = {
  brand_owned: "Brand-owned",
  retailer: "Retailer",
  publication: "Publication or review",
  community: "Community or forum",
  video: "Video",
  competitor_brand: "Competitor brand",
  reference: "Reference",
  other: "Other",
};

export function isStoredSiteType(value: unknown): value is StoredSiteType {
  return typeof value === "string" && (STORED_SITE_TYPES as readonly string[]).includes(value);
}

/** One flagged site as the list shows it. */
export type ReviewRow = {
  domain: string;
  siteType: StoredSiteType;
  confidence: number;
  /** The classifier's one-line reason. Null until the staff read function is applied. */
  reason: string | null;
  /** True when the flagged answer is the global row, so the override is global too. */
  isGlobal: boolean;
  /** AI answers in the published run that cite this site. Null when that read failed. */
  answers: number | null;
};

/** A row of canvas_site_types or of site_types_to_review, before it is checked. */
export type RawReviewRow = Record<string, unknown>;

function cleanDomain(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/^www\./, "") : "";
}

/**
 * The list filter. Keeps AI rows flagged needs_review with a known type and a confidence, drops
 * staff and seed rows and any domain staff already decided in this visit, and sorts lowest
 * confidence first. Rows from site_types_to_review carry no needs_review or source column; the
 * function returns flagged AI rows only, so `fromStaffRead` skips those two checks.
 */
export function reviewRows(
  raw: readonly RawReviewRow[],
  options: { fromStaffRead: boolean; decided?: ReadonlySet<string>; answers?: ReadonlyMap<string, number> | null },
): ReviewRow[] {
  const seen = new Set<string>();
  const rows: ReviewRow[] = [];
  for (const row of raw) {
    const domain = cleanDomain(row?.domain);
    if (!domain || seen.has(domain) || options.decided?.has(domain)) continue;
    if (!isStoredSiteType(row.site_type)) continue;
    if (!options.fromStaffRead && (row.needs_review !== true || row.source !== "ai")) continue;
    const confidence = typeof row.confidence === "number" ? row.confidence : Number(row.confidence);
    if (row.confidence == null || !Number.isFinite(confidence)) continue;
    seen.add(domain);
    const reason = typeof row.reason === "string" && row.reason.trim() ? row.reason.trim().split("\n")[0] : null;
    rows.push({
      domain,
      siteType: row.site_type,
      confidence,
      reason,
      isGlobal: options.fromStaffRead ? row.is_global === true : false,
      answers: options.answers ? (options.answers.get(domain) ?? 0) : null,
    });
  }
  return rows.sort((a, b) => a.confidence - b.confidence || a.domain.localeCompare(b.domain));
}

/** Answers that cite each listed domain or one of its subdomains (uk.fender.com counts for fender.com). */
export function answersByDomain(
  cited: readonly { domain: string; simulationId: string }[],
  domains: readonly string[],
): Map<string, number> {
  const wanted = new Set(domains);
  const sets = new Map<string, Set<string>>();
  for (const row of cited) {
    const labels = row.domain.split(".");
    for (let i = 0; i <= labels.length - 2; i += 1) {
      const key = labels.slice(i).join(".");
      if (!wanted.has(key)) continue;
      const set = sets.get(key) ?? new Set<string>();
      set.add(row.simulationId);
      sets.set(key, set);
    }
  }
  return new Map(domains.map((domain) => [domain, sets.get(domain)?.size ?? 0]));
}

/** The arguments public.site_type_override takes. */
export type OverridePayload = {
  p_domain: string;
  p_client_key: string | null;
  p_site_type: StoredSiteType;
  p_note: string | null;
};

export type OverrideInput = {
  domain: string;
  clientKey: string;
  siteType: string;
  /** The flagged answer is the global row: the override is global too (same level, per the spec). */
  isGlobal: boolean;
  /** The AI type on screen, so a confirm is recorded as one. */
  aiType: string;
};

/** Checks one save and builds the function's arguments. Null when the input is not a valid save. */
export function overridePayload(input: OverrideInput): OverridePayload | null {
  const domain = cleanDomain(input.domain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  if (!isStoredSiteType(input.siteType)) return null;
  const clientKey = input.clientKey.trim();
  if (!input.isGlobal && !/^[a-z0-9_]+$/.test(clientKey)) return null;
  const aiType = isStoredSiteType(input.aiType) ? input.aiType : null;
  const note =
    aiType === input.siteType
      ? "Confirmed the AI type on Sites to review."
      : `Changed from ${aiType ? SITE_TYPE_LABELS[aiType] : "the AI type"} on Sites to review.`;
  return {
    p_domain: domain,
    p_client_key: input.isGlobal ? null : clientKey,
    p_site_type: input.siteType,
    p_note: note,
  };
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export const SITES_TO_REVIEW_HEADER = ["Site", "AI type", "Confidence", "Reason", "AI answers citing it"] as const;

/** One row as the CSV writes it. Columns the page does not show are left out by the caller. */
export function reviewCells(row: ReviewRow): string[] {
  return [
    row.domain,
    SITE_TYPE_LABELS[row.siteType],
    formatConfidence(row.confidence),
    row.reason ?? "",
    row.answers == null ? "" : formatInt(row.answers),
  ];
}
