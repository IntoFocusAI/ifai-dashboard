"use client";

import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { CATALOG_COVERAGE_TITLE, catalogCoverageTip } from "@/lib/ai-search/fact-check-copy";
import { catalogCoverage } from "@/lib/ai-search/probe-catalog";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";

/** "N of M catalog models checked" by category and engine. Renders nothing before the rotation. */
export function CatalogCoverageTable({ snapshot, windowed }: { snapshot: AiSearchSnapshot; windowed: boolean }) {
  const coverage = catalogCoverage(snapshot, windowed);
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
        <table className="table-sm" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Category</th>
              {coverage.engines.map((engine) => (
                <th key={engine}>{engineLabel(engine)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coverage.rows.map((row) => (
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
        </table>
      )}
    </div>
  );
}
