"use client";

import type { CSSProperties } from "react";
import { FigureTip } from "@/components/v3/live/FigureTip";
import { usePortfolioRetailSnapshot } from "@/components/v3/live/usePortfolioRetailSnapshot";
import {
  DIVISION_NEXT_STEP_RULE,
  divisionRowModels,
  type DivisionCell,
} from "@/lib/fender-canvas/division-rows";
import type { CanvasDivisionRow } from "@/lib/fender-canvas/types";

const COUNT_STYLE: CSSProperties = { fontSize: 11, color: "var(--text-muted)" };

const NEXT_STEP_STYLE: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: "var(--text-main)",
  fontWeight: 600,
  cursor: "pointer",
  font: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  textAlign: "left",
};

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

/**
 * One row per stored division: bundle share of its SKUs, Amazon's Buy Box share of listings
 * with a known holder, and one next step. Rows are not clickable; only the next-step link is.
 */
export function FenderDivisionsTable({ divisions }: { divisions: CanvasDivisionRow[] }) {
  const retail = usePortfolioRetailSnapshot();
  const census = retail.phase === "ready" ? (retail.snapshot.divisionCensus ?? null) : null;
  const rows = divisionRowModels(divisions, census);

  return (
    <div className="content-box" data-divisions-table="">
      <div className="content-box-title">
        <span>Catalog divisions</span>
      </div>
      <table className="table-sm table-no-row-hover">
        <thead>
          <tr>
            <th>Catalog Division</th>
            <th>Bundle listings</th>
            <th>Amazon holds the Buy Box</th>
            <th>
              <FigureTip title="Next step" desc={DIVISION_NEXT_STEP_RULE} testId="division-next-rule">
                Next step
              </FigureTip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.division} data-division-row={row.division}>
              <td>
                <strong>{row.division}</strong>
              </td>
              <FigureCell title="Bundle listings" cell={row.bundles} testId="division-bundles" />
              {retail.phase === "loading" ? (
                <td data-division-cell="division-buybox" style={COUNT_STYLE}>
                  Loading…
                </td>
              ) : (
                <FigureCell title="Amazon holds the Buy Box" cell={row.buyBox} testId="division-buybox" />
              )}
              <td>
                <button
                  type="button"
                  style={NEXT_STEP_STYLE}
                  data-division-next={row.next.tab}
                  data-ifai-open="ecommerce"
                  data-ifai-tab={row.next.tab}
                  aria-label={`${row.next.label} for ${row.division}`}
                >
                  {row.next.label}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
