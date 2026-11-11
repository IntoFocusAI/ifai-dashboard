/**
 * Official-page outcomes for one stored findability read.
 * Exact pages, family pages, finished searches, ambiguous matches, and
 * unchecked listings stay separate. A later operational or conversational
 * view should import these functions instead of re-deriving the counts.
 */

export const FINDABILITY_OUTCOMES = [
  "exact_official_product",
  "official_family_page",
  "completed_not_found",
  "ambiguous_candidate",
  "not_checked",
] as const;

export type FindabilityOutcome = (typeof FINDABILITY_OUTCOMES)[number];

export type FindabilityBucket = FindabilityOutcome | "other";

/** One row from public.canvas_spec_findability, plus optional retail context. */
export type FindabilityRow = {
  asin: string;
  title: string | null;
  category: string | null;
  product_kind: string | null;
  latest_state: string | null;
  latest_canonical_url: string | null;
  latest_variant_sku: string | null;
  confidence: string | null;
  explanation: string | null;
  source_method: string | null;
  http_status: number | null;
  latest_attempt_at: string | null;
  jsonld_status: string | null;
  counts_as_confirmed: boolean | null;
  counts_as_finished_search: boolean | null;
  counts_as_ambiguous: boolean | null;
  counts_as_unchecked: boolean | null;
  counts_as_completed_not_found: boolean | null;
  counts_as_blocked: boolean | null;
  counts_as_timeout: boolean | null;
  counts_as_parse_failure: boolean | null;
  counts_as_unsupported: boolean | null;
  /**
   * Retail-read context. True or false when that read has the listing.
   * Null when the listing is absent there. Undefined when that read did not load.
   */
  dealer_bundle?: boolean | null;
  /** Brand-led clients only: the listing is on the brand's product sheet. Undefined for Fender. */
  on_brand_sheet?: boolean | null;
};

export type SheetSplitPart = { confirmed: number; total: number };
export type SheetSplit = { onSheet: SheetSplitPart; offSheet: SheetSplitPart };

/**
 * Official pages found, split by whether the listing is on the brand's product sheet.
 * Null when the read carries no sheet flag (Fender) or no listing is on the sheet.
 */
export function sheetSplit(rows: FindabilityRow[]): SheetSplit | null {
  const flagged = rows.filter((row) => typeof row.on_brand_sheet === "boolean");
  if (flagged.length === 0) return null;
  const part = (on: boolean): SheetSplitPart => {
    const group = flagged.filter((row) => row.on_brand_sheet === on);
    return { confirmed: group.filter((row) => row.counts_as_confirmed === true).length, total: group.length };
  };
  const onSheet = part(true);
  if (onSheet.total === 0) return null;
  return { onSheet, offSheet: part(false) };
}

export type OutcomeCounts = Record<FindabilityOutcome, number> & {
  other: number;
  total: number;
};

export type FindabilityShape = "empty" | "partial" | "complete";

export function emptyOutcomeCounts(): OutcomeCounts {
  return {
    exact_official_product: 0,
    official_family_page: 0,
    completed_not_found: 0,
    ambiguous_candidate: 0,
    not_checked: 0,
    other: 0,
    total: 0,
  };
}

/**
 * Unchecked wins over a blank address. A family page stays a family page
 * even when counts_as_confirmed is true. counts_as_finished_search covers
 * several outcomes, so it never decides the bucket by itself.
 */
export function findabilityOutcome(row: FindabilityRow): FindabilityBucket {
  const state = row.latest_state?.trim() || null;
  if (row.counts_as_unchecked === true || state === "not_checked" || state == null) {
    return "not_checked";
  }
  if (state === "exact_official_product") return "exact_official_product";
  if (state === "official_family_page") return "official_family_page";
  if (state === "ambiguous_candidate" || row.counts_as_ambiguous === true) return "ambiguous_candidate";
  if (state === "completed_not_found" || row.counts_as_completed_not_found === true) {
    return "completed_not_found";
  }
  return "other";
}

export function countFindability(rows: readonly FindabilityRow[]): OutcomeCounts {
  const counts = emptyOutcomeCounts();
  for (const row of rows) {
    counts[findabilityOutcome(row)] += 1;
    counts.total += 1;
  }
  return counts;
}

/** The five outcomes plus any other stored result equal the row count. */
export function outcomesSumToRows(counts: OutcomeCounts): boolean {
  const five = FINDABILITY_OUTCOMES.reduce((sum, key) => sum + counts[key], 0);
  return five + counts.other === counts.total;
}

export function findabilityShape(counts: OutcomeCounts): FindabilityShape {
  if (counts.total === 0) return "empty";
  const present = FINDABILITY_OUTCOMES.filter((key) => counts[key] > 0).length;
  return present === FINDABILITY_OUTCOMES.length ? "complete" : "partial";
}

export function rowsForOutcome(
  rows: readonly FindabilityRow[],
  outcome: FindabilityBucket,
): FindabilityRow[] {
  return rows.filter((row) => findabilityOutcome(row) === outcome);
}

export function officialHttpUrl(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.includes(".")) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export type OfficialAddress =
  | { kind: "link"; href: string }
  | { kind: "unchecked"; text: string }
  | { kind: "finished-without-page"; text: string }
  | { kind: "ambiguous"; text: string }
  | { kind: "no-address"; text: string };

/** A null address on an unchecked row is not a finished unsuccessful search. */
export function presentOfficialAddress(row: FindabilityRow): OfficialAddress {
  const outcome = findabilityOutcome(row);
  const href = officialHttpUrl(row.latest_canonical_url);
  if (outcome === "not_checked") {
    return { kind: "unchecked", text: "not checked" };
  }
  if (outcome === "completed_not_found") {
    return { kind: "finished-without-page", text: "not found" };
  }
  if (outcome === "ambiguous_candidate") {
    return { kind: "ambiguous", text: "not found" };
  }
  if (href) return { kind: "link", href };
  return { kind: "no-address", text: "not found" };
}

export function isFinishedWithoutPage(address: OfficialAddress): boolean {
  return address.kind === "finished-without-page";
}
