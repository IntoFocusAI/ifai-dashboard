import {
  loadBattlecardsExport,
  loadCompetitorWinsExport,
  loadEngineComparisonExport,
  loadFactChecksExport,
} from "@/lib/export/ai-export";
import { loadMapExport } from "@/lib/export/map-export";
import {
  loadAmazonSpecsExport,
  loadAplusExport,
  loadBrandSitePagesExport,
  loadCatalogSpecsExport,
  loadCatalogSplinteredExport,
  loadPageFoundExport,
  loadStockExport,
} from "@/lib/export/retail-export";
import type { BuiltExport } from "@/lib/export/types";

/** Server CSV for one on-screen table. Unknown ids are not a file. */
export function loadTableExport(table: string, params: URLSearchParams): Promise<BuiltExport | null> {
  switch (table) {
    case "map":
      return loadMapExport();
    case "stock-loss":
      return loadStockExport();
    case "catalog-splintered":
      return loadCatalogSplinteredExport();
    case "catalog-specs":
      return loadCatalogSpecsExport();
    case "amazon-specs":
      return loadAmazonSpecsExport();
    case "brand-site-pages":
      return loadBrandSitePagesExport(params.get("filter") ?? "missing_specs");
    case "brand-site-page-found":
      return loadPageFoundExport(params.get("filter") ?? "all");
    case "aplus":
      return loadAplusExport(params.get("filter") ?? "bullets");
    case "competitor-wins":
      return loadCompetitorWinsExport();
    case "engine-comparison":
      return loadEngineComparisonExport();
    case "category-battlecards":
      return loadBattlecardsExport();
    case "fact-checks":
      return loadFactChecksExport();
    default:
      return Promise.resolve(null);
  }
}
