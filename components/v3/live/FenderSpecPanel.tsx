"use client";

import { Fragment, useEffect, useState } from "react";
import { ReadNotAvailableMark } from "@/components/v3/live/ReadNotAvailable";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import {
  SET_ASIDE_COLUMN,
  SetAsideCell,
  SetAsideFormRow,
  SetAsideHistory,
  useCheckSetAsides,
} from "@/components/v3/live/SetAsideTable";
import { useFullPopulationSort } from "@/components/v3/live/useFullPopulationSort";
import { specRowsQuery } from "@/lib/canvasData";
import { CLIENT_TABLE_PAGE_SIZE, loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import { specReadinessSortValue } from "@/lib/fender-canvas/spec-table-sort";
import {
  specModelTitle,
  type CanvasReadFailure,
  type CanvasSpecMissingRow,
  type CanvasSpecReadinessRow,
} from "@/lib/fender-canvas/types";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import {
  amazonFieldLabel,
  presentMissingAmazonFields,
  presentMissingFieldShare,
} from "@/lib/fender-canvas/spec-missing-fields";
import type { AmazonSpecCheckRow } from "@/lib/findability/last-checked";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";

const SPEC_COLUMNS = [
  clientColumn("asin", "ASIN", "text", 118, 100, "asin-col"),
  clientColumn("model", "Model", "text", 200, 120),
  clientColumn("amazon", "Amazon completeness", "number", 140, 110),
  clientColumn("missing", "Missing Amazon fields", "text", 240, 160),
];

const SPEC_TABLE_COLUMNS = [...SPEC_COLUMNS, SET_ASIDE_COLUMN];

/** First-visit viewport; page size stays 50. Shorter heroes leave more room for this table. */
const SPEC_TABLE_MAX_HEIGHT = 420;

/** The list opens on the two heaviest fields. The title chevron reveals the rest. */
const MISSING_FIELD_PREVIEW = 2;

const MISSING_FIELDS_TITLE = "Top missing Amazon fields";

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
  metricsFailure,
}: {
  row: CanvasSpecMissingRow;
  specChecked: number | null;
  metricsFailure: CanvasReadFailure | null;
}) {
  const share = presentMissingFieldShare(row.sku_count, specChecked);
  const countLabel =
    share.kind === "share" ? (
      share.label
    ) : metricsFailure ? (
      <>
        {share.label} · <ReadNotAvailableMark failure={metricsFailure} />
      </>
    ) : (
      `${share.label} · ${share.shareLabel}`
    );

  return (
    <div
      className="spec-missing-field-row"
      data-spec-missing-field={row.field}
      data-spec-missing-share={share.kind}
      data-spec-missing-bar={share.barPct == null ? "" : String(share.barPct)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
        <span>{amazonFieldLabel(row.field)}</span>
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

/**
 * Top missing Amazon fields; sits beside the completeness hero on Amazon Specs. A failed
 * missing-field read keeps the box and reads Not available*; a failed metrics read
 * names that read on each share it cannot compute.
 */
export function MissingFieldList({
  missing,
  specChecked,
  missingFailure = null,
  metricsFailure = null,
}: {
  missing: CanvasSpecMissingRow[];
  specChecked: number | null;
  missingFailure?: CanvasReadFailure | null;
  metricsFailure?: CanvasReadFailure | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const amazonOnly = amazonMissingRows(missing);
  const shown = showAll ? amazonOnly : amazonOnly.slice(0, MISSING_FIELD_PREVIEW);
  const rest = amazonOnly.length - MISSING_FIELD_PREVIEW;
  const collapsed = rest > 0 && !showAll;

  if (missingFailure) {
    return (
      <div
        className="content-box spec-missing-fields-box"
        data-spec-missing-fields-box=""
        data-read-unavailable-box={missingFailure.source}
        style={{ flex: "1 1 240px", minWidth: 200 }}
      >
        <div className="content-box-title spec-missing-fields-title">
          <span>{MISSING_FIELDS_TITLE}</span>
        </div>
        <div>
          <ReadNotAvailableMark failure={missingFailure} />
        </div>
      </div>
    );
  }

  if (amazonOnly.length === 0) return null;

  return (
    <div
      className="content-box spec-missing-fields-box"
      data-spec-missing-fields-box=""
      style={{ flex: "1 1 240px", minWidth: 200 }}
    >
      <div className="content-box-title spec-missing-fields-title">
        <span>{MISSING_FIELDS_TITLE}</span>
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
          <MissingFieldRow
            key={`${row.source}-${row.field}`}
            row={row}
            specChecked={specChecked}
            metricsFailure={metricsFailure}
          />
        ))}
      </div>
    </div>
  );
}

/** A spec row with the stored check time the view also serves. */
export type AmazonSpecRow = CanvasSpecReadinessRow & AmazonSpecCheckRow;

export type AmazonSpecRowsRead =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; rows: AmazonSpecRow[]; total: number | null };

