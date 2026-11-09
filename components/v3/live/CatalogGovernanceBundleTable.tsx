"use client";

import { useState } from "react";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  catalogBundleBuyBoxLabel,
  catalogBundleLineLabel,
  catalogBundleSellerIdLabel,
  type UnnestedBundleOpportunity,
} from "@/lib/fender-canvas/portfolio-retail";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const PAGE = 20;

const BUNDLE_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 220, minWidth: 120, sort: "text" },
  { id: "asin", name: "ASIN", label: "ASIN", width: 118, minWidth: 108, className: "asin-col", sort: "text" },
  { id: "buybox", name: "Buy Box", label: "Buy Box", width: 180, minWidth: 110, sort: "text" },
  { id: "line", name: "Line", label: "Line", width: 120, minWidth: 88, sort: "text" },
];

function bundleSortValue(row: UnnestedBundleOpportunity, columnId: string): SortInput {
  if (columnId === "listing") return row.modelOrTitle?.trim() || row.bundleName?.trim() || null;
  if (columnId === "asin") return row.asin;
  if (columnId === "buybox") return catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName);
  if (columnId === "line") return catalogBundleLineLabel(row.category);
  return null;
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
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

function AsinLink({ asin, href }: { asin: string; href: string | null }) {
  if (!href) return <span className="asin-chip">{asin}</span>;
  return (
    <a className="listing-link channel-tag channel-amz" href={href} target="_blank" rel="noopener noreferrer">
      <span className="asin-chip">{asin}</span>
    </a>
  );
}

function BuyBoxCell({ row }: { row: UnnestedBundleOpportunity }) {
  const sellerId = catalogBundleSellerIdLabel(row.buyboxStatus, row.buyboxSellerId);
  return (
    <td data-bundle-buybox="">
      {catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName)}
      {sellerId ? <><br /><span className="asin-chip">{sellerId}</span></> : null}
    </td>
  );
}

/**
 * Splintered Listings table: bundles with a live offer and no usable parent ASIN, one page
 * at a time. Search and Download CSV cover every matching row, not only the page on screen.
 */
export function CatalogGovernanceBundleTable({ rows }: { rows: UnnestedBundleOpportunity[] }) {
  const [page, setPage] = useState(0);
  const sorted = useClientTableSort(rows, BUNDLE_COLUMNS, bundleSortValue);
  // A search or a sort can leave fewer pages than the one on screen.
  const lastPage = Math.max(0, Math.ceil(sorted.rows.length / PAGE) - 1);
  const shown = Math.min(page, lastPage);
  const slice = sorted.rows.slice(shown * PAGE, shown * PAGE + PAGE);
  return (
    <>
      <ResizableTable
        tableId="catalog-bundles"
        columns={BUNDLE_COLUMNS}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        controls={sorted.controls}
        onSort={(columnId) => {
          setPage(0);
          sorted.onSort(columnId);
        }}
      >
        <tbody>
          {slice.length === 0 ? (
            <tr>
              <td colSpan={BUNDLE_COLUMNS.length}>No unnested bundle is confirmed in this retail read.</td>
            </tr>
          ) : (
            slice.map((row) => (
              <tr key={row.asin}>
                <td>
                  <strong>{row.modelOrTitle ?? "Listing"}</strong>
                  {row.bundleName ? (
                    <>
                      <br />
                      {row.bundleName}
                    </>
                  ) : null}
                </td>
                <td className="asin-col">
                  <AsinLink asin={row.asin} href={httpUrl(row.productUrl) ?? amazonHref(row.asin)} />
                </td>
                <BuyBoxCell row={row} />
                <td>{catalogBundleLineLabel(row.category)}</td>
              </tr>
            ))
          )}
        </tbody>
      </ResizableTable>
      <Pager page={shown} total={sorted.rows.length} onPage={setPage} />
    </>
  );
}
