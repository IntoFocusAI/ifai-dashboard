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
] as const;

export type ExportTableId = (typeof EXPORT_TABLE_IDS)[number];

export function isExportTable(tableId: string): tableId is ExportTableId {
  return (EXPORT_TABLE_IDS as readonly string[]).includes(tableId);
}

export function exportHref(tableId: string, clientKey: string): string {
  const base = `/dashboard/export/${encodeURIComponent(tableId)}`;
  return clientKey === "fender" ? base : `${base}?client=${encodeURIComponent(clientKey)}`;
}

/** File name the browser saves: "map-listings-2026-11-09.csv". */
export function exportFileName(tableId: string, now = new Date()): string {
  return `${tableId}-${now.toISOString().slice(0, 10)}.csv`;
}
