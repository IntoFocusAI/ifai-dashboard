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
import { trendHeader, trendRunLabel } from "@/lib/ai-search/tables";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

type TrendRow = { key: string; point: TrendPoint; series: string; apiDays: readonly string[] };

function trendColumns(breakdown: TrendBreakdown) {
  const header = trendHeader(breakdown);
  const run = clientColumn("run", header[0], "date", 300, 180);
  const rate = clientColumn("rate", header[breakdown === "engine" ? 2 : 1], "number", 240, 170);
  const outside = clientColumn("outside", header[breakdown === "engine" ? 3 : 2], "number", 260, 170);
  return breakdown === "engine"
    ? [run, clientColumn("series", header[1], "text", 150, 110), rate, outside]
    : [run, rate, outside];
}

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
  const columns = useMemo(() => trendColumns(breakdown), [breakdown]);
  const sorted = useClientTableSort(rows, columns, trendValue, rowKey);
  const exportScope = useAiExportScope({ trend: { metric, breakdown, query } });
  return (
    <ResizableTable
      tableId="ai-history-trend"
      columns={columns}
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
            {breakdown === "engine" ? <td>{row.series}</td> : null}
            <td>{rateLabel(row.point)}</td>
            <td>{coverageLabel(row.point)}</td>
          </tr>
        ))}
      </tbody>
    </ResizableTable>
  );
}
