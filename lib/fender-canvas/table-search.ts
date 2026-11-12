/**
 * Search for client data tables (X-33). A row matches when every word of the query appears in
 * its text: each column's sort value plus the identifiers a listing cell prints under its name
 * (ASIN, model, title, page address). Dollar signs, commas, and percent signs are ignored on
 * both sides, so "$2,999" finds 2999.99.
 */
import type { SortInput, SortKind, TableSort } from "@/lib/fender-canvas/table-sort";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[$,%]/g, "").replace(/\s+/g, " ").trim();
}

export function searchTerms(query: string): string[] {
  return normalize(query).split(" ").filter(Boolean);
}

function pushValue(parts: string[], value: unknown) {
  if (value == null) return;
  if (typeof value === "string") {
    if (value.trim()) parts.push(value);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return;
    parts.push(String(value), value.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    if (!Number.isInteger(value)) parts.push(value.toFixed(2));
    return;
  }
  if (typeof value === "boolean") return;
}

/** Row fields a table prints beside a column's sort value, such as the ASIN chip under a title. */
const SHOWN_ID_FIELDS = ["asin", "title", "model", "modelOrTitle", "url"] as const;

/** One lowercased string holding everything a search may match in this row. */
export function rowSearchText<T>(
  row: T,
  columnIds: readonly string[],
  value: (row: T, columnId: string) => SortInput,
): string {
  const parts: string[] = [];
  for (const id of columnIds) pushValue(parts, value(row, id));
  if (row && typeof row === "object") {
    const record = row as Record<string, unknown>;
    for (const field of SHOWN_ID_FIELDS) {
      if (typeof record[field] === "string") pushValue(parts, record[field]);
    }
  }
  return normalize(parts.join(" "));
}

export function matchesSearch(text: string, terms: readonly string[]): boolean {
  return terms.every((term) => text.includes(term));
}

/** Search text per row object, so typing re-reads only rows it has not seen. */
export type SearchTextCache = WeakMap<object, string>;

/** The rows whose text holds every search word, in their incoming order. */
export function filterRowsBySearch<T>(
  rows: readonly T[],
  query: string,
  columnIds: readonly string[],
  value: (row: T, columnId: string) => SortInput,
  cache?: SearchTextCache,
): readonly T[] {
  const terms = searchTerms(query);
  if (!terms.length) return rows;
  const text = (row: T) => {
    if (!cache || !row || typeof row !== "object") return rowSearchText(row, columnIds, value);
    const key = row as unknown as object;
    let hit = cache.get(key);
    if (hit == null) {
      hit = rowSearchText(row, columnIds, value);
      cache.set(key, hit);
    }
    return hit;
  };
  return rows.filter((row) => matchesSearch(text(row), terms));
}

const DIRECTION_WORDS: Record<SortKind, { asc: string; desc: string }> = {
  text: { asc: "A to Z", desc: "Z to A" },
  number: { asc: "lowest first", desc: "highest first" },
  date: { asc: "oldest first", desc: "newest first" },
};

/** "MAP, highest first". Null when the table keeps its own order. */
export function describeTableSort(
  sort: TableSort | null,
  columns: readonly { id: string; name: string; sort?: SortKind }[],
): string | null {
  if (!sort) return null;
  const column = columns.find((item) => item.id === sort.columnId);
  if (!column?.sort) return null;
  return `${column.name}, ${DIRECTION_WORDS[column.sort][sort.direction]}`;
}

/** The search line in a download: `Search "strat".` Null with no search. */
export function describeTableSearch(query: string): string | null {
  const text = query.trim().replace(/\s+/g, " ");
  return text ? `Search "${text}".` : null;
}
