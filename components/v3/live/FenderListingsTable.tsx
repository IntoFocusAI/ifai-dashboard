"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChannelPriceCell } from "@/components/v3/live/ChannelPriceCell";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { ListingName, RETAIL_FIT_TABLE, wrapColumnIdsAfterFirst } from "@/components/v3/live/RetailOverviewFigure";
import { useFullPopulationSort } from "@/components/v3/live/useFullPopulationSort";
import { loadRetailListings } from "@/lib/canvasData";
import { CLIENT_TABLE_PAGE_SIZE } from "@/lib/fender-canvas/full-result-sort";
import { featuredOfferState } from "@/lib/fender-canvas/featured-offer";
import { formatInt, formatUsd, pendingLabel } from "@/lib/fender-canvas/format";
import { anyListingReviewCount, listingReviewLabel } from "@/lib/fender-canvas/listing-reviews";
import {
  exploreChannelColumns,
  listingChannelFacts,
  storedHttpUrl,
  type ChannelColumn,
} from "@/lib/fender-canvas/map-channels";
import { exploreListingSortValue } from "@/lib/fender-canvas/listing-table-sort";
import { MAP_LISTING_COLUMN_WIDTH } from "@/lib/fender-canvas/retail-column-layout";
import type { CanvasRetailListingRow } from "@/lib/fender-canvas/types";

/** The filter in plain words, written into the download. Null with no filter. */
function filterLabel(filter: Filter): string | null {
  if (filter.violationsOnly) return "MAP violations only";
  if (filter.bundlesOnly) return "Bundles only";
  return null;
}

type Filter = {
  status?: string;
  violationsOnly?: boolean;
  bundlesOnly?: boolean;
};

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function moneyColumn(id: string, name: string, width = 108): RetailColumn {
  return { id, name, label: name, width, minWidth: 96, className: "money", sort: "number" };
}

function exploreColumns(channels: ChannelColumn[], showReviews: boolean): RetailColumn[] {
  return [
    {
      id: "listing",
      name: "Listing",
      label: "Listing",
      width: MAP_LISTING_COLUMN_WIDTH,
      minWidth: 160,
      className: "listing-col",
      sort: "text",
    },
    { id: "asin", name: "ASIN", label: "ASIN", width: 92, minWidth: 88, className: "asin-col", sort: "text" },
    { id: "partner", name: "Partner / Bundle", label: "Partner / Bundle", width: 116, minWidth: 96, sort: "text" },
    { id: "map", name: "MAP", label: "MAP", width: 80, minWidth: 72, className: "money", sort: "number" },
    ...channels.map((channel) => moneyColumn(channel.key, channel.name, channel.key === "amazon" ? 116 : 108)),
    ...(showReviews
      ? [{ id: "reviews", name: "Reviews", label: "Reviews", width: 88, minWidth: 80, sort: "number" } as RetailColumn]
      : []),
    { id: "channels", name: "Channels", label: "Channels", width: 96, minWidth: 80, sort: "text" },
  ];
}

/**
 * A listing with no active offer keeps its last stored Amazon price for history.
 * Label it so the stored number is not read as a current offer.
 */
function lastSeenNote(row: CanvasRetailListingRow): string | null {
  return featuredOfferState(row) === "no_active_offer" ? "Last seen, no active offer" : null;
}

