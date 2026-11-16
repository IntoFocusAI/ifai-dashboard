/**
 * Portfolio Retail readings from stored rows.
 * A missing read stays missing. A stored zero stays zero. An unfinished audit stays incomplete.
 * Fender's seller type is an internal rank only. It is not a client-facing label.
 */

import { tabSlug } from "../canvas-sdk/canvas-url-state";
import { readFailureTip } from "./canvas-reads";
import type { CanvasReadFailure } from "./types";
import {
  buyBoxSellerCensus,
  controlledBuyBoxFinding,
  type BuyBoxSellerCensus,
  type ControlledBuyBoxDetail,
} from "./consensus-scores";
import { catalogDivisionCensus, type DivisionCensus } from "./division-census";
import {
  countFeaturedOffer,
  FEATURED_OFFER_COLUMNS,
  type FeaturedOfferCounts,
  type FeaturedOfferRow,
} from "./featured-offer";
import {
  classificationCoverageSentence,
  confirmedSuppressionSentence,
  FEATURED_OFFER_UNAVAILABLE,
  featuredOfferHeadlineCount,
  featuredOfferHeadlineLabel,
  firstPassIncomplete,
} from "./featured-offer-copy";
import { brandName, isFenderClient } from "@/lib/brand-copy";
import type { PartialFigure } from "./canvas-reads";
import { combineStale, RECHECK_DAYS, rowsStale } from "./row-stale";

export type RetailReadingStatus =
  | "available_with_issues"
  | "available_with_zero"
  | "incomplete"
  | "unavailable";

export type RetailReading<T> = {
  status: RetailReadingStatus;
  /** Null when this reading was never stored. Zero is a stored result, or a partial count on an incomplete read. */
  issueCount: number | null;
  /** Plain language for an incomplete or absent reading. Null when the reading is complete. */
  missingMessage: string | null;
  detail: T;
  /**
   * Client-facing name of the confirmed result this reading leads with, when the tab
   * label is too generic. Every copied surface uses this same label and count.
   */
  headlineLabel?: string;
  /** Noun for the count beside `headlineLabel`. */
  headlineNoun?: string;
  /**
   * X-25: set when part of this reading's population has its own check older than twice its
   * recheck interval. The figure carries an asterisk and this tooltip. Absent when whole.
   */
  stale?: PartialFigure | null;
};

/** The reading with its per-row stale reading attached (X-25). */
function withStale<T>(reading: RetailReading<T>, stale: PartialFigure | null): RetailReading<T> {
  return stale ? { ...reading, stale } : reading;
}

export type RetailFindingId = "suppressed_listings" | "map_leakage" | "unnested_bundles";

export const RETAIL_FINDING_LABELS = {
  suppressed_listings: "Suppressed Listings",
  map_leakage: "MAP Leakage",
  unnested_bundles: "Catalog Governance",
} as const satisfies Record<RetailFindingId, string>;

/** Fender rank. A confirmed zero is skipped. A missing or unfinished higher finding is not replaced. */
export const FENDER_RETAIL_HEADLINE_RANK: readonly RetailFindingId[] = [
  "suppressed_listings",
  "map_leakage",
  "unnested_bundles",
];

export type RetailHeadline = {
  findingId: RetailFindingId;
  label: (typeof RETAIL_FINDING_LABELS)[RetailFindingId];
  tabSlug: string;
  reading: RetailReading<unknown>;
};

const MAP_UNAVAILABLE = "MAP leakage has not been stored.";

/** Shown when the retail read has rows and none of them store a MAP price. */
export const MAP_PRICES_NOT_STORED = `${brandName()} MAP prices have not been stored.`;
const BUNDLE_UNAVAILABLE = "Catalog bundle parent ASINs have not been stored.";
const BUNDLE_OFFER_UNAVAILABLE = "Live offer readings have not been stored for bundle listings.";
const SPEC_UNAVAILABLE = "Amazon spec-field readings have not been stored.";

export const RETAIL_SUPPRESSION_COLUMNS = FEATURED_OFFER_COLUMNS;

export const RETAIL_MAP_LEAKAGE_COLUMNS =
  "asin,map_price,offer_price,amz_leakage,wmt_leakage,mf_leakage,featured_offer_checked_at,wmt_checked_at,mf_checked_at";

