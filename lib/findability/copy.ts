import { formatInt } from "@/lib/fender-canvas/format";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import {
  countFindability,
  findabilityOutcome,
  presentOfficialAddress,
  type FindabilityBucket,
  type FindabilityOutcome,
  type FindabilityRow,
  type OutcomeCounts,
} from "@/lib/findability/outcomes";

export const OUTCOME_LABEL: Record<FindabilityOutcome, string> = {
  exact_official_product: "Exact official product page",
  official_family_page: "Official family page",
  completed_not_found: "No Defensible Page",
  ambiguous_candidate: "Ambiguous match",
  not_checked: "Unchecked",
};

export const OUTCOME_DEFINITION: Record<FindabilityOutcome, string> = {
  exact_official_product:
    "We found the fender.com page for this one product. An assistant can use that page's specs for this Amazon listing.",
  official_family_page:
    "We found a fender.com page for the whole line. Specs on it can belong to a different color or model.",
  completed_not_found:
    "We finished looking and did not accept a page. This does not prove the product is missing from fender.com.",
  ambiguous_candidate:
    "More than one fender.com page could fit, so we did not pick one.",
  not_checked:
    "This listing was not checked and should be opened for that reason. A blank result is not a missing page.",
};

const HEADLINE_NOUN: Record<FindabilityOutcome, [string, string]> = {
  exact_official_product: ["exact official product page", "exact official product pages"],
  official_family_page: ["official family page", "official family pages"],
  completed_not_found: ["No Defensible Page", "No Defensible Pages"],
  ambiguous_candidate: ["ambiguous match", "ambiguous matches"],
  not_checked: ["unchecked listing", "unchecked listings"],
};

export const MACHINE_READABILITY_POINTER =
  "Schema.org product data on each fender.com page is on Brand-Site Specs.";

export const DEALER_BUNDLE_NOTE =
  "Dealer bundle status comes from the retail read. It can line up with an official-page outcome. That is a correlation, not a proven cause.";

export const FAMILY_IS_NOT_EXACT = "A family page is not an exact product page.";

const OUTCOME_ORDER: FindabilityOutcome[] = [
  "exact_official_product",
  "official_family_page",
  "completed_not_found",
  "ambiguous_candidate",
  "not_checked",
];

function phrase(count: number, singular: string, plural: string): string {
  return `${formatInt(count)} ${count === 1 ? singular : plural}`;
}

/** The headline is each outcome count. It is not a single found percentage. */
export function findabilityHeadline(counts: OutcomeCounts): string {
  const parts = OUTCOME_ORDER.map((key) => {
    const [singular, plural] = HEADLINE_NOUN[key];
    return phrase(counts[key], singular, plural);
  });
  if (counts.other > 0) {
    parts.push(phrase(counts.other, "other result", "other results"));
  }
  if (parts.length === 1) return `${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(", ")}, and ${last}.`;
}

export type FindabilityRead =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; rows: FindabilityRow[]; dealerBundleLoaded: boolean };

export type FindabilityWidgetCopy = {
  value: string;
  detail: string;
};

const WIDGET_DETAIL: Array<{ key: FindabilityOutcome; singular: string; plural: string }> = [
  { key: "official_family_page", singular: "family page", plural: "family pages" },
  {
    key: "completed_not_found",
    singular: "No Defensible Page",
    plural: "No Defensible Pages",
  },
  { key: "ambiguous_candidate", singular: "ambiguous match", plural: "ambiguous matches" },
  { key: "not_checked", singular: "unchecked listing", plural: "unchecked listings" },
];

/**
 * Compact signal for the findability widget.
 * The value is the exact-page count. Family pages stay in the detail.
 * A missing, failed, or empty read stays a sentence, never a zero.
 */
export function findabilityWidgetCopy(read: FindabilityRead): FindabilityWidgetCopy {
  if (read.phase === "loading") {
    return { value: "Loading", detail: "Official-page outcomes are loading." };
  }
  if (read.phase === "error") {
    return { value: "Unavailable", detail: "The official-page read did not load." };
  }
  const counts = countFindability(read.rows);
  if (counts.total === 0) {
    return { value: "No listings", detail: "This official-page read has no listings." };
  }
  const parts = WIDGET_DETAIL.map(({ key, singular, plural }) => phrase(counts[key], singular, plural));
  if (counts.other > 0) parts.push(phrase(counts.other, "other result", "other results"));
  return {
    value: formatInt(counts.exact_official_product),
    detail: parts.join(", "),
  };
}

export function findabilityTourLine(read: FindabilityRead): string {
  if (read.phase !== "ready") {
    return "Official-page outcomes stay separate and load with the findability read";
  }
  const counts = countFindability(read.rows);
  if (counts.total === 0) return "This official-page read has no listings";
  return findabilityHeadline(counts);
}

export type ReadinessFace = {
  stats: string[];
  meta: string;
  tooltipTitle: string;
  tooltipDesc: string;
  /** Kept for call sites that still want counts; the map main spoke uses page-found heroValue instead. */
  heroValue?: { value: string; label: string };
};