const NO_ROWS: AmazonSpecRow[] = [];

/** Every Amazon Specs row, read once for the heroes, Last checked, and the listings table. */
export function useAmazonSpecRows(): AmazonSpecRowsRead {
  const [read, setRead] = useState<AmazonSpecRowsRead>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadFilteredPages(async (page, size) => {
      const result = await specRowsQuery(page, size);
      return {
        data: (result.data ?? []) as AmazonSpecRow[],
        error: result.error,
        count: result.count,
      };
    }).then(
      (result) => {
        if (cancelled) return;
        setRead(result.error ? { phase: "error" } : { phase: "ready", rows: result.rows, total: result.total });
      },
      () => {
        if (!cancelled) setRead({ phase: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return read;
}

export function FenderSpecPanel({
  catalogReadiness = false,
  read,
}: {
  /** Amazon Specs passes this. Brand-Site Specs has its own page panel. */
  catalogReadiness?: boolean;
  read: AmazonSpecRowsRead;
}) {
  if (!catalogReadiness) return null;
  return <CatalogSpecReadiness read={read} />;
}

function CatalogSpecReadiness({ read }: { read: AmazonSpecRowsRead }) {
  const rows = read.phase === "ready" ? read.rows : NO_ROWS;
  const total = read.phase === "ready" ? read.total : null;
  const loading = read.phase === "loading";
  const setAsides = useCheckSetAsides(SET_ASIDE_CHECKS.amazonSpecs, "Amazon Specs");
  const population = useFullPopulationSort(
    rows,
    SPEC_COLUMNS,
    specReadinessSortValue,
    (row) => row.asin,
    CLIENT_TABLE_PAGE_SIZE,
  );

  return (
    <>
      <div className="content-box" style={{ marginTop: 12 }} id="spec-readiness-by-asin">
        <div className="content-box-title">
          <span>Amazon listings</span>
          {total != null ? (
            <span className="tag-badge tag-neutral">{formatInt(total)} rows</span>
          ) : null}
        </div>
        <ResizableTable
          tableId="spec-readiness"
          columns={SPEC_TABLE_COLUMNS}
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
                  <td colSpan={SPEC_TABLE_COLUMNS.length}>Loading…</td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={SPEC_TABLE_COLUMNS.length}>No spec rows in this read.</td>
                </tr>
              ) : null}
              {population.pageRows.map((row) => {
                const missingFields = presentMissingAmazonFields(
                  row.amazon_missing_fields,
                  row.amazon_completeness_pct,
                );
                const setAside = setAsides.active.get(row.asin);
                return (
                  <Fragment key={row.asin}>
                  <tr data-set-aside-row={setAside ? "active" : undefined}>
                    <td>
                      <span className="asin-chip">{row.asin}</span>
                    </td>
                    <td>{specModelTitle(row.title)}</td>
                    <td>{formatPct(row.amazon_completeness_pct)}</td>
                    <td>
                      {missingFields.kind === "fields"
                        ? missingFields.fields.map((field) => (
                            <span key={field} className="tag-badge tag-neutral spec-field-pill" data-spec-field={field}>
                              {amazonFieldLabel(field)}
                            </span>
                          ))
                        : missingFields.label}
                    </td>
                    <SetAsideCell
                      ctl={setAsides}
                      entityKey={row.asin}
                      canSetAside={missingFields.kind === "fields"}
                    />
                  </tr>
                  <SetAsideFormRow
                    ctl={setAsides}
                    entityKey={row.asin}
                    entityLabel={specModelTitle(row.title) || null}
                    colSpan={SPEC_TABLE_COLUMNS.length}
                  />
                  </Fragment>
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

      <SetAsideHistory ctl={setAsides} />
    </>
  );
}

