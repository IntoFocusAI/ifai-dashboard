import { loadExploreListingsSource } from "@/lib/export/explore-listings-export";
import { loadMapSource } from "@/lib/export/map-export";
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

const LOADERS: Record<FixedExportTableId, () => Promise<SourceRead>> = {
  "map-listings": loadMapSource,
  "stock-loss": loadStockSource,
  "catalog-bundles": loadCatalogBundlesSource,
  "catalog-spec-gaps": loadCatalogSpecGapsSource,
  "spec-readiness": loadSpecReadinessSource,
  "machine-readability-pages": loadBrandSitePagesSource,
  "brand-site-page-found": loadPageFoundSource,
  "aplus-matrix-listings": loadListingContentSource,
  "suppressed-listings": loadSuppressedSource,
  "explore-listings": loadExploreListingsSource,
};

/** Every row the table can show, read with the table's own query. */
export function loadTableSource(table: ExportTableId): Promise<SourceRead> {
  const asin = stockEpisodesAsin(table);
  if (asin) return loadStockEpisodesSource(asin);
  return LOADERS[table as FixedExportTableId]();
}
