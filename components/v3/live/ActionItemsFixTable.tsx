"use client";

import { useCallback } from "react";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { PlanAction, PlanEvidence, PlanFigure, PlanStatus } from "@/components/v3/live/RoadmapPlanParts";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { phaseWindow } from "@/lib/fender-canvas/roadmap-dates";
import { PLAN_PHASES, phaseLabel, type PlanItem } from "@/lib/fender-canvas/roadmap-plan";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

export const FIX_TABLE_ID = "action-items-fixes";

const COLUMNS: RetailColumn[] = [
  { id: "rank", name: "#", label: "#", width: 48, minWidth: 48, sort: "number" },
  { id: "action", name: "What to fix", label: "What to fix", width: 420, minWidth: 240, sort: "text" },
  { id: "finding", name: "Finding", label: "Finding", width: 220, minWidth: 170, sort: "number" },
  { id: "status", name: "Status", label: "Status", width: 120, minWidth: 104, sort: "text" },
  { id: "phase", name: "Phase", label: "Phase", width: 104, minWidth: 104, sort: "number" },
  { id: "evidence", name: "Evidence", label: "Evidence", width: 220, minWidth: 180, sort: "text" },
];

const WRAP = ["finding", "phase", "evidence"] as const;

function shareOf(item: PlanItem): number | null {
  const match = /^([\d,]+) of ([\d,]+)/.exec(item.ratio ?? "");
  if (!match) return null;
  const denominator = Number(match[2]!.replace(/,/g, ""));
  return denominator > 0 ? Number(match[1]!.replace(/,/g, "")) / denominator : null;
}

const rowKey = (item: PlanItem) => item.id;

/**
 * Every plan item in Action Items order (decision 21 f) on the shared table: each column sorts,
 * the toolbar searches and counts rows. Rows are not clickable; the evidence button opens the tab.
 */
export function ActionItemsFixTable({ plan, today }: { plan: readonly PlanItem[]; today: Date }) {
  const sortValue = useCallback((item: PlanItem, columnId: string): SortInput => {
    if (columnId === "rank") return item.rank;
    if (columnId === "action") return `${item.kind === "finding" ? "" : `${item.fact} `}${item.action}`;
    if (columnId === "finding") return shareOf(item);
    if (columnId === "status") return item.statusLabel;
    if (columnId === "phase") {
      const index = PLAN_PHASES.findIndex((phase) => phase.id === item.phase);
      return index >= 0 ? index : PLAN_PHASES.length;
    }
    if (columnId === "evidence") return item.open.tab;
    return null;
  }, []);
  const sorted = useClientTableSort(plan, COLUMNS, sortValue, rowKey);

  return (
    <ResizableTable
      tableId={FIX_TABLE_ID}
      columns={COLUMNS}
      fillColumnId="action"
      wrapColumnIds={WRAP}
      sort={sorted.sort}
      onSort={sorted.onSort}
      tableClassName="table-no-row-hover"
    >
      <tbody data-fix-table="">
        {sorted.rows.map((item) => (
          <tr key={item.id} data-fix-row={item.id} data-fix-kind={item.kind}>
            <td className="money" data-fix-rank="">
              {item.rank}
            </td>
            <td>
              <PlanAction item={item} />
            </td>
            <td data-fix-finding="">
              <div className="plan-cell-label">{item.label}</div>
              {item.siteType ? <div className="plan-cell-sub">{item.siteType}</div> : null}
              <PlanFigure item={item} />
            </td>
            <td>
              <PlanStatus item={item} />
            </td>
            <td className="plan-cell-sub" data-fix-phase="">
              {phaseLabel(item.phase)}
              {item.phase ? <div data-fix-phase-dates="">{phaseWindow(item.phase, today).label}</div> : null}
            </td>
            <td>
              <PlanEvidence item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </ResizableTable>
  );
}
