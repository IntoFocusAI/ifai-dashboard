"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTableRowLimit } from "@/components/v3/live/TableRowLimit";
import {
  columnWidthStorageKey,
  fitResizableColumnWidths,
  mergeColumnWidths,
  pickFillColumnId,
  type ColumnWidthSpec,
} from "@/lib/fender-canvas/retail-column-layout";
import { measureColumnOneLineMins } from "@/lib/fender-canvas/table-column-measure";
import {
  ariaSortValue,
  tableScrollClass,
  type SortKind,
  type TableSort,
} from "@/lib/fender-canvas/table-sort";

export type RetailColumn = ColumnWidthSpec & {
  label: ReactNode;
  /** Spoken name for the resize control. */
  name: string;
  className?: string;
  /** When set, the header sorts this column. Currency and counts use "number". */
  sort?: SortKind;
  /** Optional dotted-underline definition on the header label. */
  headerTooltip?: { title: string; description: string };
};

export function clientColumn(
  id: string,
  name: string,
  sort: SortKind,
  width: number,
  minWidth = 72,
  className?: string,
): RetailColumn {
  return { id, name, label: name, sort, width, minWidth, className };
}

const KEY_STEP = 16;

function ColumnHeaderLabel({ column }: { column: RetailColumn }) {
  const label = column.label;
  if (!column.headerTooltip) return <>{label}</>;
  const { title, description } = column.headerTooltip;
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`${title}: ${description}`}
    >
      {label}
    </span>
  );
}

