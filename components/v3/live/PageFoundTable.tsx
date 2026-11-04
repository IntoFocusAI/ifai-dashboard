"use client";

import { useCallback, useMemo, useState } from "react";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { ALL_REASONS, NotFoundReasonCell, ReasonFilter } from "@/components/v3/live/PageFoundReason";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import type { PageFoundRead } from "@/components/v3/live/usePageFoundEvidence";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  evidenceMatchesHero,
  type PageFoundEvidence,
  type PageFoundRow,
} from "@/lib/fender-canvas/page-found-evidence";
import type { PageFoundHeroModel } from "@/lib/fender-canvas/page-found-hero";
import {
  notFoundReasons,
  REASON_COLUMN_TOOLTIP,
  reasonGroups,
  type NotFoundReason,
} from "@/lib/fender-canvas/page-found-reasons";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import "@/components/v3/live/page-found.css";

const PAGE = 50;

type Filter = "all" | "found" | "not_found";

const COLUMNS: RetailColumn[] = [
  { id: "asin", name: "Amazon listing", label: "Amazon listing", width: 130, minWidth: 110, sort: "text", className: "asin-col" },
  { id: "model", name: "Model", label: "Model", width: 280, minWidth: 140, sort: "text" },
  { id: "status", name: "Page found", label: "Page found", width: 120, minWidth: 100, sort: "text" },
  {
    id: "evidence",
    name: "fender.com page or reason",
    label: "fender.com page or reason",
    width: 320,
    minWidth: 180,
    sort: "text",
    headerTooltip: REASON_COLUMN_TOOLTIP,
  },
  { id: "checked", name: "Checked", label: "Checked", width: 170, minWidth: 130, sort: "date" },
];

const MISMATCH_TIP =
  "This list and the headline figure were read at different moments, so their counts differ. Reload to read both again.";

type Reasons = ReadonlyMap<string, NotFoundReason>;

