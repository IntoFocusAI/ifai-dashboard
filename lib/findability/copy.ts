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
import { brandSite } from "@/lib/brand-copy";

export const OUTCOME_LABEL: Record<FindabilityOutcome, string> = {
  exact_official_product: "Exact official product page",
  official_family_page: "Official family page",
  completed_not_found: "No Defensible Page",
  ambiguous_candidate: "Ambiguous match",
  not_checked: "Unchecked",
};

export const OUTCOME_DEFINITION: Record<FindabilityOutcome, string> = {
  get exact_official_product() {
    return `We found the ${brandSite()} page for this one product. An assistant can use that page's specs for this Amazon listing.`;
  },
  get official_family_page() {
    return `We found a ${brandSite()} page for the whole line. Specs on it can belong to a different color or model.`;
  },
  get completed_not_found() {
    return `We finished looking and did not accept a page. This does not prove the product is missing from ${brandSite()}.`;
  },
  get ambiguous_candidate() {
    return `More than one ${brandSite()} page could fit, so we did not pick one.`;
  },
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

export function machineReadabilityPointer(): string {
  return `Schema.org product data on each ${brandSite()} page is on Brand-Site Specs.`;
}

/** Bundle header tooltip (decision 104). */
export const DEALER_BUNDLE_NOTE =
  "Yes when this Amazon listing is a dealer bundle: the product sold together with extras such as a strap, cable or case. Bundles often have no matching page on your own site, which is one reason a listing may show no official page.";

export const BUNDLE_HEADER = "Bundle";

/** The explanation at the top of the Findability tab (decision 104). */
export const FINDABILITY_INTRO =
  "Findability: for each product you sell on Amazon, can AI assistants find the matching page on your own website? When they can, they cite you. When the page is missing or doesn't match, they cite retailers or competitors instead.";

/** Header tooltip for the Confidence column. */
export const CONFIDENCE_HEADER_NOTE =
  "How sure we are that the page we found is the same product as the Amazon listing. Same SKU: the page carries the same SKU as the listing. Same barcode: the page carries the same barcode. Same options: the color, size or other options match, but no SKU or barcode did. No ID match: no SKU, barcode or options matched.";

export const DEALER_BUNDLE_NOT_LOADED = "Dealer bundle status did not load with this read.";

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
  sku: "Same SKU",
  gtin: "Same barcode",
  variant_options: "Same options",
  none: "No ID match",
};

const SOURCE_METHOD: Record<string, string> = {
  derived_handle: "Built from product name",
  model_number_search: "Site search by model number",
  search_meta: "Site search by product name",
};

/** Plain meaning of how the page was found, for the Confidence cell tooltip. */
const SOURCE_METHOD_MEANING: Record<string, string> = {
  derived_handle: "We found the page by building its address from the product name.",
  model_number_search: "We found the page by searching your site for the model number.",
  search_meta: "We found the page by searching your site for the product name.",
};

/** What each Confidence value means, first sentence of the Confidence cell tooltip. */
const CONFIDENCE_MEANING: Record<string, string> = {
  sku: "Your page lists the same SKU as this Amazon listing.",
  gtin: "Your page lists the same barcode (UPC or EAN) as this Amazon listing.",
  variant_options:
    "Your page offers the same options, such as color and size, but shows no matching SKU or barcode.",
  none: "No page on your site carries this listing's SKU or barcode.",
};

/** Confidence cell tooltip body: what the value means, then how the page was found. */
export function confidenceTooltip(confidence: string | null, sourceMethod: string | null): string {
  const meaning = (confidence && CONFIDENCE_MEANING[confidence]) || "";
  return [meaning, sourceMethodMeaning(sourceMethod)].filter(Boolean).join(" ");
}

export function sourceMethodMeaning(value: string | null): string {
  return (value && SOURCE_METHOD_MEANING[value]) || "";
}

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
