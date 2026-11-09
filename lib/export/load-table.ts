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
import { loadSuppressedSource } from "@/lib/export/suppressed-export";
import type { ExportTableId } from "@/lib/export/tables";
import type { SourceRead } from "@/lib/export/types";

const LOADERS: Record<ExportTableId, () => Promise<SourceRead>> = {
  "map-listings": loadMapSource,
  "stock-loss": loadStockSource,
  "catalog-bundles": loadCatalogBundlesSource,
  "catalog-spec-gaps": loadCatalogSpecGapsSource,
  "spec-readiness": loadSpecReadinessSource,
  "machine-readability-pages": loadBrandSitePagesSource,
  "brand-site-page-found": loadPageFoundSource,
  "aplus-matrix-listings": loadListingContentSource,
  "suppressed-listings": loadSuppressedSource,
};

/** Every row the table can show, read with the table's own query. */
export function loadTableSource(table: ExportTableId): Promise<SourceRead> {
  return LOADERS[table]();
}