export const RETAIL_CATALOG_GOVERNANCE_COLUMNS =
  "asin,model_name,title,bundle_name,parent_asin,product_url,is_bundle,category,buybox_seller_name,buybox_seller_id,buybox_status,featured_offer_state,featured_offer_checked_at";

export const RETAIL_AMAZON_SPEC_COLUMNS =
  "asin,title,amazon_checked,amazon_missing_fields,checked_at";

function finite(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function countLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function unavailable<T>(message: string): RetailReading<T | null> {
  return { status: "unavailable", issueCount: null, missingMessage: message, detail: null };
}

export type SuppressionSupportRow = FeaturedOfferRow;

export type SuppressionDetail = {
  counts: FeaturedOfferCounts;
  /** Confirmed high-price suppression. Not every withheld listing. */
  suppressed: number;
  /** Listings with a current successful classification. The coverage numerator. */
  audited: number;
  /** The monitored retail population. The coverage denominator. */
  population: number;
  /** Checked listings with a positive outside benchmark. */
  withThreshold: number;
};

/**
 * The Featured Offer reading. Coverage is the share of the monitored population with a
 * current successful classification, so unchecked and failed listings stay in the
 * denominator instead of being hidden. The older `featured_offer_withheld` boolean on its
 * own is not coverage: the earlier collector wrote `false` whenever Keepa returned no flag.
 *
 * The headline count is confirmed high-price suppression when there is one, and the
 * confirmed withheld count otherwise. A withheld Featured Offer with no outside benchmark
 * is never called a price suppression.
 */
function suppressedListingsReading(
  rows: SuppressionSupportRow[] | null,
  options?: { truncated?: boolean; now?: number },
): RetailReading<SuppressionDetail | null> {
  if (rows == null) return unavailable(FEATURED_OFFER_UNAVAILABLE);

  const counts = countFeaturedOffer(rows, options?.now ?? Date.now());
  const detail: SuppressionDetail = {
    counts,
    suppressed: counts.confirmedHighPrice,
    audited: counts.current,
    population: counts.population,
    withThreshold: counts.benchmarkPresent,
  };

  if (counts.population === 0 && !options?.truncated) {
    return { status: "available_with_zero", issueCount: 0, missingMessage: null, detail };
  }

  if (counts.classified === 0 && !options?.truncated) {
    return { status: "unavailable", issueCount: null, missingMessage: FEATURED_OFFER_UNAVAILABLE, detail };
  }

  const issueCount = featuredOfferHeadlineCount(counts);
  const headlineLabel = featuredOfferHeadlineLabel(counts);

  if (options?.truncated || firstPassIncomplete(counts)) {
    const stopped = options?.truncated
      ? " The read stopped before every listing was loaded, so this is not a final count."
      : "";
    return {
      status: "incomplete",
      issueCount,
      missingMessage: `${confirmedSuppressionSentence(counts)} ${classificationCoverageSentence(counts)}${stopped}`,
      detail,
      headlineLabel,
      headlineNoun: "listing",
    };
  }

  // A finished zero keeps the client-facing label, so the name of this reading does not
  // swap to the tab title the moment the count clears.
  if (issueCount === 0) {
    return {
      status: "available_with_zero",
      issueCount: 0,
      missingMessage: null,
      detail,
      headlineLabel,
      headlineNoun: "listing",
    };
  }

  return {
    status: "available_with_issues",
    issueCount,
    missingMessage: null,
    detail,
    headlineLabel,
    headlineNoun: "listing",
  };
}

export type MapLeakageRow = {
  /** Selected by the live read. Optional on older fixtures; a row with no ASIN cannot be an approved exception. */
  asin?: string | null;
  map_price: number | string | null;
  offer_price: number | string | null;
  amz_leakage: number | string | null;
  wmt_leakage: number | string | null;
  mf_leakage: number | string | null;
  /** Amazon MAP price check time (the Featured Offer read). Per-row stale rule, X-25. */
  featured_offer_checked_at?: string | null;
  wmt_checked_at?: string | null;
  /** Musician's Friend is Fender only; Ledlenser rows never carry it. */
  mf_checked_at?: string | null;
};

export type MapLeakageDetail = {
  violations: number;
  decided: number;
  undecided: number;
  population: number;
  /** Mean of each violation's worst stored channel leakage, in dollars. Null when no leakage is stored. Not a revenue estimate. */
  averageLeakage: number | null;
  /**
   * Listings in the read set aside as "Approved exception" on the MAP check. They are left
   * out of every count above. Done and other set-aside reasons stay in.
   */
  approvedExceptions: number;
};

/** Upper-case trimmed ASIN, the key set-asides and MAP rows are matched on. */
export function mapAsinKey(asin: string | null | undefined): string | null {
  if (typeof asin !== "string") return null;
  const key = asin.trim().toUpperCase();
  return key ? key : null;
}

function channelLeakages(row: MapLeakageRow): number[] {
  return [row.amz_leakage, row.wmt_leakage, row.mf_leakage]
    .map((value) => finite(value))
    .filter((value): value is number => value != null);
}

function worstStoredLeakage(row: MapLeakageRow): number | null {
  const values = channelLeakages(row);
  if (!values.length) return null;
  return Math.min(...values);
}

function isMapViolation(row: MapLeakageRow): boolean {
  return channelLeakages(row).some((value) => value < 0);
}

function mapRowUndecided(row: MapLeakageRow): boolean {
  if (channelLeakages(row).length > 0) return false;
  return finite(row.offer_price) != null || finite(row.map_price) != null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A stored MAP price is a positive number. Null, zero, and a list price are not MAP. */
function storedMapPrice(value: unknown): number | null {
  const price = finite(value);
  if (price == null || price <= 0) return null;
  return price;
}

/**
 * Current MAP violations from stored channel leakage. Bundle fields are not an input.
 * Listings whose ASIN is in `approvedExceptions` are left out of the population, the
 * comparisons, the violations, and the average gap; the count of them is kept in the detail.
 */
function mapLeakageReading(
  allRows: MapLeakageRow[] | null,
  options?: { truncated?: boolean; approvedExceptions?: ReadonlySet<string> | null },
): RetailReading<MapLeakageDetail | null> {
  if (allRows == null) return unavailable(MAP_UNAVAILABLE);

  if (allRows.length > 0 && !allRows.some((row) => storedMapPrice(row.map_price) != null)) {
    return {
      status: "unavailable",
      issueCount: null,
      missingMessage: MAP_PRICES_NOT_STORED,
      detail: null,
    };
  }
  const exceptions = options?.approvedExceptions;
  const rows = exceptions?.size
    ? allRows.filter((row) => {
        const key = mapAsinKey(row.asin);
        return key == null || !exceptions.has(key);
      })
    : allRows;
  const approvedExceptions = allRows.length - rows.length;
  const population = rows.length;
  const violations = rows.filter(isMapViolation);
  const undecided = rows.filter(mapRowUndecided).length;
  const decided = rows.filter((row) => channelLeakages(row).length > 0).length;
  const averageLeakage =
    violations.length === 0
      ? null
      : roundMoney(
          violations.reduce((sum, row) => sum + (worstStoredLeakage(row) ?? 0), 0) / violations.length,
        );
  const detail: MapLeakageDetail = {
    violations: violations.length,
    decided,
    undecided,
    population,
    averageLeakage,
    approvedExceptions,
  };

  if (population === 0 && !options?.truncated) {
    return { status: "available_with_zero", issueCount: 0, missingMessage: null, detail };
  }

  if (decided === 0 && undecided === 0 && !options?.truncated) return unavailable(MAP_UNAVAILABLE);

  if (options?.truncated || undecided > 0) {
    const known =
      violations.length === 0
        ? "No below-MAP listing is confirmed in the stored rows."
        : `${countLabel(violations.length)} stored ${violations.length === 1 ? "listing is" : "listings are"} below MAP.`;
    const gaps =
      undecided > 0
        ? ` ${countLabel(undecided)} ${undecided === 1 ? "listing has" : "listings have"} a price and no stored MAP comparison, so ${undecided === 1 ? "it is" : "they are"} missing from this count and ${undecided === 1 ? "is" : "are"} not counted as zero.`
        : "";
    const stopped = options?.truncated
      ? " The read stopped before every listing was loaded."
      : "";
    return {
      status: "incomplete",
      issueCount: violations.length,
      missingMessage: `MAP leakage is stored for ${countLabel(decided)} of ${countLabel(population)} listings. ${known}${gaps}${stopped} This is not a final count.`,
      detail,
    };
  }

  if (violations.length === 0) {
    return { status: "available_with_zero", issueCount: 0, missingMessage: null, detail };
  }

  return {
    status: "available_with_issues",
    issueCount: violations.length,
    missingMessage: null,
    detail,
  };
}

export type CatalogBundleRow = {
  asin: string | null;
  model_name: string | null;
  title: string | null;
  bundle_name: string | null;
  parent_asin: string | null;
  product_url: string | null;
  is_bundle: boolean | null;
  category?: string | null;
  buybox_seller_name?: string | null;
  buybox_seller_id?: string | null;
  buybox_status?: string | null;
  /** Current Featured Offer state from the hourly listing read: present, withheld, or no_active_offer. */
  featured_offer_state?: string | null;
  /** When the Featured Offer state was observed. Per-row stale rule, X-25. */
  featured_offer_checked_at?: string | null;
};

/** Short label for the bundle population every bundle figure counts (R-13). */
export const LIVE_OFFER_BUNDLES = "bundles with a live offer";

export const LIVE_OFFER_RULE =
  "A bundle counts when Amazon's current listing read shows an offer for sale on it, with or without the Buy Box. Bundles with no active offer, or with no offer reading yet, are left out.";

/** Withheld still has an offer for sale, just no Buy Box. */
const LIVE_OFFER_STATES = new Set(["present", "withheld"]);

export function hasLiveOffer(row: Pick<CatalogBundleRow, "featured_offer_state">): boolean {
  const state = text(row.featured_offer_state)?.toLowerCase();
  return state != null && LIVE_OFFER_STATES.has(state);
}

export type UnnestedBundleReason = "missing_parent_asin" | "unusable_parent_asin";

export type UnnestedBundleOpportunity = {
  asin: string;
  modelOrTitle: string | null;
  bundleName: string | null;
  parentAsin: string | null;
  productUrl: string | null;
  category?: string | null;
  buyboxSellerName?: string | null;
  buyboxSellerId?: string | null;
  buyboxStatus?: string | null;
  justification: {
    isBundle: true;
    parentAsin: string | null;
    reason: UnnestedBundleReason;
  };
};

/** Cap a short table cell at 24 characters (21 + ellipsis when longer). */
function shortCell(value: string): string {
  return value.length <= 24 ? value : `${value.slice(0, 21)}...`;
}

/**
 * Who holds the Buy Box for a catalog-governance bundle row, in one cell.
 * A 3P holder shows its seller name, never "Partner".
 */
export function catalogBundleBuyBoxLabel(
  status: string | null | undefined,
  sellerName: string | null | undefined,
): string {
  const value = text(status);
  if (value === "Amazon 1P") return "Amazon";
  if (value === "No Active Offer") return "No active offer";
  return shortCell(text(sellerName) ?? "Unknown");
}

/** Amazon seller id shown under a 3P Buy Box holder, when stored. */
export function catalogBundleSellerIdLabel(
  status: string | null | undefined,
  sellerId: string | null | undefined,
): string | null {
  if (text(status) !== "3P Confirmed") return null;
  const id = text(sellerId);
  return id ? shortCell(id) : null;
}

/** Compact product-line label for a catalog-governance bundle row. */
export function catalogBundleLineLabel(category: string | null | undefined): string {
  const value = text(category);
  if (!value) return "Unknown";
  if (value === "Solid Body") return "Solid Body";
  if (value === "Electric Guitar Kits") return "Kits";
  if (value === "Hollow & Semi-Hollow Body") return "Hollow";
  return shortCell(value);
}

export type UnnestedBundleDetail = {
  /** Bundles with a live offer and no usable parent ASIN. */
  opportunities: UnnestedBundleOpportunity[];
  /** Bundles in this retail read with a live offer: the population every bundle figure counts (R-13). */
  bundlesInRead: number;
  /** Every listing flagged as a bundle in this retail read, with or without a live offer. Optional on fixtures. */
  flaggedInRead?: number;
  /** Flagged bundles in this read with no offer reading yet. Optional on fixtures. */
  offerUnread?: number;
  /** `canvas_metrics.catalog_bundles`: listings the whole catalog flags as bundles. */
  catalogBundles: number | null;
  /** The failed canvas_metrics read behind a missing `catalogBundles`. Optional on fixtures. */
  catalogBundlesFailure?: CanvasReadFailure | null;
};

/** The bundle figure's tooltip: what was counted, the live-offer rule, and the wider totals it was taken from. */
export function bundlePopulationTip(reading: RetailReading<UnnestedBundleDetail | null>): string | null {
  const detail = reading.detail;
  if (reading.issueCount == null || detail == null || detail.bundlesInRead <= 0) return null;
  const n = reading.issueCount;
  const m = detail.bundlesInRead;
  const flagged = detail.flaggedInRead;
  const unread = detail.offerUnread ?? 0;
  return [
    `${countLabel(n)} of ${countLabel(m)} ${LIVE_OFFER_BUNDLES} have no usable parent ASIN.`,
    LIVE_OFFER_RULE,
    flagged != null
      ? `${countLabel(flagged)} ${flagged === 1 ? "monitored listing" : "monitored listings"} ${flagged === 1 ? "is" : "are"} flagged as bundles${detail.catalogBundles != null ? `, out of ${countLabel(detail.catalogBundles)} the catalog flags` : ""}.`
      : null,
    unread > 0 ? `${countLabel(unread)} of them ${unread === 1 ? "has" : "have"} no offer reading yet.` : null,
    detail.catalogBundlesFailure
      ? `${readFailureTip(detail.catalogBundlesFailure)} The catalog's own bundle total is not shown.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** A parent ASIN can nest the bundle only when it is a different 10-character ASIN. */
export function usableParentAsin(parentAsin: string | null | undefined, asin: string): boolean {
  const parent = text(parentAsin)?.toUpperCase();
  const child = text(asin)?.toUpperCase();
  if (!parent || !child) return false;
  if (!/^[A-Z0-9]{10}$/.test(parent)) return false;
  return parent !== child;
}

function bundleReason(row: CatalogBundleRow): UnnestedBundleReason {
  return text(row.parent_asin) ? "unusable_parent_asin" : "missing_parent_asin";
}

export function unnestedBundleOpportunities(rows: CatalogBundleRow[]): UnnestedBundleOpportunity[] {
  const opportunities: UnnestedBundleOpportunity[] = [];
  for (const row of rows) {
    if (row.is_bundle !== true) continue;
    const asin = text(row.asin);
    if (!asin) continue;
    if (usableParentAsin(row.parent_asin, asin)) continue;
    const parentAsin = text(row.parent_asin);
    opportunities.push({
      asin,
      modelOrTitle: text(row.model_name) ?? text(row.title),
      bundleName: text(row.bundle_name),
      parentAsin,
      productUrl: text(row.product_url),
      category: text(row.category),
      buyboxSellerName: text(row.buybox_seller_name),
      buyboxSellerId: text(row.buybox_seller_id),
      buyboxStatus: text(row.buybox_status),
      justification: {
        isBundle: true,
        parentAsin,
        reason: bundleReason(row),
      },
    });
  }
  opportunities.sort((a, b) => a.asin.localeCompare(b.asin));
  return opportunities;
}

/**
 * A bundle with a live offer and no usable parent ASIN is an unnested-bundle opportunity (R-13).
 * Only bundles for sale now are counted; a title that matches a bundle is not enough.
 * A bundle with a usable parent is not a defect. Seller authorization is not classified here.
 */
function unnestedBundlesReading(
  rows: CatalogBundleRow[] | null,
  options?: { truncated?: boolean; catalogBundleCount?: number | null | CanvasReadFailure },
): RetailReading<UnnestedBundleDetail | null> {
  if (rows == null) return unavailable(BUNDLE_UNAVAILABLE);

  const bundleFlagStored = rows.some((row) => row.is_bundle === true || row.is_bundle === false);
  if (rows.length > 0 && !bundleFlagStored) return unavailable(BUNDLE_UNAVAILABLE);

  const flagged = rows.filter((row) => row.is_bundle === true && text(row.asin));
  if (flagged.length > 0 && !rows.some((row) => text(row.featured_offer_state) != null)) {
    return unavailable(BUNDLE_OFFER_UNAVAILABLE);
  }
  const live = flagged.filter(hasLiveOffer);
  const opportunities = unnestedBundleOpportunities(live);
  const count = options?.catalogBundleCount;
  const catalogBundlesFailure = count != null && typeof count === "object" ? count : null;
  const catalogBundles = typeof count === "number" && Number.isFinite(count) ? count : null;
  const detail: UnnestedBundleDetail = {
    opportunities,
    bundlesInRead: live.length,
    flaggedInRead: flagged.length,
    offerUnread: flagged.filter((row) => text(row.featured_offer_state) == null).length,
    catalogBundles,
    catalogBundlesFailure,
  };

  if (rows.length === 0 && !options?.truncated && catalogBundles == null) {
    return { status: "available_with_zero", issueCount: 0, missingMessage: null, detail };
  }

  if (rows.length === 0 && catalogBundles != null && catalogBundles > 0) {
    return {
      status: "incomplete",
      issueCount: 0,
      missingMessage: `The catalog read stores ${countLabel(catalogBundles)} bundle listings. This retail read did not include them, so zero unnested bundles is not a final result.`,
      detail,
    };
  }

  if (options?.truncated) {
    const known =
      opportunities.length === 0
        ? "No unnested bundle is confirmed in the included listings."
        : `${countLabel(opportunities.length)} of the included ${LIVE_OFFER_BUNDLES} ${opportunities.length === 1 ? "has" : "have"} no usable parent ASIN.`;
    return {
      status: "incomplete",
      issueCount: opportunities.length,
      missingMessage: `This read did not include the full bundle population. ${known} This is not a final count.`,
      detail,
    };
  }

  if (opportunities.length === 0) {
    return { status: "available_with_zero", issueCount: 0, missingMessage: null, detail };
  }

  return {
    status: "available_with_issues",
    issueCount: opportunities.length,
    missingMessage: null,
    detail,
  };
}

export type AmazonSpecRow = {
  asin: string | null;
  title: string | null;
  amazon_checked: boolean | null;
  amazon_missing_fields: string | null;
  /** When the spec read last checked this listing. Per-row stale rule, X-25. */
  checked_at?: string | null;
};

export type AmazonSpecGap = {
  asin: string;
  modelOrTitle: string | null;
  missingFields: string[];
};

export type AmazonSpecGapDetail = {
  gaps: AmazonSpecGap[];
  checked: number;
  unchecked: number;
};

/** Stored Amazon spec gaps, split on the semicolon list in the spec-readiness source. */
export function amazonMissingFields(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
}

function amazonSpecGapsReading(
  rows: AmazonSpecRow[] | null,
  options?: { truncated?: boolean },
): RetailReading<AmazonSpecGapDetail | null> {
  if (rows == null || rows.length === 0) return unavailable(SPEC_UNAVAILABLE);

  const gaps: AmazonSpecGap[] = [];
  let checked = 0;
  let unchecked = 0;
  for (const row of rows) {
    if (row.amazon_checked !== true) {
      unchecked += 1;
      continue;
    }
    checked += 1;
    const asin = text(row.asin);
    const missingFields = amazonMissingFields(row.amazon_missing_fields);
    if (!asin || missingFields.length === 0) continue;
    gaps.push({
      asin,
      modelOrTitle: text(row.title),
      missingFields,
    });
  }
  gaps.sort((a, b) => a.asin.localeCompare(b.asin));
  const detail: AmazonSpecGapDetail = { gaps, checked, unchecked };

  if (checked === 0) return unavailable(SPEC_UNAVAILABLE);

  if (options?.truncated || unchecked > 0) {
    return {
      status: "incomplete",
      issueCount: gaps.length,
      missingMessage: `Amazon spec fields are stored for ${countLabel(checked)} listings in this read. ${countLabel(unchecked)} ${unchecked === 1 ? "listing was" : "listings were"} not checked. Unchecked listings are missing from this count and are not counted as zero.`,
      detail,
    };
  }

  if (gaps.length === 0) {
    return { status: "available_with_zero", issueCount: 0, missingMessage: null, detail };
  }

  return {
    status: "available_with_issues",
    issueCount: gaps.length,
    missingMessage: null,
    detail,
  };
}


/** Buy Box state and suppression: every retail listing's own featured_offer_checked_at, daily. */
export function suppressedListingsFinding(
  rows: SuppressionSupportRow[] | null,
  options?: { truncated?: boolean; now?: number },
): RetailReading<SuppressionDetail | null> {
  const reading = suppressedListingsReading(rows, options);
  if (rows == null) return reading;
  return withStale(
    reading,
    rowsStale(
      rows,
      (row) => row.featured_offer_checked_at,
      { intervalDays: RECHECK_DAYS.buyBox, check: "Buy Box check", source: "canvas_retail_listings", figure: "Buy Box figures" },
      options?.now,
    ),
  );
}

/**
 * MAP leakage: Amazon prices carry featured_offer_checked_at (daily), Walmart wmt_checked_at
 * (daily for Fender, every 2 days for Ledlenser), Musician's Friend mf_checked_at (every 3 days).
 * Each channel counts the listings that have a stored comparison on it.
 */
export function mapLeakageFinding(
  allRows: MapLeakageRow[] | null,
  options?: { truncated?: boolean; approvedExceptions?: ReadonlySet<string> | null; now?: number },
): RetailReading<MapLeakageDetail | null> {
  const reading = mapLeakageReading(allRows, options);
  if (allRows == null) return reading;
  const exceptions = options?.approvedExceptions;
  const rows = exceptions?.size
    ? allRows.filter((row) => {
        const key = mapAsinKey(row.asin);
        return key == null || !exceptions.has(key);
      })
    : allRows;
  const channel = (
    label: string,
    leakage: (row: MapLeakageRow) => unknown,
    at: (row: MapLeakageRow) => string | null | undefined,
    intervalDays: number,
  ) => ({
    label,
    stale: rowsStale(
      rows.filter((row) => finite(leakage(row)) != null),
      at,
      { intervalDays, check: `${label} price check`, source: "canvas_retail_listings", figure: "MAP figures" },
      options?.now,
    ),
  });
  return withStale(
    reading,
    combineStale(
      [
        channel("Amazon", (row) => row.amz_leakage, (row) => row.featured_offer_checked_at, RECHECK_DAYS.buyBox),
        channel(
          "Walmart",
          (row) => row.wmt_leakage,
          (row) => row.wmt_checked_at,
          isFenderClient() ? RECHECK_DAYS.walmartFender : RECHECK_DAYS.walmartLedlenser,
        ),
        channel("Musician's Friend", (row) => row.mf_leakage, (row) => row.mf_checked_at, RECHECK_DAYS.musiciansFriend),
      ],
    ),
  );
}

/** Splintered Listings "for sale now": each live bundle's own featured_offer_checked_at, daily. */
export function unnestedBundlesFinding(
  rows: CatalogBundleRow[] | null,
  options?: { truncated?: boolean; catalogBundleCount?: number | null | CanvasReadFailure; now?: number },
): RetailReading<UnnestedBundleDetail | null> {
  const reading = unnestedBundlesReading(rows, options);
  if (rows == null) return reading;
  const live = rows.filter((row) => row.is_bundle === true && text(row.asin) && hasLiveOffer(row));
  return withStale(
    reading,
    rowsStale(
      live,
      (row) => row.featured_offer_checked_at,
      { intervalDays: RECHECK_DAYS.buyBox, check: "Buy Box check", source: "canvas_retail_listings", figure: "bundle figures" },
      options?.now,
    ),
  );
}

/** Amazon specs: each checked listing's own spec_readiness.checked_at, weekly. */
export function amazonSpecGapsFinding(
  rows: AmazonSpecRow[] | null,
  options?: { truncated?: boolean; now?: number },
): RetailReading<AmazonSpecGapDetail | null> {
  const reading = amazonSpecGapsReading(rows, options);
  if (rows == null || rows.length === 0) return reading;
  return withStale(
    reading,
    rowsStale(
      rows.filter((row) => row.amazon_checked === true),
      (row) => row.checked_at,
      { intervalDays: RECHECK_DAYS.weekly, check: "Amazon spec check", source: "canvas_spec_readiness", figure: "spec figures" },
      options?.now,
    ),
  );
}

export type PortfolioRetailFindings = {
  suppressedListings: RetailReading<SuppressionDetail | null>;
  mapLeakage: RetailReading<MapLeakageDetail | null>;
  unnestedBundles: RetailReading<UnnestedBundleDetail | null>;
  amazonSpecGaps: RetailReading<AmazonSpecGapDetail | null>;
  /**
   * Controlled Buy Box among known sellers, using the placeholder partner set
   * (Amazon Retail + Austin Bazaar + GearTree).
   * Null when the catalog governance read did not load. Unknown sellers are omitted.
   * Optional on older test fixtures; the live loader always sets it.
   * A saved partner list replaces this count on the client, using buyBoxSellers.
   */
  controlledBuyBox?: ControlledBuyBoxDetail | null;
  /**
   * Seller names in the Buy Box read, with listing counts.
   * Amazon Retail is a count, not a partner name. Null when that read did not load.
   * Optional on older fixtures; the live loader always sets it.
   */
  buyBoxSellers?: BuyBoxSellerCensus | null;
};

/**
 * The most important current retail finding for Fender.
 * Skip a confirmed zero. If a higher finding was never stored, or its audit is unfinished, return that reading.
 * Amazon 1P share, active-listing count, and unknown-seller percentage are not candidates.
 */
export function selectRetailHeadline(findings: PortfolioRetailFindings): RetailHeadline | null {
  const readings: Record<RetailFindingId, RetailReading<unknown>> = {
    suppressed_listings: findings.suppressedListings,
    map_leakage: findings.mapLeakage,
    unnested_bundles: findings.unnestedBundles,
  };

  for (const findingId of FENDER_RETAIL_HEADLINE_RANK) {
    const reading = readings[findingId];
    if (reading.status === "available_with_zero" && reading.issueCount === 0) continue;
    const label = RETAIL_FINDING_LABELS[findingId];
    return {
      findingId,
      label,
      tabSlug: tabSlug(label),
      reading,
    };
  }

  return null;
}

export type PagedRows<T> =
  | {
      ok: true;
      rows: T[];
      truncated: boolean;
    }
  | {
      ok: false;
    };

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/** Walk a listing read. A short page ends it. A full final page means the population was cut off. */
export async function readPages<T>(
  fetchPage: (page: number, size: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<PagedRows<T>> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await fetchPage(page, pageSize);
    if (error) return { ok: false };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return { ok: true, rows, truncated: false };
  }
  return { ok: true, rows, truncated: true };
}

export type RetailQuerySource = {
  suppressionRows: () => Promise<PagedRows<SuppressionSupportRow>>;
  mapRows: () => Promise<PagedRows<MapLeakageRow>>;
  catalogRows: () => Promise<PagedRows<CatalogBundleRow>>;
  /** The failure, not null, when the canvas_metrics read itself failed. */
  catalogBundleCount: () => Promise<number | null | CanvasReadFailure>;
  specRows: () => Promise<PagedRows<AmazonSpecRow>>;
};

export type PortfolioRetailSnapshot = PortfolioRetailFindings & {
  headline: RetailHeadline | null;
  /**
   * The stored MAP rows behind `mapLeakage`, kept so approved exceptions can be applied
   * when the MAP set-asides load or change. Null when that read failed. Optional on fixtures.
   */
  mapRead?: { rows: MapLeakageRow[]; truncated: boolean } | null;
  /** True when the MAP set-aside read failed, so no approved exception could be left out. */
  mapApprovedExceptionsFailed?: boolean;
  /** Buy Box holders per division from the catalog read. Null when that read failed. Optional on fixtures. */
  divisionCensus?: DivisionCensus | null;
};

export async function loadPortfolioRetailSnapshot(
  source: RetailQuerySource,
): Promise<PortfolioRetailSnapshot> {
  const [suppression, mapRows, catalog, catalogBundleCount, spec] = await Promise.all([
    source.suppressionRows(),
    source.mapRows(),
    source.catalogRows(),
    source.catalogBundleCount(),
    source.specRows(),
  ]);

  const catalogRows = catalog.ok ? catalog.rows : null;
  const findings: PortfolioRetailFindings = {
    suppressedListings: suppressedListingsFinding(suppression.ok ? suppression.rows : null, {
      truncated: suppression.ok ? suppression.truncated : false,
    }),
    mapLeakage: mapLeakageFinding(mapRows.ok ? mapRows.rows : null, {
      truncated: mapRows.ok ? mapRows.truncated : false,
    }),
    unnestedBundles: unnestedBundlesFinding(catalogRows, {
      truncated: catalog.ok ? catalog.truncated : false,
      catalogBundleCount,
    }),
    amazonSpecGaps: amazonSpecGapsFinding(spec.ok ? spec.rows : null, {
      truncated: spec.ok ? spec.truncated : false,
    }),
    controlledBuyBox: controlledBuyBoxFinding(catalogRows),
    buyBoxSellers: buyBoxSellerCensus(catalogRows),
  };

  return {
    ...findings,
    headline: selectRetailHeadline(findings),
    mapRead: mapRows.ok ? { rows: mapRows.rows, truncated: mapRows.truncated } : null,
    divisionCensus: catalogDivisionCensus(catalogRows),
  };
}
