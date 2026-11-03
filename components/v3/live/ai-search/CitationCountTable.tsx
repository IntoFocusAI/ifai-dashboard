"use client";

import type { ReactNode } from "react";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import type { CitationPick } from "@/lib/ai-search/citation-pick";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

export function CountTable<T>({
  tableId,
  columns,
  rows,
  value,
  renderRow,
}: {
  tableId: string;
  columns: readonly RetailColumn[];
  rows: readonly T[];
  value: (row: T, columnId: string) => SortInput;
  renderRow: (row: T) => ReactNode;
}) {
  const sorted = useClientTableSort(rows, columns, value);
  return (
    <ResizableTable tableId={tableId} columns={columns} freezeHeader maxHeight={520} sort={sorted.sort} onSort={sorted.onSort}>
      <tbody>{sorted.rows.map((row) => renderRow(row))}</tbody>
    </ResizableTable>
  );
}

export function PickButton({
  pick,
  onPick,
  children,
}: {
  pick: Extract<CitationPick, { field: "domain" | "class" | "engine" | "category" }>;
  onPick: (p: CitationPick) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className="ifai-evidence-link"
      data-ai-pick={`${pick.field}:${pick.value}`}
      onClick={() => onPick(pick)}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        font: "inherit",
        fontWeight: 600,
        color: "var(--text-main)",
        textDecoration: "underline",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}
