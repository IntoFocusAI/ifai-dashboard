import {
  nextTableSort,
  sortRowsByColumn,
  type SortInput,
  type SortKind,
  type TableSort,
} from "@/lib/fender-canvas/table-sort";
import { TABLE_ROW_STEP } from "@/lib/fender-canvas/table-row-limit";

/**
 * Rows shown at once. The filtered population is loaded before this slice.
 * Same as the shared table row step, so a paged table never also gets "Show more" inside a page.
 */
export const CLIENT_TABLE_PAGE_SIZE = TABLE_ROW_STEP;

const FETCH_PAGE_SIZE = 1000;
const MAX_FETCH_PAGES = 40;

export type FilteredPage<T> = {
  data: readonly T[] | null;
  error: { message: string } | null;
  count: number | null;
};

/**
 * Walk the existing paged query until the filtered population is in hand.
 * The query's own order and filters stay as they are. Sorting happens after this.
 */
export async function loadFilteredPages<T>(
  load: (page: number, size: number) => Promise<FilteredPage<T>>,
  fetchSize = FETCH_PAGE_SIZE,
): Promise<{ rows: T[]; total: number | null; error: string | null }> {
  const rows: T[] = [];
  let total: number | null = null;
  for (let page = 0; page < MAX_FETCH_PAGES; page += 1) {
    const result = await load(page, fetchSize);
    if (result.error) return { rows: [], total, error: result.error.message };
    if (page === 0) total = result.count;
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < fetchSize) break;
    if (total != null && rows.length >= total) break;
  }
  return { rows, total: total ?? rows.length, error: null };
}

/** Full filtered population, then one column. Missing values stay last in both directions. */
export function orderFullResult<T>(
  rows: readonly T[],
  kind: SortKind,
  direction: TableSort["direction"],
  value: (row: T) => SortInput,
  tieBreak: (row: T) => string,
): T[] {
  return sortRowsByColumn(rows, kind, direction, value, tieBreak);
}

export function pageSlice<T>(rows: readonly T[], page: number, pageSize = CLIENT_TABLE_PAGE_SIZE): T[] {
  const start = Math.max(0, page) * pageSize;
  return rows.slice(start, start + pageSize);
}

/** A new column or a flipped direction opens on page 1 of the full order. */
export function applyColumnSort(current: TableSort | null, columnId: string): { sort: TableSort; page: number } {
  return { sort: nextTableSort(current, columnId), page: 0 };
}
