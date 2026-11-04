import { sanitizeUiText } from "@/lib/fender-canvas/format";
import type { ListingContentSummary } from "@/lib/fender-canvas/listing-content";
import type { SpecPageSummary } from "@/lib/fender-canvas/machine-readability";
import type {
  CanvasBundle,
  CanvasMetricsRow,
  CanvasReadFailure,
  CanvasReadKey,
} from "@/lib/fender-canvas/types";

export type BundleReadKey = Exclude<CanvasReadKey, "specPages" | "listingContent">;

export const CANVAS_READS: Record<CanvasReadKey, { source: string; label: string }> = {
  m: { source: "canvas_metrics", label: "Catalog metrics read" },
  cats: { source: "canvas_ai_category", label: "AI category read" },
  engines: { source: "canvas_ai_engine", label: "AI engine read" },
  sov: { source: "canvas_competitor_sov", label: "Competitor share-of-voice read" },
  divisions: { source: "canvas_divisions", label: "Catalog division read" },
  missing: { source: "canvas_spec_missing_fields", label: "Missing spec field read" },
  fresh: { source: "canvas_freshness", label: "Data freshness read" },
  specPages: { source: "canvas_spec_readiness", label: "fender.com page read" },
  listingContent: { source: "canvas_listing_content", label: "Amazon listing content read" },
};

export const BUNDLE_READ_KEYS: readonly BundleReadKey[] = [
  "m",
  "cats",
  "engines",
  "sov",
  "divisions",
  "missing",
  "fresh",
];

export const READ_NOT_AVAILABLE = "Not available*";

/** A read that has not answered by then counts as failed, so a hung view cannot hold the map on Loading. */
export const CANVAS_READ_TIMEOUT_MS = 20_000;

export function withReadTimeout<T>(read: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`it took longer than ${Math.round(ms / 1000)} seconds`)),
      ms,
    );
  });
  return Promise.race([Promise.resolve(read), limit]).finally(() => clearTimeout(timer));
}

/** Stands in for a failed canvas_metrics read so every metric formats as missing, not zero. */
export const EMPTY_METRICS_ROW: CanvasMetricsRow = {
  kpi: null,
  catalog_skus: null,
  catalog_bundles: null,
  seller_harvested: null,
  seller_harvested_pct: null,
  division_count: null,
  bb_total: null,
  bb_1p: null,
  bb_3p: null,
  bb_unharvested: null,
  bb_no_offer: null,
  bb_1p_pct: null,
  bb_3p_pct: null,
  bb_unharvested_pct: null,
  active_offer_coverage_pct: null,
  amz_below_map: null,
  amz_avg_drift: null,
  wmt_checked: null,
  wmt_leaks: null,
  mf_checked: null,
  mf_leaks: null,
  offamz_avg_leak: null,
  map_violation_skus: null,
  bundle_reviews: null,
  spec_checked: null,
  spec_avg_amazon_pct: null,
  spec_amazon_fields_found: null,
  spec_amazon_fields_expected: null,
  spec_fender_found: null,
  spec_fender_found_pct: null,
  spec_avg_fender_pct: null,
  spec_missing_additional_property: null,
  spec_missing_field_types: null,
  sim_total: null,
  sim_runs: null,
  sim_resolved: null,
  sim_wins: null,
  sim_win_pct: null,
  sim_unclear: null,
  sim_errors: null,
  sim_hallucinations: null,
  sim_hallucination_risk: null,
  weakest_category: null,
  weakest_win_pct: null,
  weakest_top_competitor: null,
  weakest_competitor_pct: null,
  weakest_sov_gap_pts: null,
  strongest_category: null,
  strongest_win_pct: null,
  strongest_wins: null,
  strongest_resolved: null,
};

/** What one Supabase read resolves to. */
export type CanvasReadResult = { data: unknown; error: unknown };

function errorMessage(reason: unknown): string | null {
  if (reason == null) return null;
  if (typeof reason === "string") return reason.trim() || null;
  if (typeof reason === "object" && "message" in reason) {
    const message = (reason as { message: unknown }).message;
    return typeof message === "string" && message.trim() ? message.trim() : null;
  }
  return null;
}

export function readFailure(key: CanvasReadKey, reason: unknown): CanvasReadFailure {
  return { key, ...CANVAS_READS[key], message: errorMessage(reason) };
}

/** Tooltip on a Not available* figure. Names the read and the view it asked for. */
export function readFailureTip(failure: CanvasReadFailure): string {
  const label = failure.label.charAt(0).toLowerCase() + failure.label.slice(1);
  const read = `The ${label} (${failure.source}) did not load`;
  if (!failure.message) return `${read}.`;
  const end = /[.!?]$/.test(failure.message) ? "" : ".";
  return sanitizeUiText(`${read}: ${failure.message}${end}`);
}

