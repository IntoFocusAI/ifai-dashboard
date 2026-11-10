"use client";

import { useCallback, useMemo, useState } from "react";
import { orderedRowKeys, registerTableControls, type TableControls } from "@/components/v3/live/table-controls";
import { filterRowsBySearch, type SearchTextCache } from "@/lib/fender-canvas/table-search";
import {
  nextTableSort,
  sortRowsByColumn,
  type SortInput,
  type SortKind,
  type TableSort,
} from "@/lib/fender-canvas/table-sort";

type SortableColumn = {
  id: string;
  sort?: SortKind;
};

/**
 * Column sort and search for one ResizableTable. Width memory stays in that table. The search
 * box in the table's toolbar reads and sets `query` through the returned `onSort`.
 */
export function useClientTableSort<T>(
  rows: readonly T[],
  columns: readonly SortableColumn[],
  value: (row: T, columnId: string) => SortInput,
  /** The key each row uses on screen, when it is not an ASIN or a page URL. */
  keyOf?: (row: T) => string,
) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const [query, setQuery] = useState("");
  const onSort = useCallback((columnId: string) => {
    setSort((current) => nextTableSort(current, columnId));
  }, []);
  const columnIds = columns.map((column) => column.id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new column set starts a new cache
  const searchCache = useMemo<SearchTextCache>(() => new WeakMap(), [columnIds]);
  const matched = useMemo(
    () => filterRowsBySearch(rows, query, columnIds.split("|"), value, searchCache),
    [columnIds, query, rows, value, searchCache],
  );
  const sorted = useMemo(() => {
    if (!sort) return matched;
    const kind = columns.find((column) => column.id === sort.columnId)?.sort;
    if (!kind) return matched;
    return sortRowsByColumn(matched, kind, sort.direction, (row) => value(row, sort.columnId));
  }, [columns, matched, sort, value]);
  const orderedKeys = useMemo(() => (keyOf ? sorted.map(keyOf) : orderedRowKeys(sorted)), [keyOf, sorted]);
  const controls: TableControls = { query, setQuery, total: rows.length, matched: matched.length, orderedKeys };
  registerTableControls(onSort, controls);
  return { rows: sorted, sort, onSort, query, setQuery, controls };
}
