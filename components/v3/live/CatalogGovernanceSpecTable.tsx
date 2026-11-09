"use client";

import { useState } from "react";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  listingMatchesSpecFilters,
  specFieldFindings,
  specGapFieldsCell,
  type SpecHowCloseFilter,
} from "@/lib/fender-canvas/catalog-governance-findings";
import {
  type AmazonSpecGap,
  type AmazonSpecGapDetail,
  type RetailReading,
} from "@/lib/fender-canvas/portfolio-retail";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const MOST_OF_THE_SPEC_DESC = "Missing 11 or more of the Amazon spec fields we check.";
const PAGE = 20;

const HOW_CLOSE_LABELS: Record<Exclude<SpecHowCloseFilter, null>, string> = {
  one: "One field",
  two: "Two fields",
  most: "Most of the spec",
};

/** The pressed filter buttons in plain words, written into the download. Null with none pressed. */
function specFilterLabel(
  fillFirst: { field: string; label: string }[],
  selectedFields: string[],
  howClose: SpecHowCloseFilter,
): string | null {
  const parts = [
    ...fillFirst.filter((line) => selectedFields.includes(line.field)).map((line) => line.label),
    ...(howClose ? [HOW_CLOSE_LABELS[howClose]] : []),
  ];
  return parts.length ? `Missing: ${parts.join(", ")}` : null;
}

const SPEC_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 220, minWidth: 120, sort: "text" },
  { id: "asin", name: "ASIN", label: "ASIN", width: 118, minWidth: 108, className: "asin-col", sort: "text" },
  { id: "fields", name: "Fields", label: "Fields", width: 160, minWidth: 100, sort: "text" },
];

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function specSortValue(row: AmazonSpecGap, columnId: string): SortInput {
  if (columnId === "listing") return row.modelOrTitle?.trim() || null;
  if (columnId === "asin") return row.asin;
  if (columnId === "fields") return specGapFieldsCell(row.missingFields);
  return null;
}

function AsinLink({ asin }: { asin: string }) {
  const href = amazonHref(asin);
  if (!href) return <span className="asin-chip">{asin}</span>;
  return (
    <a className="listing-link channel-tag channel-amz" href={href} target="_blank" rel="noopener noreferrer">
      <span className="asin-chip">{asin}</span>
    </a>
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        className="segmented-btn"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
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

function SpecFilters({
  fillFirst,
  selectedFields,
  howClose,
  onToggleField,
  onToggleHowClose,
}: {
  fillFirst: { field: string; label: string }[];
  selectedFields: string[];
  howClose: SpecHowCloseFilter;
  onToggleField: (field: string) => void;
  onToggleHowClose: (value: Exclude<SpecHowCloseFilter, null>) => void;
}) {
  return (
    <div
      data-catalog-governance-spec-filters=""
      style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}
    >
      {fillFirst.map((line) => {
        const pressed = selectedFields.includes(line.field);
        return (
          <button
            key={line.field}
            type="button"
            className={`segmented-btn${pressed ? " active" : ""}`}
            aria-pressed={pressed}
            onClick={() => onToggleField(line.field)}
          >
            {line.label}
          </button>
        );
      })}
      {(
        [
          ["one", "One field"],
          ["two", "Two fields"],
        ] as const
      ).map(([value, label]) => {
        const pressed = howClose === value;
        return (
          <button
            key={value}
            type="button"
            className={`segmented-btn${pressed ? " active" : ""}`}
            aria-pressed={pressed}
            onClick={() => onToggleHowClose(value)}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        className={`segmented-btn${howClose === "most" ? " active" : ""}`}
        aria-pressed={howClose === "most"}
        onClick={() => onToggleHowClose("most")}
      >
        <span
          className="ifai-term"
          data-ifai-tooltip-title="Most of the spec"
          data-ifai-tooltip-desc={MOST_OF_THE_SPEC_DESC}
          tabIndex={0}
          aria-label={`Most of the spec: ${MOST_OF_THE_SPEC_DESC}`}
        >
          Most of the spec
        </span>
      </button>
    </div>
  );
}

function SpecGapRows({ gaps }: { gaps: AmazonSpecGap[] }) {
  const [page, setPage] = useState(0);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [howClose, setHowClose] = useState<SpecHowCloseFilter>(null);
  const findings = specFieldFindings(gaps);

  const filtered = gaps.filter((gap) => listingMatchesSpecFilters(gap, selectedFields, howClose));
  const sorted = useClientTableSort(filtered, SPEC_COLUMNS, specSortValue);
  // A search or a filter can leave fewer pages than the one on screen.
  const lastPage = Math.max(0, Math.ceil(sorted.rows.length / PAGE) - 1);
  const shown = Math.min(page, lastPage);
  const slice = sorted.rows.slice(shown * PAGE, shown * PAGE + PAGE);

  function resetPage() {
    setPage(0);
  }

  return (
    <>
      <SpecFilters
        fillFirst={findings.fillFirst}
        selectedFields={selectedFields}
        howClose={howClose}
        onToggleField={(field) => {
          resetPage();
          setSelectedFields((prev) =>
            prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
          );
        }}
        onToggleHowClose={(value) => {
          resetPage();
          setHowClose((prev) => (prev === value ? null : value));
        }}
      />
      <ResizableTable
        tableId="catalog-spec-gaps"
        columns={SPEC_COLUMNS}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        controls={sorted.controls}
        filterLabel={specFilterLabel(findings.fillFirst, selectedFields, howClose)}
        onSort={(columnId) => {
          resetPage();
          sorted.onSort(columnId);
        }}
      >
        <tbody>
          {slice.length === 0 ? (
            <tr>
              <td colSpan={3}>No listing matches these filters.</td>
            </tr>
          ) : (
            slice.map((row) => (
              <tr key={row.asin}>
                <td>
                  <strong>{row.modelOrTitle?.trim() || "Listing"}</strong>
                </td>
                <td className="asin-col">
                  <AsinLink asin={row.asin} />
                </td>
                <td>{specGapFieldsCell(row.missingFields)}</td>
              </tr>
            ))
          )}
        </tbody>
      </ResizableTable>
      <Pager page={shown} total={sorted.rows.length} onPage={setPage} />
    </>
  );
}

/** Specs complete table: gap listings with field / how-close filters. */
export function CatalogGovernanceSpecTable({
  specs,
  tableId,
}: {
  specs: RetailReading<AmazonSpecGapDetail | null>;
  tableId: string;
}) {
  const detail = specs.detail;
  const ready = detail != null && detail.checked > 0;

  return (
    <div
      className="content-box"
      style={{ marginTop: 12 }}
      data-catalog-governance-specs-table=""
      id={tableId}
    >
      {ready ? (
        <SpecGapRows gaps={detail.gaps} />
      ) : (
        <ResizableTable tableId="catalog-spec-gaps" columns={SPEC_COLUMNS} freezeHeader maxHeight={520}>
          <tbody>
            <tr>
              <td colSpan={3}>Not available*</td>
            </tr>
          </tbody>
        </ResizableTable>
      )}
    </div>
  );
}
