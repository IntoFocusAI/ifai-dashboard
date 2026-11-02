"use client";

import { Fragment, useEffect, useState } from "react";
import { clientColumn, ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
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
import { presentMissingAmazonFields } from "@/lib/fender-canvas/spec-missing-fields";
import { FMIC_CLIENT_KEY, SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { ReopenForm, SetAsideForm } from "@/lib/set-aside/SetAsideForm";
import { formatSetAsideDate, useSetAsides, type SetAsideRow } from "@/lib/set-aside/set-aside";

const SPEC_COLUMNS = [
  clientColumn("asin", "ASIN", "text", 118, 100, "asin-col"),
  clientColumn("model", "Model", "text", 200, 120),
  clientColumn("amazon", "Amazon completeness", "number", 140, 110),
  clientColumn("missing", "Missing Amazon fields", "text", 240, 160),
];

const SPEC_CHECK = SET_ASIDE_CHECKS.amazonSpecs;

/** Not sortable: set-asides are a per-check overlay, not a field on the spec read. */
const SET_ASIDE_COLUMN: RetailColumn = {
  id: "setaside",
  name: "Set aside",
  label: "Set aside",
  width: 150,
  minWidth: 110,
};

const SPEC_TABLE_COLUMNS = [...SPEC_COLUMNS, SET_ASIDE_COLUMN];

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

function MissingFieldList({ missing }: { missing: CanvasSpecMissingRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const amazonOnly = amazonMissingRows(missing);
  const maxCount = amazonOnly.reduce((max, row) => Math.max(max, row.sku_count ?? 0), 0) || 1;
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
          <div key={`${row.source}-${row.field}`} className="spec-missing-field-row">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span>{row.field}</span>
              <span>{formatInt(row.sku_count)} SKUs</span>
            </div>
            <div className="readiness-progress-bar">
              <div
                className="readiness-progress-fill"
                style={{ width: `${((row.sku_count ?? 0) / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FenderSpecPanel({
  missing,
  catalogReadiness = false,
}: {
  missing: CanvasSpecMissingRow[];
  /** Amazon Specs passes this. Brand-Site Specs has its own page panel. */
  catalogReadiness?: boolean;
}) {
  if (!catalogReadiness) return null;
  return <CatalogSpecReadiness missing={missing} />;
}

function CatalogSpecReadiness({ missing }: { missing: CanvasSpecMissingRow[] }) {
  const [rows, setRows] = useState<CanvasSpecReadinessRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const setAsides = useSetAsides(FMIC_CLIENT_KEY, SPEC_CHECK);
  const [formFor, setFormFor] = useState<string | null>(null);
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
      <MissingFieldList missing={missing} />

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
                            <span key={field} className="tag-badge tag-neutral spec-field-pill">
                              {field}
                            </span>
                          ))
                        : missingFields.label}
                    </td>
                    <td>
                      {setAside ? (
                        <span
                          className="tag-badge tag-neutral set-aside-chip"
                          title={setAsideTitle(setAside)}
                          data-spec-set-aside-chip={row.asin}
                        >
                          Set aside · {setAside.reason_label}
                        </span>
                      ) : missingFields.kind === "fields" ? (
                        <button
                          type="button"
                          className="cc-undo-btn"
                          aria-expanded={formFor === row.asin}
                          data-spec-set-aside={row.asin}
                          onClick={() => setFormFor((asin) => (asin === row.asin ? null : row.asin))}
                        >
                          Set aside
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {formFor === row.asin && !setAside ? (
                    <tr className="set-aside-form-row">
                      <td colSpan={SPEC_TABLE_COLUMNS.length}>
                        <SetAsideForm
                          checkKey={SPEC_CHECK}
                          subject={`${row.asin} on Amazon Specs`}
                          onCancel={() => setFormFor(null)}
                          onSubmit={async (input) => {
                            const result = await setAsides.setAside({
                              ...input,
                              entityKey: row.asin,
                              entityLabel: specModelTitle(row.title) || null,
                            });
                            if (result.ok) setFormFor(null);
                            return result;
                          }}
                        />
                      </td>
                    </tr>
                  ) : null}
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

      <SetAsideHistory
        rows={setAsides.rows}
        error={setAsides.error}
        onReopen={setAsides.reopen}
      />
    </>
  );
}

function setAsideTitle(row: SetAsideRow): string {
  const note = row.note ? ` · ${row.note}` : "";
  return `${row.reason_label}${note}. Set aside by ${row.set_by_name}, ${formatSetAsideDate(row.set_at)}.`;
}

/** Every Amazon Specs set-aside, active first, with Reopen on the active ones. */
function SetAsideHistory({
  rows,
  error,
  onReopen,
}: {
  rows: SetAsideRow[];
  error: string | null;
  onReopen: ReturnType<typeof useSetAsides>["reopen"];
}) {
  const [reopenFor, setReopenFor] = useState<string | null>(null);
  if (!rows.length && !error) return null;
  const active = rows.filter((row) => row.status === "active");
  const reopened = rows.filter((row) => row.status === "reopened");

  return (
    <details className="content-box cc-cleared" style={{ marginTop: 12 }} data-spec-set-aside-history="">
      <summary>
        Set aside on Amazon Specs: {formatInt(active.length)}
        {reopened.length ? ` · ${formatInt(reopened.length)} reopened` : ""}
      </summary>
      {error ? <p className="set-aside-error">Set-asides could not load: {error}</p> : null}
      <p className="set-aside-form-hint">
        Set-aside listings stay in the table and in the completeness figures above. They are marked so the team knows
        they were reviewed.
      </p>
      {[...active, ...reopened].map((row) => (
        <div key={row.id} className="cc-cleared-entry">
          <div className="cc-cleared-row">
            <span className="cc-cleared-text">
              <span>
                <span className="asin-chip">{row.entity_key}</span> {row.entity_label ?? ""}
              </span>
              <span className="cc-cleared-meta">
                {row.status === "reopened"
                  ? `Reopened by ${row.reopened_by_name}, ${formatSetAsideDate(row.reopened_at)}${row.reopen_note ? ` · ${row.reopen_note}` : ""}. Was: `
                  : ""}
                {setAsideTitle(row)}
              </span>
            </span>
            {row.status === "active" ? (
              <button
                type="button"
                className="cc-undo-btn"
                data-spec-reopen={row.entity_key}
                onClick={() => setReopenFor((id) => (id === row.id ? null : row.id))}
              >
                Reopen
              </button>
            ) : null}
          </div>
          {reopenFor === row.id ? (
            <ReopenForm
              subject={`${row.entity_key} on Amazon Specs`}
              onCancel={() => setReopenFor(null)}
              onSubmit={async (name, note) => {
                const result = await onReopen(row, name, note);
                if (result.ok) setReopenFor(null);
                return result;
              }}
            />
          ) : null}
        </div>
      ))}
    </details>
  );
}
