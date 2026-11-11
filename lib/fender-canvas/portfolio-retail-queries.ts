import { getCanvasSupabase } from "../supabase/canvas-client";
import { readFailure } from "./canvas-reads";
import {
  loadPortfolioRetailSnapshot as loadFromSource,
  readPages,
  RETAIL_AMAZON_SPEC_COLUMNS,
  RETAIL_CATALOG_GOVERNANCE_COLUMNS,
  RETAIL_MAP_LEAKAGE_COLUMNS,
  RETAIL_SUPPRESSION_COLUMNS,
  type AmazonSpecRow,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailSnapshot,
  type RetailQuerySource,
  type SuppressionSupportRow,
} from "./portfolio-retail";

const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/** Population the hourly Featured Offer audit is filling. One row per retail listing. */
export function retailSuppressionRowsQuery(page = 0, size = PAGE_SIZE) {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_retail_listings")
    .select(RETAIL_SUPPRESSION_COLUMNS)
    .order("asin")
    .range(page * size, page * size + size - 1);
}

/** MAP prices and stored channel leakage. Bundle and seller columns are not selected. */
export function retailMapLeakageRowsQuery(page = 0, size = PAGE_SIZE) {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_retail_listings")
    .select(RETAIL_MAP_LEAKAGE_COLUMNS)
    .order("asin")
    .range(page * size, page * size + size - 1);
}

/** Bundle parent fields already on the retail listing view. */
export function retailCatalogGovernanceRowsQuery(page = 0, size = PAGE_SIZE) {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_retail_listings")
    .select(RETAIL_CATALOG_GOVERNANCE_COLUMNS)
    .order("asin")
    .range(page * size, page * size + size - 1);
}

/** Stored catalog bundle total, used only as coverage for the bundle parent read. */
export function catalogBundleCountQuery() {
  const supabase = getCanvasSupabase();
  return supabase.from("canvas_metrics").select("catalog_bundles").limit(1);
}

/** Current spec-readiness source. One row per listing the spec read has stored. */
export function amazonSpecRowsQuery(page = 0, size = PAGE_SIZE) {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_spec_readiness")
    .select(RETAIL_AMAZON_SPEC_COLUMNS)
    .order("asin")
    .range(page * size, page * size + size - 1);
}

function finiteCount(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function supabaseRetailQuerySource(): RetailQuerySource {
  return {
    suppressionRows: () =>
      readPages((page, size) =>
        retailSuppressionRowsQuery(page, size) as PromiseLike<PageResult<SuppressionSupportRow>>,
      ),
    mapRows: () =>
      readPages((page, size) => retailMapLeakageRowsQuery(page, size) as PromiseLike<PageResult<MapLeakageRow>>),
    catalogRows: () =>
      readPages((page, size) =>
        retailCatalogGovernanceRowsQuery(page, size) as PromiseLike<PageResult<CatalogBundleRow>>,
      ),
    async catalogBundleCount() {
      try {
        const { data, error } = await catalogBundleCountQuery();
        if (error) return readFailure("m", error);
        const row = (data ?? [])[0] as { catalog_bundles?: unknown } | undefined;
        return finiteCount(row?.catalog_bundles);
      } catch (reason) {
        return readFailure("m", reason);
      }
    },
    specRows: () =>
      readPages((page, size) => amazonSpecRowsQuery(page, size) as PromiseLike<PageResult<AmazonSpecRow>>),
  };
}

/** Reads the public canvas views. Pass a source in tests so a failed read stays unavailable. */
export function loadPortfolioRetailSnapshot(
  source: RetailQuerySource = supabaseRetailQuerySource(),
): Promise<PortfolioRetailSnapshot> {
  return loadFromSource(source);
}