/** The tooltip for a figure built from `key`, or null when that read loaded. */
export function failedReadTip(bundle: CanvasBundle, key: CanvasReadKey): string | null {
  const failure = bundle.unavailable?.[key];
  return failure ? readFailureTip(failure) : null;
}

/** Every bundle read failed, or (for a partial load) the reads that did. */
export class CanvasReadError extends Error {
  readonly failures: CanvasReadFailure[];

  constructor(failures: CanvasReadFailure[], everyRead: boolean) {
    const sources = failures.map((failure) => failure.source).join(", ");
    const first = failures.find((failure) => failure.message)?.message;
    super(
      `${everyRead ? "No canvas read loaded" : "Some canvas reads did not load"} (${sources}).${
        first ? ` ${first}` : ""
      }`,
    );
    this.name = "CanvasReadError";
    this.failures = failures;
  }
}

function settledFailure(key: CanvasReadKey, settled: PromiseSettledResult<CanvasReadResult>) {
  if (settled.status === "rejected") return readFailure(key, settled.reason);
  if (settled.value.error) return readFailure(key, settled.value.error);
  if (key === "m" && settled.value.data == null) return readFailure(key, "The read returned no metrics row.");
  return null;
}

/**
 * Builds the bundle from each read on its own. A failed list read is empty and a failed
 * metrics read is an all-null row, and each is named in `unavailable`. Only when every
 * bundle read fails does this throw.
 */
export function assembleCanvasBundle(
  reads: Record<BundleReadKey, PromiseSettledResult<CanvasReadResult>>,
  pages: {
    specPages: PromiseSettledResult<SpecPageSummary>;
    listingContent: PromiseSettledResult<ListingContentSummary>;
  },
): CanvasBundle {
  const unavailable: Partial<Record<CanvasReadKey, CanvasReadFailure>> = {};
  const data = {} as Record<BundleReadKey, unknown>;
  for (const key of BUNDLE_READ_KEYS) {
    const failure = settledFailure(key, reads[key]);
    if (failure) unavailable[key] = failure;
    else data[key] = (reads[key] as PromiseFulfilledResult<CanvasReadResult>).value.data;
  }

  const failed = BUNDLE_READ_KEYS.filter((key) => unavailable[key]);
  if (failed.length === BUNDLE_READ_KEYS.length) {
    throw new CanvasReadError(failed.map((key) => unavailable[key]!), true);
  }

  if (pages.specPages.status === "rejected") {
    unavailable.specPages = readFailure("specPages", pages.specPages.reason);
  }
  if (pages.listingContent.status === "rejected") {
    unavailable.listingContent = readFailure("listingContent", pages.listingContent.reason);
  }

  const list = <T>(key: BundleReadKey) => (unavailable[key] ? [] : ((data[key] ?? []) as T[]));
  return {
    m: unavailable.m ? EMPTY_METRICS_ROW : (data.m as CanvasMetricsRow),
    cats: list("cats"),
    engines: list("engines"),
    sov: list("sov"),
    divisions: list("divisions"),
    missing: list("missing"),
    fresh: list("fresh"),
    specPages: pages.specPages.status === "fulfilled" ? pages.specPages.value : null,
    listingContent: pages.listingContent.status === "fulfilled" ? pages.listingContent.value : null,
    unavailable,
  };
}

export function bundleReadFailures(bundle: CanvasBundle): CanvasReadFailure[] {
  return Object.values(bundle.unavailable ?? {}).filter(
    (failure): failure is CanvasReadFailure => failure != null,
  );
}

/**
 * A piece that failed on this refresh keeps its last good value, so a figure the
 * map already showed does not drop to Not available* on one bad refresh. `stale`
 * is true when any piece came from the last good bundle.
 */
export function withLastGood(
  next: CanvasBundle,
  lastGood: CanvasBundle | null,
): { bundle: CanvasBundle; stale: boolean } {
  const failures = bundleReadFailures(next);
  if (!lastGood || failures.length === 0) return { bundle: next, stale: false };

  const bundle: CanvasBundle = { ...next, unavailable: { ...next.unavailable } };
  let stale = false;
  for (const { key } of failures) {
    if (lastGood.unavailable?.[key] || lastGood[key] == null) continue;
    Object.assign(bundle, { [key]: lastGood[key] });
    delete bundle.unavailable![key];
    stale = true;
  }
  return { bundle, stale };
}