/** Same path as retail-explore-chevron; direction comes from data-sort-dir CSS. */
function SortChevron() {
  return (
    <svg
      className="retail-explore-chevron ifai-sort-chevron"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path
        d="M2.2 4.2 6 8l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readStoredRaw(tableId: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(columnWidthStorageKey(tableId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStored(tableId: string, columns: readonly RetailColumn[]): Record<string, number> {
  return mergeColumnWidths(columns, readStoredRaw(tableId));
}

function useColumnWidths(tableId: string, columns: readonly RetailColumn[]) {
  const signature = columns
    .map((column) => `${column.id}:${column.width}:${column.minWidth ?? ""}`)
    .join("|");
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const [widths, setWidths] = useState<Record<string, number>>(() => mergeColumnWidths(columns, null));

  useEffect(() => {
    setWidths(readStored(tableId, columnsRef.current));
  }, [tableId, signature]);

  const setWidth = useCallback((id: string, width: number, base?: Record<string, number>) => {
    setWidths((current) => {
      const next = mergeColumnWidths(columnsRef.current, { ...(base ?? current), [id]: width });
      try {
        window.localStorage.setItem(columnWidthStorageKey(tableId), JSON.stringify(next));
      } catch {
        /* keep the in-memory width when storage is blocked */
      }
      return next;
    });
  }, [tableId]);

  return { widths, setWidth, signature };
}

function ColumnResizeHandle({
  name,
  width,
  minWidth,
  onPreview,
  onCommit,
  onDragChange,
}: {
  name: string;
  width: number;
  minWidth: number;
  onPreview: (width: number) => void;
  onCommit: (width: number) => void;
  onDragChange: (active: boolean) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);

  const finish = (clientX: number, pointerId: number, handle: HTMLElement) => {
    if (!drag.current) return;
    const next = Math.max(minWidth, Math.round(drag.current.width + clientX - drag.current.x));
    drag.current = null;
    onDragChange(false);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    onCommit(next);
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${name} column`}
      aria-valuemin={minWidth}
      aria-valuenow={Math.round(width)}
      aria-valuemax={960}
      tabIndex={0}
      className="col-resize-handle"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width };
        onDragChange(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const next = Math.max(minWidth, Math.round(drag.current.width + event.clientX - drag.current.x));
        onPreview(next);
      }}
      onPointerUp={(event) => finish(event.clientX, event.pointerId, event.currentTarget)}
      onPointerCancel={(event) => finish(event.clientX, event.pointerId, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? KEY_STEP : -KEY_STEP;
        onCommit(Math.max(minWidth, width + delta));
      }}
    />
  );
}

export function ResizableTable({
  tableId,
  columns,
  fillColumnId,
  wrapColumnIds,
  freezeHeader = true,
  maxHeight = 520,
  sort = null,
  onSort,
  tableClassName,
  children,
}: {
  tableId: string;
  columns: readonly RetailColumn[];
  /** Column that grows so the table fills the panel until someone resizes. */
  fillColumnId?: string;
  /** Extra columns allowed to wrap; skipped when measuring one-line floors. */
  wrapColumnIds?: readonly string[];
  freezeHeader?: boolean;
  maxHeight?: number;
  sort?: TableSort | null;
  onSort?: (columnId: string) => void;
  /** Extra classes on the table (e.g. table-no-row-hover). */
  tableClassName?: string;
  children: ReactNode;
}) {
  const { widths, setWidth, signature } = useColumnWidths(tableId, columns);
  const rowLimit = useTableRowLimit(children);
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentMins, setContentMins] = useState<Record<string, number>>({});
  const [manual, setManual] = useState(false);
  const fillId = pickFillColumnId(columns, fillColumnId);
  const wrapIds = wrapColumnIds ?? [];
  const wrapSignature = wrapIds.join("|");

  useEffect(() => {
    setManual(readStoredRaw(tableId) != null);
  }, [tableId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => setContainerWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (manual) return;
    const table = tableRef.current;
    if (!table) return;
    const columnIds = signature.split("|").map((part) => part.split(":")[0]).filter(Boolean);
    const skipIds = [fillId, ...wrapIds.filter(Boolean)];
    const run = () => {
      const next = measureColumnOneLineMins(table, columnIds, skipIds);
      setContentMins((current) => {
        const same = columnIds.every((id) => (current[id] ?? 0) === (next[id] ?? 0));
        return same ? current : next;
      });
    };
    run();
    const body = table.tBodies[0];
    if (!body) return;
    const observer = new MutationObserver(run);
    observer.observe(body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [manual, fillId, signature, wrapSignature, containerWidth]);

  const displayWidths = manual
    ? widths
    : fitResizableColumnWidths(columns, containerWidth, {
        fillColumnId: fillId,
        contentMins,
      });
  const displayRef = useRef(displayWidths);
  displayRef.current = displayWidths;
  const total = columns.reduce((sum, column) => sum + (displayWidths[column.id] ?? column.width), 0);

  useEffect(() => {
    const table = tableRef.current;
    return () => {
      table?.closest(".ifai-canvas")?.classList.remove("col-resize-active");
    };
  }, []);

  const preview = (id: string, width: number) => {
    const table = tableRef.current;
    if (!table) return;
    const col = table.querySelector(`col[data-col-id="${id}"]`);
    if (col instanceof HTMLElement) col.style.width = `${width}px`;
    const header = table.querySelector(`th[data-col-id="${id}"]`);
    if (header instanceof HTMLElement) header.style.width = `${width}px`;
    const nextTotal = columns.reduce((sum, column) => {
      if (column.id === id) return sum + width;
      return sum + (displayRef.current[column.id] ?? column.width);
    }, 0);
    table.style.width = `${nextTotal}px`;
  };

  const setDragging = (active: boolean) => {
    tableRef.current?.closest(".ifai-canvas")?.classList.toggle("col-resize-active", active);
  };

  const scroller = (
    <div
      ref={scrollRef}
      className={tableScrollClass(freezeHeader)}
      style={maxHeight != null ? { maxHeight } : undefined}
      data-table-id={tableId}
      data-freeze-header={freezeHeader ? "true" : "false"}
      data-fill-column={fillId}
    >
      <table
        ref={tableRef}
        className={`table-sm resizable-table${tableClassName ? ` ${tableClassName}` : ""}`}
        style={{ width: total }}
      >
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.id}
              data-col-id={column.id}
              style={{ width: displayWidths[column.id] ?? column.width }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => {
              const width = displayWidths[column.id] ?? column.width;
              return (
                <th
                  key={column.id}
                  scope="col"
                  data-col-id={column.id}
                  className={`resizable-th${column.className ? ` ${column.className}` : ""}`}
                  style={{ width }}
                  aria-sort={column.sort ? ariaSortValue(sort, column.id) : undefined}
                >
                  {column.sort ? (
                    <button
                      type="button"
                      className="ifai-sort-btn"
                      data-sort-dir={sort?.columnId === column.id ? sort.direction : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSort?.(column.id);
                      }}
                    >
                      <ColumnHeaderLabel column={column} />
                      <SortChevron />
                    </button>
                  ) : (
                    <span className="resizable-th-label">
                      <ColumnHeaderLabel column={column} />
                    </span>
                  )}
                  <ColumnResizeHandle
                    name={column.name}
                    width={width}
                    minWidth={column.minWidth ?? 72}
                    onPreview={(next) => preview(column.id, next)}
                    onCommit={(next) => {
                      setManual(true);
                      setWidth(column.id, next, displayRef.current);
                    }}
                    onDragChange={setDragging}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        {rowLimit.children}
      </table>
    </div>
  );

  // Always the same fragment, so the table is not remounted when the footer appears or goes.
  return (
    <>
      {scroller}
      {rowLimit.footer}
    </>
  );
}
