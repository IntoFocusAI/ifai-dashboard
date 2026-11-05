/**
 * The reason the fender.com spec read stored on a not-found row, in plain words.
 * The collector writes fender_missing_fields as
 *   "not_found: <code> (<page>:<result> | <page>:<result> | ...)"
 * and cuts the value at 600 characters, so a long list of tried pages can end mid-entry.
 * Each known code maps to one plain reason; the tried pages only feed a count in the
 * reason's tooltip. An unknown code is not a reason, so the row falls back to its
 * Findability result.
 */

export type StoredReasonCode =
  | "no_matching_model"
  | "candidate_page_missing"
  | "lacks_this_sku"
  | "lacks_part_number"
  | "page_not_read";

export type StoredNotFoundReason = {
  code: StoredReasonCode;
  label: string;
  definition: string;
  /** fender.com pages the read tried. Null when the value lists none. */
  pagesChecked: number | null;
  /** True when the stored list was cut short, so pagesChecked is a floor. */
  pagesCut: boolean;
};

export const STORED_REASONS: Record<StoredReasonCode, { label: string; definition: string }> = {
  no_matching_model: {
    label: "No matching fender.com product page",
    definition: "fender.com search returned product pages, but none was for this model.",
  },
  candidate_page_missing: {
    label: "Matching fender.com page is missing",
    definition: "fender.com search pointed to a page for this model, but that page does not exist on fender.com.",
  },
  lacks_this_sku: {
    label: "Matching page has no variant for this SKU",
    definition: "fender.com has a page for this model, but none of its variants matches this listing's SKU.",
  },
  lacks_part_number: {
    label: "Matching page does not list this part number",
    definition: "fender.com has a page for this model, but this listing's part number is not on it.",
  },
  page_not_read: {
    label: "fender.com page did not load",
    definition:
      "The fender.com page the Findability tab found did not load during the fender.com product check, and no fender.com search result matched this model.",
  },
};

/** The order stored reasons take in the reason filter, ahead of Findability results. */
export const STORED_REASON_ORDER: readonly StoredReasonCode[] = [
  "no_matching_model",
  "candidate_page_missing",
  "page_not_read",
  "lacks_this_sku",
  "lacks_part_number",
];

const COLLECTOR_CODES: Record<string, StoredReasonCode> = {
  search_results_no_matching_model: "no_matching_model",
  search_candidate_page_missing: "candidate_page_missing",
  search_page_lacks_this_sku: "lacks_this_sku",
  search_page_lacks_part_number: "lacks_part_number",
  findability_page_not_read: "page_not_read",
  "not_found_on_fender.com": "no_matching_model",
};

const NOT_FOUND = /not_found\s*:\s*([a-z0-9_.]+)\s*(?:\(([^)]*)(\))?)?/i;

function triedPages(detail: string | undefined): number | null {
  const pages = new Set(
    (detail ?? "")
      .split("|")
      .map((entry) => entry.trim().split(":")[0].trim())
      .filter(Boolean),
  );
  return pages.size > 0 ? pages.size : null;
}

function reason(code: StoredReasonCode, pagesChecked: number | null, pagesCut: boolean): StoredNotFoundReason {
  return { code, ...STORED_REASONS[code], pagesChecked, pagesCut };
}

/** The plain reason a not-found row stores, or null when it stores none this page knows. */
export function storedNotFoundReason(missingFields: string | null | undefined): StoredNotFoundReason | null {
  const value = (missingFields ?? "").trim();
  if (!value) return null;
  const match = NOT_FOUND.exec(value);
  if (match) {
    const code = COLLECTOR_CODES[match[1].toLowerCase()];
    if (!code) return null;
    const detail = match[2];
    return reason(code, triedPages(detail), detail !== undefined && !match[3]);
  }
  for (const token of value.split(";")) {
    const code = COLLECTOR_CODES[token.trim().toLowerCase()];
    if (code) return reason(code, null, false);
  }
  return null;
}

/** The short count for a reason's tooltip, e.g. "12 fender.com pages checked." */
export function pagesCheckedNote(stored: Pick<StoredNotFoundReason, "pagesChecked" | "pagesCut">): string | null {
  const count = stored.pagesChecked;
  if (count === null) return null;
  const pages = `${count} fender.com ${count === 1 ? "page" : "pages"} checked.`;
  return stored.pagesCut ? `At least ${pages}` : pages;
}

export function storedReasonTooltip(stored: StoredNotFoundReason): string {
  const note = pagesCheckedNote(stored);
  return note ? `${stored.definition} ${note}` : stored.definition;
}
