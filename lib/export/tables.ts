/**
 * On-screen tables (ResizableTable `tableId`) with a server CSV. The toolbar shows
 * Download CSV only for these. Browser-safe: no loaders are imported here.
 */
export const EXPORT_TABLE_IDS = [
  "map-listings",
  "stock-loss",
  "catalog-bundles",
  "catalog-spec-gaps",
  "spec-readiness",
  "machine-readability-pages",
  "brand-site-page-found",
  "aplus-matrix-listings",
  "suppressed-listings",
  // AI Search Visibility: read on the server for the date pill and engine switch the screen shows.
  "ai-run-engines",
  "ai-run-categories",
  "ai-simulations",
  "product-fact-checks",
  "catalog-coverage",
  "ai-history-trend",
  "ai-trend-point",
  "citation-engines",
  "citation-categories",
  "citation-evidence",
  "prompt-history",
  "explore-listings",
] as const;

export type FixedExportTableId = (typeof EXPORT_TABLE_IDS)[number];

/** The dated stretches behind one Out of Stock row. One table per listing, named by its ASIN. */
const STOCK_EPISODES_PREFIX = "stock-episodes-";

export type ExportTableId = FixedExportTableId | `${typeof STOCK_EPISODES_PREFIX}${string}`;

export function stockEpisodesTableId(asin: string): string {
  return `${STOCK_EPISODES_PREFIX}${asin}`;
}

/** The ASIN of a dated-stretch table, or null for every other table. */
export function stockEpisodesAsin(tableId: string): string | null {
  if (!tableId.startsWith(STOCK_EPISODES_PREFIX)) return null;
  const asin = tableId.slice(STOCK_EPISODES_PREFIX.length);
  return /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
}

export function isExportTable(tableId: string): tableId is ExportTableId {
  return (EXPORT_TABLE_IDS as readonly string[]).includes(tableId) || stockEpisodesAsin(tableId) != null;
}

export function exportHref(tableId: string, clientKey: string): string {
  const base = `/dashboard/export/${encodeURIComponent(tableId)}`;
  return clientKey === "fender" ? base : `${base}?client=${encodeURIComponent(clientKey)}`;
}

/** File name the browser saves: "map-listings-2026-11-09.csv". */
export function exportFileName(tableId: string, now = new Date()): string {
  return `${tableId}-${now.toISOString().slice(0, 10)}.csv`;
}