/**
 * Official-page outcome counts for AI Readiness surfaces that still need them.
 * The map's main AI Readiness bubble leads with fender.com page found (see nodes-from-live /
 * pageFoundHero) — not these count pills — so ecommerce operators see one share figure.
 */
export function readinessFindabilityFace(
  read: FindabilityRead,
  amazonSpecsLabel: string,
): ReadinessFace {
  const amazonStat = `${amazonSpecsLabel} Amazon specs`;
  if (read.phase !== "ready") {
    return {
      stats: ["Official pages", amazonStat],
      meta: read.phase === "error" ? "Official-page read unavailable" : "Five outcomes loading",
      heroValue: {
        value: read.phase === "error" ? "Read unavailable" : "Loading",
        label: "Official-page outcomes",
      },
      tooltipTitle: "",
      tooltipDesc: "",
    };
  }
  const counts = countFindability(read.rows);
  if (counts.total === 0) {
    return {
      stats: ["0 listings", amazonStat],
      meta: "No rows in this read",
      heroValue: { value: "No listings", label: "Official-page outcomes" },
      tooltipTitle: "",
      tooltipDesc: "",
    };
  }
  const other = counts.other > 0 ? ` · ${formatInt(counts.other)} other` : "";
  return {
    stats: [
      `${formatInt(counts.exact_official_product)} exact`,
      `${formatInt(counts.official_family_page)} family`,
    ],
    meta: `${formatInt(counts.completed_not_found)} no page · ${formatInt(counts.ambiguous_candidate)} ambiguous · ${formatInt(counts.not_checked)} unchecked${other}`,
    tooltipTitle: "",
    tooltipDesc: "",
  };
}

export function bucketLabel(bucket: FindabilityBucket): string {
  return bucket === "other" ? "Other result" : OUTCOME_LABEL[bucket];
}

const PRODUCT_KIND: Record<string, string> = {
  instrument: "Instrument",
  part: "Part",
  pack: "Pack",
  case: "Case",
  strings: "Strings",
};

const CONFIDENCE: Record<string, string> = {
  sku: "SKU match",
  gtin: "GTIN match",
  variant_options: "Variant options",
  none: "No identifier match",
};

const SOURCE_METHOD: Record<string, string> = {
  derived_handle: "Derived handle",
  model_number_search: "Model number search",
  search_meta: "Search metadata",
};

export function productKindLabel(value: string | null): string {
  if (!value?.trim()) return "Not recorded";
  return PRODUCT_KIND[value] ?? value.replaceAll("_", " ");
}

export function confidenceLabel(value: string | null): string {
  if (!value?.trim()) return "Not recorded";
  return CONFIDENCE[value] ?? value.replaceAll("_", " ");
}

export function sourceMethodLabel(value: string | null): string {
  if (!value?.trim()) return "Not recorded";
  return SOURCE_METHOD[value] ?? value.replaceAll("_", " ");
}

export function httpStatusLabel(status: number | null, bucket: FindabilityBucket): string {
  if (bucket === "not_checked") return "Not checked";
  if (status == null) return "Not recorded";
  return String(status);
}

export function attemptLabel(iso: string | null, bucket: FindabilityBucket): string {
  if (bucket === "not_checked") return "Not checked yet";
  if (!iso?.trim()) return "Not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function dealerBundleLabel(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null) return "Not in this read";
  return "Not loaded";
}

export function presentExplanation(row: FindabilityRow): string {
  const stored = row.explanation?.trim();
  if (stored) return stored;
  return "None";
}

/** Why an unchecked listing was not checked. The first matching flag wins. */
export function uncheckedReason(row: FindabilityRow): string {
  if (row.counts_as_blocked === true) return "Blocked";
  if (row.counts_as_timeout === true) return "Timeout";
  if (row.counts_as_parse_failure === true) return "Parse failure";
  if (row.counts_as_unsupported === true) return "Unsupported";
  const stored = row.explanation?.trim() ?? "";
  if (!stored || stored === "None") return "Reason not recorded";
  return stored;
}

export function listingTitle(row: FindabilityRow): string {
  return row.title?.trim() || "No title stored";
}

export function findabilitySortValue(row: FindabilityRow, columnId: string): SortInput {
  const bucket = findabilityOutcome(row);
  const address = presentOfficialAddress(row);
  switch (columnId) {
    case "asin":
      return row.asin;
    case "title":
      return listingTitle(row);
    case "outcome":
      return bucketLabel(bucket);
    case "category":
      return row.category?.trim() || null;
    case "kind":
      return productKindLabel(row.product_kind);
    case "page":
      return address.kind === "link" ? address.href : address.text;
    case "sku":
      return row.latest_variant_sku?.trim() || null;
    case "confidence":
      return confidenceLabel(row.confidence);
    case "source":
      return sourceMethodLabel(row.source_method);
    case "http":
      return bucket === "not_checked" ? null : row.http_status;
    case "checked":
      return bucket === "not_checked" ? null : row.latest_attempt_at;
    case "explanation":
      return presentExplanation(row);
    case "reason":
      return uncheckedReason(row);
    case "bundle":
      return dealerBundleLabel(row.dealer_bundle);
    default:
      return null;
  }
}
