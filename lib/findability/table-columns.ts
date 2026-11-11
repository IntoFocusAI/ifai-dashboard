/**
 * Findability listing table: which columns each outcome shows, and the value each column
 * sorts and searches on. Every outcome table fits a 1280 px panel without sideways scroll.
 *
 * Outcome tables (every outcome except Unchecked) stack related facts in one cell, so the
 * table keeps every stored fact in seven columns:
 * - Listing: the title, then category and product kind.
 * - Official page: the page, then the variant SKU.
 * - Confidence: the identifier that matched, then how the page was found.
 * - Checked: the check time, then the HTTP status when one is stored.
 * The outcome is the table's title, so it is not repeated on every row.
 *
 * The Unchecked table keeps the D-09 columns: Reason after ASIN and Listing, then Category,
 * Product kind, Explanation, and Dealer bundle.
 */

import {
  confidenceLabel,
  dealerBundleLabel,
  findabilitySortValue,
  listingTitle,
  productKindLabel,
  sourceMethodLabel,
} from "@/lib/findability/copy";
import { presentOfficialAddress, type FindabilityBucket, type FindabilityRow } from "@/lib/findability/outcomes";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

/** Columns that wrap inside their width instead of setting the table's one-line floor. */
export const FINDABILITY_WRAP_COLUMNS = ["page", "confidence", "checked", "explanation", "reason", "category", "bundle"] as const;

/** Category and product kind under the listing title. Unrecorded parts are left out. */
export function listingContextLine(row: FindabilityRow): string {
  const parts: string[] = [];
  const category = row.category?.trim();
  if (category) parts.push(category);
  if (row.product_kind?.trim()) parts.push(productKindLabel(row.product_kind));
  return parts.join(" · ");
}

/** "Variant SKU 0109200800" under the official page, or empty when none is stored. */
export function variantSkuLine(row: FindabilityRow): string {
  const sku = row.latest_variant_sku?.trim();
  return sku ? `Variant SKU ${sku}` : "";
}

/** How the page was found, under the confidence. Empty when nothing is stored. */
export function matchMethodLine(row: FindabilityRow): string {
  return row.source_method?.trim() ? sourceMethodLabel(row.source_method) : "";
}

/** "HTTP 200" under the check time, or empty when no status is stored. */
export function httpStatusLine(row: FindabilityRow, bucket: FindabilityBucket): string {
  if (bucket === "not_checked" || row.http_status == null) return "";
  return `HTTP ${row.http_status}`;
}

function joined(...parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part && part.trim()).join(" ");
}

/**
 * Sort and search value for one cell. A stacked cell sorts on its first line and searches
 * both lines, so a search for a category, a SKU, or a match method still finds the row.
 */
export function findabilityTableValue(row: FindabilityRow, columnId: string): SortInput {
  switch (columnId) {
    case "title":
      return joined(listingTitle(row), listingContextLine(row));
    case "page": {
      const address = presentOfficialAddress(row);
      return joined(address.kind === "link" ? address.href : address.text, variantSkuLine(row));
    }
    case "confidence":
      return joined(confidenceLabel(row.confidence), matchMethodLine(row));
    case "bundle":
      return dealerBundleLabel(row.dealer_bundle);
    default:
      return findabilitySortValue(row, columnId);
  }
}
