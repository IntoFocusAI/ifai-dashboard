"use client";

import { useMemo } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { CATALOG_COVERAGE_TITLE, catalogCoverageTip } from "@/lib/ai-search/fact-check-copy";
import { catalogCoverage, type CatalogCoverageCell } from "@/lib/ai-search/probe-catalog";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

type CoverageRow = { category: string; cells: Record<string, CatalogCoverageCell> };

const rowKey = (row: CoverageRow) => row.category;

/** "N of M catalog models checked" by category and engine. Renders nothing before the rotation. */
export function CatalogCoverageTable({ snapshot, windowed }: { snapshot: AiSearchSnapshot; windowed: boolean }) {
  const coverage = useMemo(() => catalogCoverage(snapshot, windowed), [snapshot, windowed]);
  const exportScope = useAiExportScope();
  const engines = coverage?.phase === "ready" ? coverage.engines : NO_ENGINES;
  const rows = coverage?.phase === "ready" ? coverage.rows : NO_ROWS;
  const columns = useMemo(
    () => [
      clientColumn("category", "Category", "text", 220, 140),
      ...engines.map((engine) => clientColumn(engine, engineLabel(engine), "number", 150, 110)),
    ],
    [engines],
  );
  const sorted = useClientTableSort(rows, columns, coverageValue, rowKey);
  if (!coverage) return null;
  return (
    <div className="content-box" style={{ marginTop: 12 }} data-ai-catalog-coverage={coverage.phase}>
      <div className="content-box-title">{CATALOG_COVERAGE_TITLE}</div>
      {coverage.phase === "unavailable" ? (
        <p style={{ ...mutedText, margin: 0 }}>
          <CopyTip label="Catalog coverage" description="The catalog coverage view did not load for this selection.">
            Not available*
          </CopyTip>
        </p>
      ) : (
        <ResizableTable
          tableId="catalog-coverage"
          columns={columns}
          fillColumnId="category"
          maxHeight={420}
          sort={sorted.sort}
          onSort={sorted.onSort}
          exportScope={exportScope}
        >
          <tbody>
            {sorted.rows.map((row) => (
              <tr key={row.category} data-ai-catalog-category={row.category}>
                <td>{row.category}</td>
                {coverage.engines.map((engine) => {
                  const cell = row.cells[engine];
                  return (
                    <td key={engine} data-ai-catalog-cell={engine}>
                      <CopyTip label={CATALOG_COVERAGE_TITLE} description={catalogCoverageTip(coverage.basis, cell.inScope)}>
                        {formatInt(cell.checked)} of {formatInt(cell.inScope)}
                      </CopyTip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      )}
    </div>
  );
}

const NO_ENGINES: string[] = [];
const NO_ROWS: CoverageRow[] = [];

function coverageValue(row: CoverageRow, columnId: string): SortInput {
  if (columnId === "category") return row.category;
  return row.cells[columnId]?.checked ?? null;
}
