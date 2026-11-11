import { specFieldLabel } from "@/lib/fender-canvas/catalog-governance-findings";
import { specFenderFoundLabel, specModelTitle, type CanvasSpecReadinessRow } from "@/lib/fender-canvas/types";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

export function specReadinessSortValue(row: CanvasSpecReadinessRow, columnId: string): SortInput {
  if (columnId === "asin") return row.asin.trim() || null;
  if (columnId === "model") return specModelTitle(row.title) || null;
  if (columnId === "amazon") return row.amazon_completeness_pct;
  if (columnId === "found") return specFenderFoundLabel(row.fender_found) || null;
  const chips = (row.amazon_missing_fields ?? "").split(";").map((part) => part.trim()).filter(Boolean);
  // The table shows plain field names, so sort and search read the same names.
  return chips.length ? chips.map(specFieldLabel).join(", ") : null;
}

/** A stored http(s) address. Anything else is a missing page, not a blank string to alphabetize. */
export function schemaPageHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
