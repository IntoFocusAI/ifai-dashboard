"use client";

import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import {
  callsBehindPoint,
  questionsInRun,
  rateLabel,
  type QueryChoice,
  type TrendBreakdown,
  type TrendMetric,
  type TrendPoint,
} from "@/lib/ai-search/history-trends";
import { ROLE_LABELS } from "@/lib/ai-search/question-role";
import { cleanPrompt } from "@/lib/ai-search/run-metrics";
import { TREND_POINT_HEADER, trendPointCells, trendPointRows, type TrendPointRow } from "@/lib/ai-search/tables";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const COLUMNS = [
  clientColumn("question", TREND_POINT_HEADER[0], "text", 420, 220),
  clientColumn("engine", TREND_POINT_HEADER[1], "text", 140, 100),
  clientColumn("outcome", TREND_POINT_HEADER[2], "text", 220, 150),
  clientColumn("rate", TREND_POINT_HEADER[3], "text", 150, 110),
];

const rowKey = (row: TrendPointRow) => row.call.id;

function pointValue(row: TrendPointRow, columnId: string): SortInput {
  const cells = trendPointCells(row);
  return cells[COLUMNS.findIndex((column) => column.id === columnId)] ?? null;
}

/** The calls behind one trend point: the ones in its rate, and the ones that stayed outside it. */
export function HistoryPointDetail({
  snapshot,
  point,
  seriesKey,
  metric,
  breakdown,
  query,
}: {
  snapshot: AiSearchSnapshot;
  point: TrendPoint;
  seriesKey: string;
  metric: TrendMetric;
  breakdown: TrendBreakdown;
  query: QueryChoice;
}) {
  const { inRate, outside } = callsBehindPoint(snapshot, point, metric, query);
  const rows = trendPointRows(snapshot, point, metric, query);
  const sorted = useClientTableSort(rows, COLUMNS, pointValue, rowKey);
  const exportScope = useAiExportScope({
    trend: { metric, breakdown, query },
    point: { runId: point.runId, seriesKey },
  });
  const questions = questionsInRun(snapshot.calls.filter((call) => call.audit_run_id === snapshot.run.audit_run_id));
  return (
    <div className="ai-history-detail" data-ai-trend-detail={point.runId}>
      <p>
        {rateLabel(point)}. {inRate.length} resolved {inRate.length === 1 ? "call" : "calls"} are in this rate, and{" "}
        {outside.length} {outside.length === 1 ? "call" : "calls"} with{" "}
        <AiTerm term="no clear leader">no clear leader</AiTerm> or a <AiTerm term="provider error">provider error</AiTerm>{" "}
        {outside.length === 1 ? "is" : "are"} listed beside them.
      </p>
      <ResizableTable
        tableId="ai-trend-point"
        columns={COLUMNS}
        fillColumnId="question"
        maxHeight={360}
        sort={sorted.sort}
        onSort={sorted.onSort}
        exportScope={exportScope}
      >
        <tbody>
          {sorted.rows.map((row) => {
            const cells = trendPointCells(row);
            return (
              <tr key={row.call.id} data-ai-trend-call={row.call.id} data-ai-trend-bucket={row.inRate ? "rate" : "outside"}>
                {cells.map((cell, index) => (
                  <td key={COLUMNS[index].id}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </ResizableTable>
      <details>
        <summary>Questions in this run</summary>
        <ul>
          {questions.map((question) => (
            <li key={question.versionKey}>
              {ROLE_LABELS[question.role]}: {cleanPrompt(question.promptText)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