function sortValue(row: PageFoundRow, columnId: string, reasons: Reasons): SortInput {
  if (columnId === "asin") return row.asin;
  if (columnId === "model") return row.model || null;
  if (columnId === "status") return row.found ? "Found" : "Not found";
  if (columnId === "evidence") return row.pageHref ?? reasons.get(row.asin)?.group ?? null;
  if (columnId === "checked") return row.checkedAt;
  return null;
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function rowsFor(evidence: PageFoundEvidence, filter: Filter, reason: string, reasons: Reasons): PageFoundRow[] {
  if (filter === "found") return evidence.rows.filter((row) => row.found);
  if (filter === "not_found") {
    return evidence.rows.filter(
      (row) => !row.found && (reason === ALL_REASONS || reasons.get(row.asin)?.group === reason),
    );
  }
  return evidence.rows;
}

function Evidence({ row, reason }: { row: PageFoundRow; reason: NotFoundReason | undefined }) {
  if (!row.found) return reason ? <NotFoundReasonCell reason={reason} /> : null;
  if (!row.pageHref) return <span className="page-found-reason">Page address not recorded</span>;
  return (
    <a
      className="listing-link"
      href={row.pageHref}
      target="_blank"
      rel="noopener noreferrer"
      data-page-found-link=""
    >
      {row.pageHref.replace(/^https?:\/\/(www\.)?/, "")}
    </a>
  );
}

function SkuRow({ row, reason }: { row: PageFoundRow; reason: NotFoundReason | undefined }) {
  const amazon = amazonHref(row.asin);
  return (
    <tr data-page-found-row={row.found ? "found" : "not_found"} data-asin={row.asin}>
      <td>
        {amazon ? (
          <a className="listing-link" href={amazon} target="_blank" rel="noopener noreferrer">
            <span className="asin-chip">{row.asin}</span>
          </a>
        ) : (
          <span className="asin-chip">{row.asin}</span>
        )}
      </td>
      <td>
        <span className="page-found-model">{row.model}</span>
      </td>
      <td>
        <span className={`tag-badge page-found-status ${row.found ? "tag-success" : "tag-danger"}`}>
          {row.found ? "Found" : "Not found"}
        </span>
      </td>
      <td>
        <Evidence row={row} reason={reason} />
      </td>
      <td>{formatCheckedAt(row.checkedAt) ?? ""}</td>
    </tr>
  );
}

function FilterButtons({
  evidence,
  filter,
  onFilter,
}: {
  evidence: PageFoundEvidence;
  filter: Filter;
  onFilter: (next: Filter) => void;
}) {
  const options: Array<[Filter, string, number]> = [
    ["all", "All checked", evidence.checked],
    ["found", "Found", evidence.found],
    ["not_found", "Not found", evidence.notFound],
  ];
  return (
    <div className="page-found-filters">
      <div className="segmented-control" role="group" aria-label="Page found">
        {options.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`segmented-btn${filter === id ? " active" : ""}`}
            aria-pressed={filter === id}
            data-page-found-filter={id}
            data-page-found-filter-count={count}
            onClick={() => onFilter(id)}
          >
            {label} {formatInt(count)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE) return null;
  return (
    <div className="page-found-pager">
      <button type="button" className="segmented-btn" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page + 1} of {pages}
      </span>
      <button type="button" className="segmented-btn" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

/**
 * Every checked SKU behind the page-found hero: found rows link to fender.com, not-found
 * rows name the stored reason and the listing's Findability result.
 */
export function PageFoundTable({
  read,
  hero,
  tableId,
}: {
  read: PageFoundRead;
  hero: PageFoundHeroModel;
  tableId: string;
}) {
  const findability = useFindability();
  const [filter, setFilter] = useState<Filter>("all");
  const [reasonFilter, setReasonFilter] = useState<string>(ALL_REASONS);
  const [page, setPage] = useState(0);
  const evidence = read.phase === "ready" ? read.evidence : null;
  const reasons = useMemo(
    () => notFoundReasons(evidence?.rows ?? [], findability),
    [evidence, findability],
  );
  const groups = useMemo(() => reasonGroups(reasons.values()), [reasons]);
  const activeReason = groups.some((group) => group.key === reasonFilter) ? reasonFilter : ALL_REASONS;
  const rows = evidence ? rowsFor(evidence, filter, activeReason, reasons) : [];
  const value = useCallback(
    (row: PageFoundRow, columnId: string) => sortValue(row, columnId, reasons),
    [reasons],
  );
  const sorted = useClientTableSort(rows, COLUMNS, value);
  const slice = sorted.rows.slice(page * PAGE, page * PAGE + PAGE);
  const matches = evidence && hero.denominator != null ? evidenceMatchesHero(evidence, hero) : true;

  return (
    <div
      className="content-box"
      style={{ marginTop: 12 }}
      id={tableId}
      data-page-found-table={read.phase}
      data-page-found-found={evidence?.found ?? ""}
      data-page-found-not-found={evidence?.notFound ?? ""}
      data-page-found-checked={evidence?.checked ?? ""}
      data-page-found-matches-hero={evidence ? String(matches) : ""}
    >
      <div className="content-box-title">
        <span>
          fender.com page by checked SKU
          {matches ? null : (
            <span
              className="ifai-term page-found-mismatch"
              data-ifai-tooltip-title="Counts differ"
              data-ifai-tooltip-desc={MISMATCH_TIP}
              tabIndex={0}
              aria-label={`Counts differ: ${MISMATCH_TIP}`}
            >
              *
            </span>
          )}
        </span>
        {evidence ? (
          <span className="tag-badge tag-neutral">
            {formatInt(evidence.found)} of {formatInt(evidence.checked)} found
          </span>
        ) : null}
      </div>
      {evidence ? (
        <FilterButtons
          evidence={evidence}
          filter={filter}
          onFilter={(next) => {
            setFilter(next);
            setReasonFilter(ALL_REASONS);
            setPage(0);
          }}
        />
      ) : null}
      {evidence && filter === "not_found" && findability.phase !== "loading" ? (
        <ReasonFilter
          groups={groups}
          total={evidence.notFound}
          value={activeReason}
          onChange={(next) => {
            setReasonFilter(next);
            setPage(0);
          }}
        />
      ) : null}
      <ResizableTable
        tableId="brand-site-page-found"
        columns={COLUMNS}
        fillColumnId="evidence"
        wrapColumnIds={["model"]}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={(columnId) => {
          setPage(0);
          sorted.onSort(columnId);
        }}
      >
        <tbody>
          {read.phase === "loading" ? (
            <tr>
              <td colSpan={COLUMNS.length}>Loading checked SKUs…</td>
            </tr>
          ) : null}
          {read.phase === "error" ? (
            <tr>
              <td colSpan={COLUMNS.length}>The checked-SKU list could not be loaded.</td>
            </tr>
          ) : null}
          {evidence && slice.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length}>No checked SKUs in this view.</td>
            </tr>
          ) : null}
          {slice.map((row) => (
            <SkuRow key={row.asin} row={row} reason={reasons.get(row.asin)} />
          ))}
        </tbody>
      </ResizableTable>
      <Pager page={page} total={rows.length} onPage={setPage} />
    </div>
  );
}
