"use client";

import "@/components/v3/live/summary.css";
import { useCallback, useMemo, type CSSProperties } from "react";
import { FigureTip } from "@/components/v3/live/FigureTip";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { usePortfolioRetailSnapshot } from "@/components/v3/live/usePortfolioRetailSnapshot";
import {
  DIVISION_COLUMN_NAMES,
  DIVISION_NEXT_STEP_RULE,
  divisionRowModels,
  type DivisionCell,
  type DivisionRowModel,
} from "@/lib/fender-canvas/division-rows";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import type { CanvasDivisionRow } from "@/lib/fender-canvas/types";

const TABLE_ID = "catalog-divisions";

const COUNT_STYLE: CSSProperties = { fontSize: 11, color: "var(--text-muted)" };

const COLUMNS: RetailColumn[] = [
  {
    id: "division",
    name: DIVISION_COLUMN_NAMES.division,
    label: DIVISION_COLUMN_NAMES.division,
    width: 220,
    minWidth: 140,
    sort: "text",
  },
  {
    id: "bundles",
    name: DIVISION_COLUMN_NAMES.bundles,
    label: DIVISION_COLUMN_NAMES.bundles,
    width: 170,
    minWidth: 120,
    sort: "number",
  },
  {
    id: "buybox",
    name: DIVISION_COLUMN_NAMES.buyBox,
    label: DIVISION_COLUMN_NAMES.buyBox,
    width: 200,
    minWidth: 140,
    sort: "number",
  },
  {
    id: "next",
    name: DIVISION_COLUMN_NAMES.next,
    label: DIVISION_COLUMN_NAMES.next,
    width: 190,
    minWidth: 150,
    sort: "text",
    headerTooltip: { title: DIVISION_COLUMN_NAMES.next, description: DIVISION_NEXT_STEP_RULE },
  },
];

function FigureCell({ title, cell, testId }: { title: string; cell: DivisionCell; testId: string }) {
  return (
    <td data-division-cell={testId}>
      <FigureTip title={title} desc={cell.tip} testId={testId}>
        <strong>{cell.value}</strong>
      </FigureTip>
      {cell.count ? (
        <>
          <br />
          <span style={COUNT_STYLE} data-division-count="">
            {cell.count}
          </span>
        </>
      ) : null}
    </td>
  );
}

const rowKey = (row: DivisionRowModel) => row.division;

/**
 * One row per stored division: bundle share of its SKUs, Amazon's Buy Box share of listings
 * with a known holder, and one next step. Rows are not clickable; only the next-step link is.
 * Every column sorts; the toolbar searches, counts N of M rows, and downloads CSV (X-33, X-10).
 */
export function FenderDivisionsTable({ divisions }: { divisions: CanvasDivisionRow[] }) {
  const retail = usePortfolioRetailSnapshot();
  const census = retail.phase === "ready" ? (retail.snapshot.divisionCensus ?? null) : null;
  const loading = retail.phase === "loading";
  const rows = useMemo(() => divisionRowModels(divisions, census), [divisions, census]);
  const sortValue = useCallback(
    (row: DivisionRowModel, columnId: string): SortInput => {
      if (columnId === "division") return row.division;
      if (columnId === "bundles") return row.bundles.share;
      if (columnId === "buybox") return loading ? null : row.buyBox.share;
      if (columnId === "next") return row.next.label;
      return null;
    },
    [loading],
  );
  const sorted = useClientTableSort(rows, COLUMNS, sortValue, rowKey);

  return (
    <div className="content-box summary-divisions" data-divisions-table="">
      <div className="content-box-title">
        <span>Catalog divisions</span>
      </div>
      <ResizableTable
        tableId={TABLE_ID}
        columns={COLUMNS}
        fillColumnId="division"
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={sorted.onSort}
        tableClassName="table-no-row-hover"
      >
        <tbody>
          {sorted.rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length}>No catalog division is stored in this reading.</td>
            </tr>
          ) : (
            sorted.rows.map((row) => (
              <tr key={row.division} data-division-row={row.division}>
                <td>
                  <strong>{row.division}</strong>
                </td>
                <FigureCell title={DIVISION_COLUMN_NAMES.bundles} cell={row.bundles} testId="division-bundles" />
                {loading ? (
                  <td data-division-cell="division-buybox" style={COUNT_STYLE}>
                    Loading…
                  </td>
                ) : (
                  <FigureCell title={DIVISION_COLUMN_NAMES.buyBox} cell={row.buyBox} testId="division-buybox" />
                )}
                <td>
                  <button
                    type="button"
                    className="summary-division-next"
                    data-division-next={row.next.tab}
                    data-ifai-open="ecommerce"
                    data-ifai-tab={row.next.tab}
                    aria-label={`${row.next.label} for ${row.division}`}
                  >
                    {row.next.label}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </ResizableTable>
    </div>
  );
}
