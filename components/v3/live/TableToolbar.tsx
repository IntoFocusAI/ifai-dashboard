"use client";

import { Children, cloneElement, isValidElement, useState, type ReactNode } from "react";
import type { TableControls } from "@/components/v3/live/table-controls";
import { activeClientKey } from "@/lib/client/active-client";
import { exportFileName, exportHref, isExportTable } from "@/lib/export/tables";
import { formatInt } from "@/lib/fender-canvas/format";
import { describeTableSort } from "@/lib/fender-canvas/table-search";
import type { SortKind, TableSort } from "@/lib/fender-canvas/table-sort";

const DOWNLOAD_FAILED = "The download could not be made. Try again.";

type ToolbarColumn = { id: string; name: string; sort?: SortKind };

/** With a search that matches nothing, the body says so instead of the table's own empty line. */
export function withSearchEmpty(children: ReactNode, controls: TableControls | null, colSpan: number): ReactNode {
  if (!controls?.query.trim() || controls.matched > 0) return children;
  return Children.map(children, (child) =>
    isValidElement(child) && child.type === "tbody"
      ? cloneElement(
          child,
          undefined,
          <tr data-table-search-empty="">
            <td colSpan={colSpan}>No rows match this search.</td>
          </tr>,
        )
      : child,
  );
}

async function downloadCsv(
  tableId: string,
  body: {
    keys: readonly string[] | null;
    search: string;
    sort: string | null;
    filter: string | null;
    scope: Record<string, unknown> | null;
  },
): Promise<string | null> {
  const response = await fetch(exportHref(tableId, activeClientKey()), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("text/csv")) {
    const text = type.startsWith("text/plain") ? (await response.text()).trim() : "";
    return text || DOWNLOAD_FAILED;
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(tableId);
  link.click();
  URL.revokeObjectURL(url);
  return null;
}

/** Search box, match count, and Download CSV above one ResizableTable. */
export function TableToolbar({
  tableId,
  columns,
  sort,
  controls,
  shownKeys,
  filterLabel,
  exportScope,
}: {
  tableId: string;
  columns: readonly ToolbarColumn[];
  sort: TableSort | null;
  controls: TableControls | null;
  /** Row keys in the table body, used when the sort hook cannot key its rows. */
  shownKeys: readonly string[];
  filterLabel?: string | null;
  /** What the view shows, sent with the download. Null means this view has no download now. */
  exportScope?: Record<string, unknown> | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Without its sort hook the toolbar cannot name every matching row, so it shows nothing.
  if (!controls) return null;
  const exportable = isExportTable(tableId) && exportScope !== null;
  const query = controls.query;
  const onDownload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(
        await downloadCsv(tableId, {
          keys: controls.orderedKeys ?? shownKeys,
          search: query,
          sort: describeTableSort(sort, columns),
          filter: filterLabel ?? null,
          scope: exportScope ?? null,
        }),
      );
    } catch {
      setMessage(DOWNLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="table-toolbar" data-table-toolbar={tableId}>
      <input
        type="search"
        className="table-search"
        placeholder="Search this table"
        aria-label="Search this table"
        value={query}
        data-table-search={tableId}
        onChange={(event) => controls.setQuery(event.target.value)}
      />
      {query.trim() ? (
        <span className="table-toolbar-count" data-table-search-count={controls.matched}>
          {formatInt(controls.matched)} of {formatInt(controls.total)} rows
        </span>
      ) : null}
      {exportable ? (
        <button
          type="button"
          className="table-download-btn"
          data-table-download={tableId}
          disabled={busy}
          onClick={() => void onDownload()}
        >
          {busy ? "Preparing CSV…" : "Download CSV"}
        </button>
      ) : null}
      {message ? (
        <span className="table-toolbar-error" role="status" data-table-download-error="">
          {message}
        </span>
      ) : null}
    </div>
  );
}
