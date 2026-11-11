"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { registerTableControls, type TableControls } from "@/components/v3/live/table-controls";
import {
  applyColumnSort,
  pageSlice,
  orderFullResult,
} from "@/lib/fender-canvas/full-result-sort";
import { filterRowsBySearch, type SearchTextCache } from "@/lib/fender-canvas/table-search";
import type { SortInput, SortKind, TableSort } from "@/lib/fender-canvas/table-sort";

type SortableColumn = {
  id: string;
  sort?: SortKind;
};

/**
 * Search and sort the filtered population, then show one page.
 * Width memory stays on ResizableTable. This hook does not touch column widths.
 */
export function useFullPopulationSort<T>(
  rows: readonly T[],
  columns: readonly SortableColumn[],
  value: (row: T, columnId: string) => SortInput,
  tieBreak: (row: T) => string,
  pageSize: number,
) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQueryState] = useState("");
  const tieBreakRef = useRef(tieBreak);
  tieBreakRef.current = tieBreak;
  const onSort = useCallback((columnId: string) => {
    setSort((current) => applyColumnSort(current, columnId).sort);
    setPage(0);
  }, []);
  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    setPage(0);
  }, []);
  const resetPage = useCallback(() => setPage(0), []);
  const columnIds = columns.map((column) => column.id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new column set starts a new cache
  const searchCache = useMemo<SearchTextCache>(() => new WeakMap(), [columnIds]);
  const matched = useMemo(
    () => filterRowsBySearch(rows, query, columnIds.split("|"), value, searchCache),
    [columnIds, query, rows, value, searchCache],
  );
  const ordered = useMemo(() => {
    if (!sort) return matched;
    const kind = columns.find((column) => column.id === sort.columnId)?.sort;
    if (!kind) return matched;
    return orderFullResult(
      matched,
      kind,
      sort.direction,
      (row) => value(row, sort.columnId),
      (row) => tieBreakRef.current(row),
    );
  }, [columns, matched, sort, value]);
  const orderedKeys = useMemo(() => ordered.map(tieBreak), [ordered, tieBreak]);
  const controls: TableControls = { query, setQuery, total: rows.length, matched: matched.length, orderedKeys };
  registerTableControls(onSort, controls);
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize) || 1);
  const safePage = Math.min(page, pages - 1);
  return {
    pageRows: pageSlice(ordered, safePage, pageSize),
    sort,
    onSort,
    page: safePage,
    setPage,
    resetPage,
    pages,
    query,
    setQuery,
    controls,
  };
}
