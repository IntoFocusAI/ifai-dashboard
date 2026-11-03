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
import { formatInt } from "@/lib/fender-canvas/format";
import {
  contentGapRows,
  contentStateLabel,
  type ContentHeroId,
  type ListingContentRow,
  type ListingContentSummary,
} from "@/lib/fender-canvas/listing-content";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const PAGE = 20;

const COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 300, minWidth: 160, sort: "text" },
  { id: "asin", name: "ASIN", label: "ASIN", width: 118, minWidth: 108, className: "asin-col", sort: "text" },
  { id: "bullets", name: "Bullets", label: "Bullets", width: 90, minWidth: 80, sort: "number" },
  { id: "images", name: "Images", label: "Images", width: 90, minWidth: 80, sort: "number" },
  { id: "aplus", name: "A+", label: "A+", width: 120, minWidth: 96, sort: "text" },
  { id: "video", name: "Video", label: "Video", width: 120, minWidth: 96, sort: "text" },
];

const TABLE_COLUMNS = [...COLUMNS, SET_ASIDE_COLUMN];

const FILTER_TITLE: Record<ContentHeroId, string> = {
  bullets: "Listings with fewer than five bullets",
  aplus: "Listings with no A+ content",
  video: "Listings with no product video",
};

const FILTER_EMPTY: Record<ContentHeroId, string> = {
  bullets: "Every checked listing fills all five bullets.",
  aplus: "No listing is confirmed without A+ content.",
  video: "No listing is confirmed without a product video.",
};

function sortValue(row: ListingContentRow, columnId: string): SortInput {
  if (columnId === "listing") return row.title?.trim() || null;
  if (columnId === "asin") return row.asin;
  if (columnId === "bullets") return row.bullet_count;
  if (columnId === "images") return row.image_count;
  if (columnId === "aplus") return contentStateLabel(row.aplus_state);
  if (columnId === "video") return contentStateLabel(row.video_state);
  return null;
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
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

/** Live Amazon listings with the open hero's gap. Unknown A+ or video states are never listed as gaps. */
export function ListingContentTable({
  summary,
  filter,
  tableId,
}: {
  summary: ListingContentSummary;
  filter: ContentHeroId;
  tableId: string;
}) {
  const [page, setPage] = useState(0);
  const [seenFilter, setSeenFilter] = useState(filter);
  if (seenFilter !== filter) {
    setSeenFilter(filter);
    setPage(0);
  }
  const rows = contentGapRows(summary, filter);
  const sorted = useClientTableSort(rows, COLUMNS, sortValue);
  const slice = sorted.rows.slice(page * PAGE, page * PAGE + PAGE);
  const setAsides = useCheckSetAsides(SET_ASIDE_CHECKS.listingContent, "Listing Content");

  return (
    <div className="content-box" style={{ marginTop: 12 }} id={tableId} data-content-table={filter}>
      <div className="content-box-title">
        <span>{FILTER_TITLE[filter]}</span>
        <span className="tag-badge tag-neutral" data-content-count={rows.length}>
          {formatInt(rows.length)} listings
        </span>
      </div>
      <ResizableTable
        tableId="aplus-matrix-listings"
        columns={TABLE_COLUMNS}
        fillColumnId="listing"
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
              const href = amazonHref(row.asin);
              return (
                <Fragment key={row.asin}>
                <tr data-content-row={row.asin}>
                  <td>
                    <strong>{row.title?.trim() || "Listing"}</strong>
                  </td>
                  <td className="asin-col">
                    {href ? (
                      <a
                        className="listing-link channel-tag channel-amz"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="asin-chip">{row.asin}</span>
                      </a>
                    ) : (
                      <span className="asin-chip">{row.asin}</span>
                    )}
                  </td>
                  <td>{row.bullet_count == null ? "" : formatInt(row.bullet_count)}</td>
                  <td>{row.image_count == null ? "" : formatInt(row.image_count)}</td>
                  <td>{contentStateLabel(row.aplus_state)}</td>
                  <td>{contentStateLabel(row.video_state)}</td>
                  <SetAsideCell ctl={setAsides} entityKey={row.asin} canSetAside={Boolean(href)} />
                </tr>
                <SetAsideFormRow
                  ctl={setAsides}
                  entityKey={row.asin}
                  entityLabel={row.title?.trim() || null}
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