export function FenderListingsTable() {
  const [rows, setRows] = useState<CanvasRetailListingRow[]>([]);
  const [retailerKeys, setRetailerKeys] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      // R-10: retailer prices, worst leakage and the violation filter come from the retailer rows.
      const result = await loadRetailListings(filter);
      setRows(result.rows);
      setRetailerKeys(result.retailers.map((retailer) => retailer.key));
      setTotal(result.rows.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // A retailer column appears only when this client stores a price for it.
  const channels = useMemo(() => exploreChannelColumns(rows, retailerKeys), [rows, retailerKeys]);
  // No job writes review counts yet. The column appears once a listing stores one.
  const showReviews = useMemo(() => anyListingReviewCount(rows), [rows]);
  const columns = useMemo(() => exploreColumns(channels, showReviews), [channels, showReviews]);
  const sortValue = useCallback(
    (row: CanvasRetailListingRow, columnId: string) =>
      exploreListingSortValue(row, columnId, (id) => {
        const facts = listingChannelFacts(row);
        return facts.find((fact) => fact.key === id)?.price;
      }),
    [],
  );
  const population = useFullPopulationSort(
    rows,
    columns,
    sortValue,
    (row) => row.asin,
    CLIENT_TABLE_PAGE_SIZE,
  );

  return (
    <div className="content-box retail-listings-table" style={{ marginTop: 12 }}>
      <div className="content-box-title">
        <span>All listings</span>
        {total != null ? (
          <span className="tag-badge tag-neutral">{formatInt(total)} rows</span>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        <button
          type="button"
          className={`segmented-btn${!filter.violationsOnly && !filter.bundlesOnly ? " active" : ""}`}
          onClick={() => {
            population.resetPage();
            setFilter({});
          }}
        >
          All
        </button>
        <button
          type="button"
          className={`segmented-btn${filter.violationsOnly ? " active" : ""}`}
          onClick={() => {
            population.resetPage();
            setFilter({ violationsOnly: true });
          }}
        >
          MAP violations only
        </button>
        <button
          type="button"
          className={`segmented-btn${filter.bundlesOnly ? " active" : ""}`}
          onClick={() => {
            population.resetPage();
            setFilter({ bundlesOnly: true });
          }}
        >
          Bundles only
        </button>
      </div>

      {error ? (
        <p className="retail-missing">The listing read could not be loaded. {error}</p>
      ) : null}

      <ResizableTable
        tableId="explore-listings"
        columns={columns}
        freezeHeader
        maxHeight={520}
        sort={population.sort}
        onSort={population.onSort}
        filterLabel={filterLabel(filter)}
        wrapColumnIds={wrapColumnIdsAfterFirst(columns)}
        tableClassName={RETAIL_FIT_TABLE}
      >
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>Loading listings…</td>
            </tr>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No listings match this filter.</td>
            </tr>
          ) : null}
          {error && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>The listing read could not be loaded.</td>
            </tr>
          ) : null}
          {population.pageRows.map((row) => {
            const label = row.model_name?.trim() || row.title?.trim() || "Listing";
            const partner = row.bundle_name ?? row.buybox_seller_name ?? "n/a";
            const facts = new Map(
              listingChannelFacts(row).map((fact) => [fact.key, fact]),
            );
            const exploreHref = storedHttpUrl(row.product_url) ?? amazonHref(row.asin);
            return (
              <tr key={row.asin}>
                <td className="listing-col">
                  <ListingName name={label} />
                </td>
                <td className="asin-col">
                  {exploreHref ? (
                    <a
                      className="listing-link channel-tag channel-amz"
                      href={exploreHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="asin-chip">{row.asin}</span>
                    </a>
                  ) : (
                    <span className="asin-chip">{row.asin}</span>
                  )}
                </td>
                <td>{partner}</td>
                <td className="money">{row.map_price != null ? formatUsd(row.map_price) : pendingLabel()}</td>
                {channels.map((channel) => {
                  if (channel.key === "amazon") {
                    return <ChannelPriceCell key={channel.key} fact={facts.get("amazon")} note={lastSeenNote(row)} />;
                  }
                  // A retailer price without a stored checked page keeps its Not available* mark.
                  const fact = facts.get(channel.key);
                  return (
                    <ChannelPriceCell key={channel.key} fact={fact} href={fact?.url ?? null} requireCheckedPage />
                  );
                })}
                {showReviews ? <td>{listingReviewLabel(row.reviews_count)}</td> : null}
                <td>{row.channels?.trim() || "n/a"}</td>
              </tr>
            );
          })}
        </tbody>
      </ResizableTable>

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button
          type="button"
          className="segmented-btn"
          disabled={population.page <= 0 || loading}
          onClick={() => population.setPage((current) => Math.max(0, current - 1))}
        >
          Previous
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Page {population.page + 1} of {population.pages}
        </span>
        <button
          type="button"
          className="segmented-btn"
          disabled={population.page + 1 >= population.pages || loading}
          onClick={() => population.setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
