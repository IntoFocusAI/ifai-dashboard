import { specRowsQuery } from "@/lib/canvasData";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import { exportFailed, exportFile } from "@/lib/export/file";
import type { BuiltExport, ExportProvenance } from "@/lib/export/types";
import { specGapFieldsCell } from "@/lib/fender-canvas/catalog-governance-findings";
import { formatInt, formatPct, formatUsd } from "@/lib/fender-canvas/format";
import { loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import {
  contentGapRows,
  contentStateLabel,
  listingContentHeroes,
  loadListingContent,
  type ContentHeroId,
} from "@/lib/fender-canvas/listing-content";
import {
  fieldLabel,
  loadSpecPages,
  type SpecPage,
} from "@/lib/fender-canvas/machine-readability";
import { loadPageFoundEvidence, type PageFoundRow } from "@/lib/fender-canvas/page-found-evidence";
import {
  bundlePopulationTip,
  catalogBundleBuyBoxLabel,
  catalogBundleLineLabel,
  LIVE_OFFER_BUNDLES,
} from "@/lib/fender-canvas/portfolio-retail";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { specHero } from "@/lib/fender-canvas/retail-overview-lead";
import {
  defaultStockLossOrder,
  loadStockLossRows,
  lostSales,
  num,
  type StockLossRow,
} from "@/lib/fender-canvas/stock-loss";
import type { CanvasSpecReadinessRow } from "@/lib/fender-canvas/types";

const STOCK_FAILED = "The stock history could not be loaded.";
const RETAIL_FAILED = "The retail read could not be loaded.";
const SPEC_FAILED = "The spec read could not be loaded.";

function money(value: number | null): string {
  return value != null ? formatUsd(value) : "Awaiting inputs";
}

function provenance(partial: Omit<ExportProvenance, "asOf"> & { asOf?: string }, asOf: string): ExportProvenance {
  return { ...partial, asOf: partial.asOf ?? asOf };
}

export async function loadStockExport(): Promise<BuiltExport> {
  try {
    const [loaded, asOf] = await Promise.all([loadStockLossRows(), loadDashboardAsOf()]);
    if (!loaded.available) return exportFailed(STOCK_FAILED);
    const rows = defaultStockLossOrder(loaded.rows);
    const population =
      loaded.populationCount != null
        ? `${formatInt(rows.length)} listings out of stock at least one day in the last 12 months, of ${formatInt(loaded.populationCount)} listings in the sales read.`
        : `${formatInt(rows.length)} listings out of stock at least one day in the last 12 months.`;
    return exportFile(
      "stock-loss",
      provenance(
        {
          filter: "Out of stock at least one day in the last 12 months.",
          sort: "Larger 12-month estimate first, then awaiting inputs by out-of-stock days.",
          population,
        },
        asOf.asOf,
      ),
      [
        "Listing",
        "Est. lost sales, 12 months",
        "Est. lost sales, 90 days",
        "Est. lost sales, 30 days",
        "Out-of-stock days, 12 months",
        "Sales per in-stock day",
        "No Buy Box days, 12 months",
      ],
      rows.map((row) => stockLine(row)),
    );
  } catch {
    return exportFailed(STOCK_FAILED);
  }
}

function stockLine(row: StockLossRow): string[] {
  const days = (value: number | null | undefined) => {
    const n = num(value);
    return n == null ? "" : String(n);
  };
  return [
    (row.title ?? row.asin).trim(),
    money(lostSales(row, 365)),
    money(lostSales(row, 90)),
    money(lostSales(row, 30)),
    days(row.oos_days_365),
    row.revenue_source ? money(num(row.baseline_daily_revenue)) : "Awaiting inputs",
    days(row.no_buy_box_days_365),
  ];
}

export async function loadCatalogSplinteredExport(): Promise<BuiltExport> {
  try {
    const [snapshot, asOf] = await Promise.all([loadPortfolioRetailSnapshot(), loadDashboardAsOf()]);
    const reading = snapshot.unnestedBundles;
    if (!reading.detail) return exportFailed(reading.missingMessage ?? RETAIL_FAILED);
    const rows = reading.detail.opportunities;
    return exportFile(
      "catalog-splintered",
      provenance(
        {
          filter: "No filter.",
          sort: "Retail read order.",
          population: bundlePopulationTip(reading) ?? `${rows.length} ${LIVE_OFFER_BUNDLES}.`,
        },
        asOf.asOf,
      ),
      ["Listing", "ASIN", "Buy Box", "Line"],
      rows.map((row) => [
        row.modelOrTitle ?? "Listing",
        row.asin,
        catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName),
        catalogBundleLineLabel(row.category),
      ]),
    );
  } catch {
    return exportFailed(RETAIL_FAILED);
  }
}

export async function loadCatalogSpecsExport(): Promise<BuiltExport> {
  try {
    const [snapshot, asOf] = await Promise.all([loadPortfolioRetailSnapshot(), loadDashboardAsOf()]);
    const reading = snapshot.amazonSpecGaps;
    const gaps = reading.detail?.gaps;
    if (!gaps) return exportFailed(reading.missingMessage ?? SPEC_FAILED);
    const hero = specHero(snapshot);
    return exportFile(
      "catalog-specs",
      provenance(
        {
          filter: "No filter.",
          sort: "Retail read order.",
          population: hero.tip ?? hero.explainer,
        },
        asOf.asOf,
      ),
      ["Listing", "ASIN", "Fields"],
      gaps.map((gap) => [gap.modelOrTitle ?? "Listing", gap.asin, specGapFieldsCell(gap.missingFields)]),
    );
  } catch {
    return exportFailed(RETAIL_FAILED);
  }
}

