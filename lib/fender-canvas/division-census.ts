import { hasKnownBuyBoxSeller, isAmazonRetailSeller } from "./consensus-scores";
import type { CatalogBundleRow } from "./portfolio-retail";

/** Buy Box holders among one division's listings in the retail read. */
export type DivisionCensusEntry = {
  listings: number;
  /** Listings whose Buy Box holder is known (Amazon Retail or a named seller). */
  knownHolder: number;
  /** Listings where Amazon Retail holds the Buy Box. */
  amazonHolds: number;
};

/** Keyed by the listing's category, which is the division name on `canvas_divisions`. */
export type DivisionCensus = Record<string, DivisionCensusEntry>;

export function divisionKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return key ? key : null;
}

/** Same known-holder and Amazon Retail rules as the Controlled Buy Box figure. Null when the read did not load. */
export function catalogDivisionCensus(
  rows: Pick<CatalogBundleRow, "category" | "buybox_status" | "buybox_seller_name">[] | null,
): DivisionCensus | null {
  if (rows == null) return null;
  const census: DivisionCensus = {};
  for (const row of rows) {
    const key = divisionKey(row.category);
    if (!key) continue;
    const entry = (census[key] ??= { listings: 0, knownHolder: 0, amazonHolds: 0 });
    entry.listings += 1;
    if (!hasKnownBuyBoxSeller(row)) continue;
    entry.knownHolder += 1;
    if (isAmazonRetailSeller(row)) entry.amazonHolds += 1;
  }
  return census;
}
