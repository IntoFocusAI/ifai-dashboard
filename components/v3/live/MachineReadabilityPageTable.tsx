"use client";

import { Fragment, useState } from "react";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  SET_ASIDE_COLUMN,
  SetAsideCell,
  SetAsideFormRow,
  SetAsideHistory,
  useCheckSetAsides,
} from "@/components/v3/live/SetAsideTable";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  fieldLabel,
  type MachineHeroId,
  type SpecPage,
  type SpecPageSummary,
} from "@/lib/fender-canvas/machine-readability";
import { schemaPageHref } from "@/lib/fender-canvas/spec-table-sort";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import { brandSite } from "@/lib/brand-copy";
import { TableExportButton } from "@/components/v3/live/TableExportButton";

const PAGE = 20;
const ASIN_PREVIEW = 3;

const COLUMNS: RetailColumn[] = [
  { id: "page", name: `${brandSite()} page`, label: `${brandSite()} page`, width: 280, minWidth: 160, sort: "text" },
  { id: "listings", name: "Amazon listings", label: "Amazon listings", width: 220, minWidth: 140, sort: "number" },
  { id: "missing", name: "Missing", label: "Missing", width: 160, minWidth: 110, sort: "text" },
  { id: "checked", name: "Checked", label: "Checked", width: 170, minWidth: 130, sort: "text" },
];

const TABLE_COLUMNS = [...COLUMNS, SET_ASIDE_COLUMN];

const FILTER_TITLE: Record<MachineHeroId, string> = {
  missing_specs: "Pages missing machine-readable specs",
  product_basics: "Pages missing a product basic",
};

const FILTER_EMPTY: Record<MachineHeroId, string> = {
  missing_specs: "Every checked page has machine-readable specs.",
  product_basics: "Every checked page has all seven basics.",
};

function matches(page: SpecPage, filter: MachineHeroId): boolean {
  return filter === "missing_specs" ? !page.hasSpecBlock : page.missingBasics.length > 0;
}

function sortValue(page: SpecPage, columnId: string): SortInput {
  if (columnId === "page") return page.model || page.url;
  if (columnId === "listings") return page.asins.length;
  if (columnId === "missing") return page.missingFields.map(fieldLabel).join(", ");
  if (columnId === "checked") return page.checkedAt;
  return null;
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function Listings({ asins }: { asins: string[] }) {
  const shown = asins.slice(0, ASIN_PREVIEW);
  const rest = asins.length - shown.length;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {shown.map((asin) => {
        const href = amazonHref(asin);
        return href ? (
          <a
            key={asin}
            className="listing-link channel-tag channel-amz"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="asin-chip">{asin}</span>
          </a>
        ) : (
          <span key={asin} className="asin-chip">
            {asin}
          </span>
        );
      })}
      {rest > 0 ? <span style={{ fontSize: 11, color: "var(--text-muted)" }}>+{formatInt(rest)}</span> : null}
    </span>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
      <button type="button" className="segmented-btn" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        className="segmented-btn"
        disabled={page + 1 >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

/** One row per fender.com page, filtered to the open hero's gap. Most-linked pages first. */
export function MachineReadabilityPageTable({
  summary,
  filter,
  tableId,
}: {
  summary: SpecPageSummary;
  filter: MachineHeroId;
  tableId: string;
}) {
  const [page, setPage] = useState(0);
  const [seenFilter, setSeenFilter] = useState(filter);
  if (seenFilter !== filter) {
    setSeenFilter(filter);
    setPage(0);
  }
  const rows = summary.pages.filter((row) => matches(row, filter));
  const sorted = useClientTableSort(rows, COLUMNS, sortValue);
  const slice = sorted.rows.slice(page * PAGE, page * PAGE + PAGE);
  const setAsides = useCheckSetAsides(SET_ASIDE_CHECKS.brandSiteSpecs, "Brand-Site Specs");

  return (
    <div
      className="content-box"
      style={{ marginTop: 12 }}
      id={tableId}
      data-machine-readability-table={filter}
    >
      <div className="content-box-title">
        <span>{FILTER_TITLE[filter]}</span>
        <span className="tag-badge tag-neutral" data-machine-page-count={rows.length}>
          {formatInt(rows.length)} pages
        </span>
        <TableExportButton table="brand-site-pages" query={{ filter }} />
      </div>
      <ResizableTable
        tableId="machine-readability-pages"
        columns={TABLE_COLUMNS}
        fillColumnId="page"
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={(columnId) => {
          setPage(0);
          sorted.onSort(columnId);
        }}
      >
        <tbody>
          {slice.length === 0 ? (
            <tr>
              <td colSpan={TABLE_COLUMNS.length}>{FILTER_EMPTY[filter]}</td>
            </tr>
          ) : (
            slice.map((row) => {
              const href = schemaPageHref(row.url);
              return (
                <Fragment key={row.url}>
                <tr data-machine-page={row.url}>
                  <td>
                    <strong>{row.model || `${brandSite()} page`}</strong>
                    <br />
                    {href ? (
                      <a className="listing-link" href={href} target="_blank" rel="noopener noreferrer">
                        {row.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      row.url
                    )}
                  </td>
                  <td>
                    <Listings asins={row.asins} />
                  </td>
                  <td>
                    {row.missingFields.map((field) => (
                      <span key={field} className="tag-badge tag-neutral spec-field-pill">
                        {fieldLabel(field)}
                      </span>
                    ))}
                  </td>
                  <td>{formatCheckedAt(row.checkedAt) ?? ""}</td>
                  <SetAsideCell ctl={setAsides} entityKey={row.url} canSetAside={Boolean(href)} />
                </tr>
                <SetAsideFormRow
                  ctl={setAsides}
                  entityKey={row.url}
                  entityLabel={row.model || null}
                  colSpan={TABLE_COLUMNS.length}
                />
                </Fragment>
              );
            })
          )}
        </tbody>
      </ResizableTable>
      <Pager page={page} total={rows.length} onPage={setPage} />
      <SetAsideHistory ctl={setAsides} />
    </div>
  );
}
