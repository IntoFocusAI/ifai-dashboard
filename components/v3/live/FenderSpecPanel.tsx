"use client";

import { useEffect, useState } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useFullPopulationSort } from "@/components/v3/live/useFullPopulationSort";
import { specRowsQuery } from "@/lib/canvasData";
import { CLIENT_TABLE_PAGE_SIZE, loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import { specReadinessSortValue } from "@/lib/fender-canvas/spec-table-sort";
import {
  specModelTitle,
  type CanvasSpecMissingRow,
  type CanvasSpecReadinessRow,
} from "@/lib/fender-canvas/types";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import {
  presentMissingAmazonFields,
  presentMissingFieldShare,
} from "@/lib/fender-canvas/spec-missing-fields";

const SPEC_COLUMNS = [
  clientColumn("asin", "ASIN", "text", 118, 100, "asin-col"),
  clientColumn("model", "Model", "text", 200, 120),
  clientColumn("amazon", "Amazon completeness", "number", 140, 110),
  clientColumn("missing", "Missing Amazon fields", "text", 240, 160),
];

/** First-visit viewport; page size stays 50. Shorter heroes leave more room for this table. */
const SPEC_TABLE_MAX_HEIGHT = 420;

/** The list opens on the two heaviest fields. The title chevron reveals the rest. */
const MISSING_FIELD_PREVIEW = 2;

function amazonMissingRows(missing: CanvasSpecMissingRow[]): CanvasSpecMissingRow[] {
  return missing.filter((row) => (row.source ?? "").toLowerCase() === "amazon");
}

function FieldsChevron() {
  return (
    <svg
      className="retail-explore-chevron"
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

function MissingFieldRow({
  row,
  specChecked,
}: {
  row: CanvasSpecMissingRow;
  specChecked: number | null;
}) {
  const share = presentMissingFieldShare(row.sku_count, specChecked);
  const countLabel =
    share.kind === "share" ? share.label : `${share.label} · ${share.shareLabel}`;

  return (
    <div
      className="spec-missing-field-row"
      data-spec-missing-field={row.field}
      data-spec-missing-share={share.kind}
      data-spec-missing-bar={share.barPct == null ? "" : String(share.barPct)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
        <span>{row.field}</span>
        <span data-spec-missing-count="">{countLabel}</span>
      </div>
      {share.barPct != null ? (
        <div className="readiness-progress-bar" aria-hidden="true">
          <div className="readiness-progress-fill" style={{ width: `${share.barPct}%` }} />
        </div>
      ) : (
        <div className="readiness-progress-bar" aria-hidden="true" data-spec-missing-bar-empty="">
          <div className="readiness-progress-fill" style={{ width: "0%" }} />
        </div>
      )}
    </div>
  );
}

function MissingFieldList({
  missing,
  specChecked,
}: {
  missing: CanvasSpecMissingRow[];
  specChecked: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const amazonOnly = amazonMissingRows(missing);
  const shown = showAll ? amazonOnly : amazonOnly.slice(0, MISSING_FIELD_PREVIEW);
  const rest = amazonOnly.length - MISSING_FIELD_PREVIEW;
  const collapsed = rest > 0 && !showAll;

  if (amazonOnly.length === 0) return null;

  return (
    <div className="content-box spec-missing-fields-box" style={{ marginTop: 12 }}>
      <div className="content-box-title spec-missing-fields-title">
        <span>Top missing Amazon fields</span>
        {rest > 0 ? (
          <button
            type="button"
            className="retail-explore"
            aria-expanded={showAll}
            aria-controls="spec-missing-fields"
            aria-label={
              showAll
                ? "Show fewer missing Amazon fields"
                : `Show all ${formatInt(amazonOnly.length)} missing Amazon fields`
            }
            data-spec-missing-fields-toggle={showAll ? "all" : "preview"}
            onClick={() => setShowAll((value) => !value)}
          >
            <FieldsChevron />
          </button>
        ) : null}
      </div>
      <div
        id="spec-missing-fields"
        className={collapsed ? "spec-missing-fields-preview" : undefined}
      >
        {shown.map((row) => (
          <MissingFieldRow key={`${row.source}-${row.field}`} row={row} specChecked={specChecked} />
        ))}
      </div>
    </div>
  );
}

export function FenderSpecPanel({
  missing,
  specChecked = null,
  catalogReadiness = false,
}: {
  missing: CanvasSpecMissingRow[];
  /** canvas_metrics.spec_checked for the same canvas read. */
  specChecked?: number | null;
  /** Amazon Specs passes this. Brand-Site Specs has its own page panel. */
  catalogReadiness?: boolean;
}) {
  if (!catalogReadiness) return null;
  return <CatalogSpecReadiness missing={missing} specChecked={specChecked} />;
}

function CatalogSpecReadiness({
  missing,
  specChecked,
}: {
  missing: CanvasSpecMissingRow[];
  specChecked: number | null;
}) {
  const [rows, setRows] = useState<CanvasSpecReadinessRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const population = useFullPopulationSort(
    rows,
    SPEC_COLUMNS,
    specReadinessSortValue,
    (row) => row.asin,
    CLIENT_TABLE_PAGE_SIZE,
  );

  useEffect(() => {
    let cancelled = false;
    void loadFilteredPages(async (page, size) => {
      const result = await specRowsQuery(page, size);
      return {
        data: (result.data ?? []) as CanvasSpecReadinessRow[],
        error: result.error,
        count: result.count,
      };
    }).then(
      (result) => {
        if (cancelled) return;
        if (result.error) {
          setRows([]);
          setTotal(null);
          setLoading(false);
          return;
        }
        setRows(result.rows);
        setTotal(result.total);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <MissingFieldList missing={missing} specChecked={specChecked} />

      <div className="content-box" style={{ marginTop: 12 }} id="spec-readiness-by-asin">
        <div className="content-box-title">
          <span>Amazon listings</span>
          {total != null ? (
            <span className="tag-badge tag-neutral">{formatInt(total)} rows</span>
          ) : null}
        </div>
        <ResizableTable
          tableId="spec-readiness"
          columns={SPEC_COLUMNS}
          freezeHeader
          maxHeight={SPEC_TABLE_MAX_HEIGHT}
          fillColumnId="missing"
          wrapColumnIds={["model"]}
          sort={population.sort}
          onSort={population.onSort}
        >
          <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>Loading…</td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No spec rows in this read.</td>
                </tr>
              ) : null}
              {population.pageRows.map((row) => {
                const missingFields = presentMissingAmazonFields(
                  row.amazon_missing_fields,
                  row.amazon_completeness_pct,
                );
                return (
                  <tr key={row.asin}>
                    <td>
                      <span className="asin-chip">{row.asin}</span>
                    </td>
                    <td>{specModelTitle(row.title)}</td>
                    <td>{formatPct(row.amazon_completeness_pct)}</td>
                    <td>
                      {missingFields.kind === "fields"
                        ? missingFields.fields.map((field) => (
                            <span key={field} className="tag-badge tag-neutral spec-field-pill">
                              {field}
                            </span>
                          ))
                        : missingFields.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </ResizableTable>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="segmented-btn"
            disabled={population.page <= 0}
            onClick={() => population.setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: 11 }}>
            {population.page + 1} / {population.pages}
          </span>
          <button
            type="button"
            className="segmented-btn"
            disabled={population.page + 1 >= population.pages}
            onClick={() => population.setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