export async function loadAmazonSpecsExport(): Promise<BuiltExport> {
  try {
    const [loaded, asOf] = await Promise.all([
      loadFilteredPages(async (page, size) => {
        const result = await specRowsQuery(page, size);
        return { data: (result.data ?? []) as CanvasSpecReadinessRow[], error: result.error, count: result.count };
      }),
      loadDashboardAsOf(),
    ]);
    if (loaded.error) return exportFailed(SPEC_FAILED);
    return exportFile(
      "amazon-specs",
      provenance(
        {
          filter: "No filter.",
          sort: "Amazon completeness, lowest first.",
          population:
            loaded.total != null
              ? `${formatInt(loaded.rows.length)} of ${formatInt(loaded.total)} Amazon spec rows.`
              : `${formatInt(loaded.rows.length)} Amazon spec rows.`,
        },
        asOf.asOf,
      ),
      ["ASIN", "Model", "Amazon completeness", "Missing Amazon fields"],
      loaded.rows.map((row) => [
        row.asin,
        row.title ?? "",
        formatPct(row.amazon_completeness_pct),
        row.amazon_missing_fields ?? "",
      ]),
    );
  } catch {
    return exportFailed(SPEC_FAILED);
  }
}

function pageMatches(page: SpecPage, filter: string): boolean {
  return filter === "product_basics" ? page.missingBasics.length > 0 : !page.hasSpecBlock;
}

export async function loadBrandSitePagesExport(filter: string): Promise<BuiltExport> {
  const which = filter === "product_basics" ? "product_basics" : "missing_specs";
  try {
    const [summary, asOf] = await Promise.all([loadSpecPages(), loadDashboardAsOf()]);
    const rows = summary.pages.filter((page) => pageMatches(page, which));
    const label =
      which === "product_basics" ? "Pages missing a product basic." : "Pages missing machine-readable specs.";
    return exportFile(
      "brand-site-pages",
      provenance(
        {
          filter: label,
          sort: "Read order.",
          population: `${formatInt(rows.length)} pages. ${label}`,
        },
        asOf.asOf,
      ),
      ["Page", "Amazon listings", "Missing", "Checked"],
      rows.map((page) => [
        page.model || page.url,
        String(page.asins.length),
        page.missingFields.map(fieldLabel).join(", "),
        page.checkedAt ?? "",
      ]),
    );
  } catch {
    return exportFailed(SPEC_FAILED);
  }
}

export async function loadPageFoundExport(filter: string): Promise<BuiltExport> {
  const which = filter === "found" || filter === "not_found" ? filter : "all";
  try {
    const [evidence, asOf] = await Promise.all([loadPageFoundEvidence(), loadDashboardAsOf()]);
    const rows = evidence.rows.filter((row) => {
      if (which === "found") return row.found;
      if (which === "not_found") return !row.found;
      return true;
    });
    return exportFile(
      "brand-site-page-found",
      provenance(
        {
          filter: which === "all" ? "No filter." : which === "found" ? "Page found." : "Page not found.",
          sort: "Read order.",
          population: `${formatInt(evidence.found)} found and ${formatInt(evidence.notFound)} not found, of ${formatInt(evidence.checked)} checked listings.`,
        },
        asOf.asOf,
      ),
      ["Amazon listing", "Model", "Page found", "Checked"],
      rows.map((row) => pageFoundLine(row)),
    );
  } catch {
    return exportFailed(SPEC_FAILED);
  }
}

function pageFoundLine(row: PageFoundRow): string[] {
  return [row.asin, row.model ?? "", row.found ? "Found" : "Not found", row.checkedAt ?? ""];
}

const APLUS_FILTER: Record<ContentHeroId, string> = {
  bullets: "Listings with fewer than five bullets.",
  aplus: "Listings with no A+ content.",
  video: "Listings with no product video.",
};

export async function loadAplusExport(filter: string): Promise<BuiltExport> {
  const which: ContentHeroId = filter === "aplus" || filter === "video" ? filter : "bullets";
  try {
    const [summary, asOf] = await Promise.all([loadListingContent(), loadDashboardAsOf()]);
    const rows = contentGapRows(summary, which);
    const hero = listingContentHeroes(summary).find((item) => item.id === which);
    return exportFile(
      "aplus",
      provenance(
        {
          filter: APLUS_FILTER[which],
          sort: "Read order.",
          population: hero?.tip ?? hero?.explainer ?? `${formatInt(rows.length)} listings.`,
        },
        asOf.asOf,
      ),
      ["Listing", "ASIN", "Bullets", "Images", "A+", "Video"],
      rows.map((row) => [
        row.title ?? "",
        row.asin,
        row.bullet_count == null ? "" : String(row.bullet_count),
        row.image_count == null ? "" : String(row.image_count),
        contentStateLabel(row.aplus_state),
        contentStateLabel(row.video_state),
      ]),
    );
  } catch {
    return exportFailed("The listing content read could not be loaded.");
  }
}
