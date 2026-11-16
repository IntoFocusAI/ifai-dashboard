import { loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** The read view (migration 20261111230000_amazon_product_types_view.sql), one per client schema. */
export const AMAZON_PRODUCT_TYPES_VIEW = "canvas_amazon_product_types";

export type AmazonProductTypeRow = { asin: string; product_type: string | null };

export type AmazonProductTypesRead =
  | { phase: "loading" }
  /** The view is not there or failed: Amazon Specs keeps the interim rule for every listing. */
  | { phase: "unavailable" }
  | { phase: "ready"; types: ReadonlyMap<string, string> };

type ProductTypeClient = {
  from: (view: string) => {
    select: (
      columns: string,
      options: { count: "exact" },
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => {
        range: (
          from: number,
          to: number,
        ) => PromiseLike<{ data: unknown; count: number | null; error: { message: string } | null }>;
      };
    };
  };
};

/** ASIN to Amazon product type, for every listing the client view serves. */
export function productTypeMap(rows: readonly AmazonProductTypeRow[]): Map<string, string> {
  const types = new Map<string, string>();
  for (const row of rows) {
    const asin = row.asin?.trim();
    const type = row.product_type?.trim();
    if (asin && type) types.set(asin, type);
  }
  return types;
}

export async function loadAmazonProductTypes(client?: ProductTypeClient): Promise<AmazonProductTypesRead> {
  const supabase = client ?? (getCanvasSupabase() as unknown as ProductTypeClient);
  try {
    const result = await loadFilteredPages(async (page, size) => {
      const read = await supabase
        .from(AMAZON_PRODUCT_TYPES_VIEW)
        .select("asin,product_type", { count: "exact" })
        .order("asin", { ascending: true })
        .range(page * size, page * size + size - 1);
      return { data: (read.data ?? []) as AmazonProductTypeRow[], error: read.error, count: read.count };
    });
    if (result.error) return { phase: "unavailable" };
    return { phase: "ready", types: productTypeMap(result.rows) };
  } catch {
    return { phase: "unavailable" };
  }
}
