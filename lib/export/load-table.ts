import { loadAiTableSource, type AiExportTableId } from "@/lib/export/ai-export";
import { loadDivisionsSource } from "@/lib/export/divisions-export";
import { loadExploreListingsSource } from "@/lib/export/explore-listings-export";
import { loadMapSource } from "@/lib/export/map-export";
import { loadPromptHistorySource } from "@/lib/export/prompt-history-export";
import {
  loadBrandSitePagesSource,
  loadCatalogBundlesSource,
  loadCatalogSpecGapsSource,
  loadListingContentSource,
  loadPageFoundSource,
  loadSpecReadinessSource,
  loadStockSource,
} from "@/lib/export/retail-export";
import { loadStockEpisodesSource } from "@/lib/export/stock-episodes-export";
import { loadSuppressedSource } from "@/lib/export/suppressed-export";
import { stockEpisodesAsin, type ExportTableId, type FixedExportTableId } from "@/lib/export/tables";
import type { SourceRead } from "@/lib/export/types";

type Loader = (scope: Record<string, unknown> | null) => Promise<SourceRead>;

/** An AI Search table reads the selection the date pill and engine switch name. */
function ai(table: AiExportTableId): Loader {
  return (scope) => loadAiTableSource(table, scope);
}

const LOADERS: Record<FixedExportTableId, Loader> = {
  "map-listings": loadMapSource,
  "stock-loss": loadStockSource,
  "catalog-bundles": loadCatalogBundlesSource,
  "catalog-spec-gaps": loadCatalogSpecGapsSource,
  "spec-readiness": loadSpecReadinessSource,
  "machine-readability-pages": loadBrandSitePagesSource,
  "brand-site-page-found": loadPageFoundSource,
  "aplus-matrix-listings": loadListingContentSource,
  "suppressed-listings": loadSuppressedSource,
  "catalog-divisions": loadDivisionsSource,
  "explore-listings": loadExploreListingsSource,
  "ai-run-engines": ai("ai-run-engines"),
  "ai-run-categories": ai("ai-run-categories"),
  "ai-simulations": ai("ai-simulations"),
  "product-fact-checks": ai("product-fact-checks"),
  "catalog-coverage": ai("catalog-coverage"),
  "ai-history-trend": ai("ai-history-trend"),
  "ai-trend-point": ai("ai-trend-point"),
  "citation-engines": ai("citation-engines"),
  "citation-categories": ai("citation-categories"),
  "citation-evidence": ai("citation-evidence"),
  "category-battlecards": ai("category-battlecards"),
  "competitor-wins": ai("competitor-wins"),
  "engine-comparison": ai("engine-comparison"),
  "engine-category": ai("engine-category"),
  "prompt-history": loadPromptHistorySource,
};

/** Every row the table can show, read with the table's own query and the view's scope. */
export function loadTableSource(table: ExportTableId, scope: Record<string, unknown> | null = null): Promise<SourceRead> {
  const asin = stockEpisodesAsin(table);
  if (asin) return loadStockEpisodesSource(asin);
  return LOADERS[table as FixedExportTableId](scope);
}
