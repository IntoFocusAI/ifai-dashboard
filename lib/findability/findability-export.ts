import { loadDashboardAsOf } from "@/lib/export/as-of";
import type { SourceRead } from "@/lib/export/types";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  attemptLabel,
  bucketLabel,
  confidenceLabel,
  dealerBundleLabel,
  listingTitle,
  presentExplanation,
  productKindLabel,
  uncheckedReason,
} from "@/lib/findability/copy";
import {
  FINDABILITY_OUTCOMES,
  findabilityOutcome,
  presentOfficialAddress,
  rowsForOutcome,
  type FindabilityBucket,
  type FindabilityRow,
} from "@/lib/findability/outcomes";
import { loadFindabilityRead, type FindabilityClient } from "@/lib/findability/queries";
import {
  httpStatusLine,
  listingContextLine,
  matchMethodLine,
  variantSkuLine,
} from "@/lib/findability/table-columns";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** Server CSV for the Findability listings table. Register it as "findability-listings". */
export const FINDABILITY_EXPORT_TABLE = "findability-listings";

const FAILED = "The official-page read could not be loaded.";

/** The on-screen columns, in order, for each outcome table (see FindabilityTable). */
const OUTCOME_COLUMNS = [
  ["asin", "ASIN"],
  ["title", "Listing"],
  ["page", "Official page"],
  ["confidence", "Confidence"],
  ["checked", "Checked"],
  ["explanation", "Explanation"],
  ["bundle", "Dealer bundle"],
] as const;

const UNCHECKED_COLUMNS = [
  ["asin", "ASIN"],
  ["title", "Listing"],
  ["reason", "Reason"],
  ["category", "Category"],
  ["kind", "Product kind"],
  ["explanation", "Explanation"],
  ["bundle", "Dealer bundle"],
] as const;

export function findabilityExportColumns(outcome: FindabilityBucket) {
  return outcome === "not_checked" ? UNCHECKED_COLUMNS : OUTCOME_COLUMNS;
}

function lines(...parts: string[]): string {
  return parts.filter((part) => part.trim()).join(" · ");
}

/** One cell as the screen shows it, a stacked second line joined with " · ". */
export function findabilityExportCell(row: FindabilityRow, columnId: string): string {
  const bucket = findabilityOutcome(row);
  switch (columnId) {
    case "asin":
      return row.asin;
    case "title":
      return bucket === "not_checked" ? listingTitle(row) : lines(listingTitle(row), listingContextLine(row));
    case "reason":
      return uncheckedReason(row);
    case "category":
      return row.category?.trim() || "Not recorded";
    case "kind":
      return productKindLabel(row.product_kind);
    case "page": {
      const address = presentOfficialAddress(row);
      return lines(address.kind === "link" ? address.href : address.text, variantSkuLine(row));
    }
    case "confidence":
      return lines(confidenceLabel(row.confidence), matchMethodLine(row));
    case "checked":
      return lines(attemptLabel(row.latest_attempt_at, bucket), httpStatusLine(row, bucket));
    case "explanation":
      return presentExplanation(row);
    case "bundle":
      return dealerBundleLabel(row.dealer_bundle);
    default:
      return "";
  }
}

function scopeOutcome(scope: Record<string, unknown> | null): FindabilityBucket | null {
  const value = scope?.outcome;
  if (value === "other") return "other";
  return (FINDABILITY_OUTCOMES as readonly string[]).includes(String(value)) ? (value as FindabilityBucket) : null;
}

/** Every listing in the outcome the screen has open, read with the screen's own query. */
export async function loadFindabilitySource(scope: Record<string, unknown> | null): Promise<SourceRead> {
  const outcome = scopeOutcome(scope);
  if (!outcome) return { ok: false, message: "Open an outcome to download its listings." };
  try {
    const [read, asOf] = await Promise.all([
      loadFindabilityRead(getCanvasSupabase() as unknown as FindabilityClient),
      loadDashboardAsOf(),
    ]);
    if (read.phase !== "ready") return { ok: false, message: FAILED };
    const rows = rowsForOutcome(read.rows, outcome);
    const columns = findabilityExportColumns(outcome);
    return {
      ok: true,
      source: {
        table: FINDABILITY_EXPORT_TABLE,
        header: columns.map(([, name]) => name),
        rows: rows.map((row) => ({ key: row.asin, cells: columns.map(([id]) => findabilityExportCell(row, id)) })),
        filter: `Outcome: ${bucketLabel(outcome)}.`,
        sort: "Read order.",
        population: `${formatInt(rows.length)} of ${formatInt(read.rows.length)} listings with an official-page check record.`,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}
