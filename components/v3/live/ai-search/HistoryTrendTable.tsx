"use client";

import { useMemo } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import {
  coverageLabel,
  rateLabel,
  type QueryChoice,
  type TrendBreakdown,
  type TrendMetric,
  type TrendModel,
  type TrendPoint,
} from "@/lib/ai-search/history-trends";
import { TREND_HEADER, trendRunLabel } from "@/lib/ai-search/tables";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

type TrendRow = { key: string; point: TrendPoint; series: string; apiDays: readonly string[] };

const COLUMNS = [
  clientColumn("run", TREND_HEADER[0], "date", 300, 180),
  clientColumn("series", TREND_HEADER[1], "text", 150, 110),
  clientColumn("rate", TREND_HEADER[2], "number", 240, 170),
  clientColumn("outside", TREND_HEADER[3], "number", 260, 170),
];

const rowKey = (row: TrendRow) => row.key;

function trendValue(row: TrendRow, columnId: string): SortInput {
  const { point } = row;
  if (columnId === "run") return point.day;
  if (columnId === "series") return row.series;
  if (columnId === "rate") return point.callsLoaded && point.resolved > 0 ? point.wins / point.resolved : null;
  return point.callsLoaded ? point.notStored + point.unresolved + point.errors : null;
}

/** Every point of the trend as a row: the run, its series, the rate, and what stayed outside it. */
export function HistoryTrendTable({
  model,
  apiDays,
  metric,
  breakdown,
  query,
}: {
  model: TrendModel;
  apiDays: ReadonlyMap<string, string[]>;
  metric: TrendMetric;
  breakdown: TrendBreakdown;
  query: QueryChoice;
}) {
  const rows = useMemo<TrendRow[]>(
    () =>
      model.series.flatMap((series) =>
        series.points.map((point) => ({
          key: `${point.runId}:${series.key}`,
          point,
          series: series.label,
          apiDays: apiDays.get(point.runId) ?? [],
        })),
      ),
    [apiDays, model],
  );
  const sorted = useClientTableSort(rows, COLUMNS, trendValue, rowKey);
  const exportScope = useAiExportScope({ trend: { metric, breakdown, query } });
  return (
    <ResizableTable
      tableId="ai-history-trend"
      columns={COLUMNS}
      fillColumnId="run"
      maxHeight={360}
      sort={sorted.sort}
      onSort={sorted.onSort}
      exportScope={exportScope}
      tableClassName="ai-history-table"
    >
      <tbody>
        {sorted.rows.map((row) => (
          <tr key={row.key} data-ai-trend-row={row.key}>
            <td>{trendRunLabel(row.point, row.apiDays)}</td>
            <td>{row.series}</td>
            <td>{rateLabel(row.point)}</td>
            <td>{coverageLabel(row.point)}</td>
          </tr>
        ))}
      </tbody>
    </ResizableTable>
  );
}
