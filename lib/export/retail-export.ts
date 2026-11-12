import { specRowsQuery } from "@/lib/canvasData";
import { brandSite } from "@/lib/brand-copy";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import type { SourceRead } from "@/lib/export/types";
import { specGapFieldsCell } from "@/lib/fender-canvas/catalog-governance-findings";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatInt, formatPct, formatUsd } from "@/lib/fender-canvas/format";
import { loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import { contentStateLabel, loadListingContent } from "@/lib/fender-canvas/listing-content";
import { fieldLabel, loadSpecPages } from "@/lib/fender-canvas/machine-readability";
import { loadPageFoundEvidence } from "@/lib/fender-canvas/page-found-evidence";
import { notFoundReasons } from "@/lib/fender-canvas/page-found-reasons";
import {
  bundlePopulationTip,
  catalogBundleBuyBoxLabel,
  catalogBundleLineLabel,
  LIVE_OFFER_BUNDLES,
} from "@/lib/fender-canvas/portfolio-retail";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { specHero } from "@/lib/fender-canvas/retail-overview-lead";
import { defaultStockLossOrder, loadStockLossRows, lostSales, num } from "@/lib/fender-canvas/stock-loss";
import { presentMissingAmazonFields } from "@/lib/fender-canvas/spec-missing-fields";
import { specModelTitle, type CanvasSpecReadinessRow } from "@/lib/fender-canvas/types";
import { loadFindabilityRead, type FindabilityClient } from "@/lib/findability/queries";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

const STOCK_FAILED = "The stock history could not be loaded.";
const RETAIL_FAILED = "The retail read could not be loaded.";
const SPEC_FAILED = "The spec read could not be loaded.";
const CONTENT_FAILED = "The listing content read could not be loaded.";
const AWAITING = "Awaiting inputs";

function money(value: number | null): string {
  return value != null ? formatUsd(value) : AWAITING;
}

function missingFieldsCell(row: CanvasSpecReadinessRow): string {
  const missing = presentMissingAmazonFields(row.amazon_missing_fields, row.amazon_completeness_pct);
  return missing.kind === "fields" ? missing.fields.join(", ") : missing.label;
}

function days(value: number | null | undefined): string {
  const n = num(value);
  return n == null ? "" : String(n);
}

export async function loadStockSource(): Promise<SourceRead> {
  try {
    const [loaded, asOf] = await Promise.all([loadStockLossRows(), loadDashboardAsOf()]);
    if (!loaded.available) return { ok: false, message: STOCK_FAILED };
    const rows = defaultStockLossOrder(loaded.rows);
    const population =
      loaded.populationCount != null
        ? `${formatInt(rows.length)} listings out of stock at least one day in the last 12 months, of ${formatInt(loaded.populationCount)} monitored listings.`
        : `${formatInt(rows.length)} listings out of stock at least one day in the last 12 months.`;
    return {
      ok: true,
      source: {
        table: "stock-loss",
        header: [
          "Listing",
          "ASIN",
          "Est. lost sales, 12 months",
          "Est. lost sales, 90 days",
          "Est. lost sales, 30 days",
          "Out-of-stock days, 12 months",
          "Sales per in-stock day",
          "No Buy Box days, 12 months",
        ],
        rows: rows.map((row) => ({
          key: row.asin,
          cells: [
            (row.title ?? row.asin).trim(),
            row.asin,
            money(lostSales(row, 365)),
            money(lostSales(row, 90)),
            money(lostSales(row, 30)),
            days(row.oos_days_365),
            row.revenue_source ? money(num(row.baseline_daily_revenue)) : AWAITING,
            days(row.no_buy_box_days_365),
          ],
        })),
        filter: "Out of stock at least one day in the last 12 months.",
        sort: "Larger 12-month estimate first, then awaiting inputs by out-of-stock days.",
        population,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: STOCK_FAILED };
  }
}

export async function loadCatalogBundlesSource(): Promise<SourceRead> {
  try {
    const [snapshot, asOf] = await Promise.all([loadPortfolioRetailSnapshot(), loadDashboardAsOf()]);
    const reading = snapshot.unnestedBundles;
    if (!reading.detail) return { ok: false, message: reading.missingMessage ?? RETAIL_FAILED };
    const rows = reading.detail.opportunities;
    return {
      ok: true,
      source: {
        table: "catalog-bundles",
        header: ["Listing", "ASIN", "Buy Box", "Line"],
        rows: rows.map((row) => ({
          key: row.asin,
          cells: [
            row.modelOrTitle ?? "Listing",
            row.asin,
            catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName),
            catalogBundleLineLabel(row.category),
          ],
        })),
        filter: null,
        sort: "Retail read order.",
        population: bundlePopulationTip(reading) ?? `${formatInt(rows.length)} ${LIVE_OFFER_BUNDLES}.`,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: RETAIL_FAILED };
  }
}

export async function loadCatalogSpecGapsSource(): Promise<SourceRead> {
  try {
    const [snapshot, asOf] = await Promise.all([loadPortfolioRetailSnapshot(), loadDashboardAsOf()]);
    const reading = snapshot.amazonSpecGaps;
    const gaps = reading.detail?.gaps;
    if (!gaps) return { ok: false, message: reading.missingMessage ?? SPEC_FAILED };
    const hero = specHero(snapshot);
    return {
      ok: true,
      source: {
        table: "catalog-spec-gaps",
        header: ["Listing", "ASIN", "Fields"],
        rows: gaps.map((gap) => ({
          key: gap.asin,
          cells: [gap.modelOrTitle ?? "Listing", gap.asin, specGapFieldsCell(gap.missingFields)],
        })),
        filter: null,
        sort: "Retail read order.",
        population: hero.tip ?? hero.explainer,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: RETAIL_FAILED };
  }
}

export async function loadSpecReadinessSource(): Promise<SourceRead> {
  try {
    const [loaded, asOf] = await Promise.all([
      loadFilteredPages(async (page, size) => {
        const result = await specRowsQuery(page, size);
        return { data: (result.data ?? []) as CanvasSpecReadinessRow[], error: result.error, count: result.count };
      }),
      loadDashboardAsOf(),
    ]);
    if (loaded.error) return { ok: false, message: SPEC_FAILED };
    return {
      ok: true,
      source: {
        table: "spec-readiness",
        header: ["ASIN", "Model", "Amazon completeness", "Missing Amazon fields"],
        rows: loaded.rows.map((row) => ({
          key: row.asin,
          cells: [row.asin, specModelTitle(row.title), formatPct(row.amazon_completeness_pct), missingFieldsCell(row)],
        })),
        filter: null,
        sort: "Amazon completeness, lowest first.",
        population:
          loaded.total != null
            ? `${formatInt(loaded.rows.length)} of ${formatInt(loaded.total)} Amazon spec rows.`
            : `${formatInt(loaded.rows.length)} Amazon spec rows.`,
        asOf: asOf.asOf,
        setAsideCheck: SET_ASIDE_CHECKS.amazonSpecs,
      },
    };
  } catch {
    return { ok: false, message: SPEC_FAILED };
  }
}

export async function loadBrandSitePagesSource(): Promise<SourceRead> {
  try {
    const [summary, asOf] = await Promise.all([loadSpecPages(), loadDashboardAsOf()]);
    return {
      ok: true,
      source: {
        table: "machine-readability-pages",
        header: [`${brandSite()} page`, "Address", "Amazon listings", "Missing", "Checked"],
        rows: summary.pages.map((page) => ({
          key: page.url,
          cells: [
            page.model || `${brandSite()} page`,
            page.url,
            page.asins.join(" "),
            page.missingFields.map(fieldLabel).join(", "),
            formatCheckedAt(page.checkedAt) ?? "",
          ],
        })),
        filter: null,
        sort: "Most-linked pages first.",
        population: `${formatInt(summary.pages.length)} checked ${brandSite()} pages, linked to ${formatInt(summary.listings)} Amazon listings.`,
        asOf: asOf.asOf,
        setAsideCheck: SET_ASIDE_CHECKS.brandSiteSpecs,
      },
    };
  } catch {
    return { ok: false, message: SPEC_FAILED };
  }
}

export async function loadPageFoundSource(): Promise<SourceRead> {
  try {
    const [evidence, findability, asOf] = await Promise.all([
      loadPageFoundEvidence(),
      loadFindabilityRead(getCanvasSupabase() as unknown as FindabilityClient).catch(
        () => ({ phase: "error", message: "The Findability read failed." }) as const,
      ),
      loadDashboardAsOf(),
    ]);
    const reasons = notFoundReasons(evidence.rows, findability);
    return {
      ok: true,
      source: {
        table: "brand-site-page-found",
        header: ["Amazon listing", "Model", "Page found", `${brandSite()} page or reason`, "Checked"],
        rows: evidence.rows.map((row) => ({
          key: row.asin,
          cells: [
            row.asin,
            row.model ?? "",
            row.found ? "Found" : "Not found",
            row.found ? (row.pageHref ?? "Page address not recorded") : (reasons.get(row.asin)?.group ?? ""),
            formatCheckedAt(row.checkedAt) ?? "",
          ],
        })),
        filter: null,
        sort: "Read order.",
        population: `${formatInt(evidence.found)} found and ${formatInt(evidence.notFound)} not found, of ${formatInt(evidence.checked)} checked listings.`,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: SPEC_FAILED };
  }
}

export async function loadListingContentSource(): Promise<SourceRead> {
  try {
    const [summary, asOf] = await Promise.all([loadListingContent(), loadDashboardAsOf()]);
    return {
      ok: true,
      source: {
        table: "aplus-matrix-listings",
        header: ["Listing", "ASIN", "Bullets", "Images", "A+", "Video"],
        rows: summary.rows.map((row) => ({
          key: row.asin,
          cells: [
            row.title?.trim() || "Listing",
            row.asin,
            row.bullet_count == null ? "" : String(row.bullet_count),
            row.image_count == null ? "" : String(row.image_count),
            contentStateLabel(row.aplus_state),
            contentStateLabel(row.video_state),
          ],
        })),
        filter: null,
        sort: "Read order.",
        population: `${formatInt(summary.rows.length)} listings in the listing content read.`,
        asOf: asOf.asOf,
        setAsideCheck: SET_ASIDE_CHECKS.listingContent,
      },
    };
  } catch {
    return { ok: false, message: CONTENT_FAILED };
  }
}
