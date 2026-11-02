"use client";

import { clientColumn, ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useFullPopulationSort } from "@/components/v3/live/useFullPopulationSort";
import {
  attemptLabel,
  bucketLabel,
  confidenceLabel,
  dealerBundleLabel,
  findabilitySortValue,
  httpStatusLabel,
  listingTitle,
  presentExplanation,
  productKindLabel,
  sourceMethodLabel,
  uncheckedReason,
} from "@/lib/findability/copy";
import { CLIENT_TABLE_PAGE_SIZE } from "@/lib/fender-canvas/full-result-sort";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  findabilityOutcome,
  presentOfficialAddress,
  type FindabilityBucket,
  type FindabilityRow,
} from "@/lib/findability/outcomes";

const VARIANT_SKU_TOOLTIP = {
  title: "Variant SKU",
  description:
    "The brand's variant code stored with this official-page match. It is not the Amazon ASIN.",
} as const;

const VARIANT_SKU_COLUMN: RetailColumn = {
  ...clientColumn("sku", "Variant SKU", "text", 140, 110),
  headerTooltip: VARIANT_SKU_TOOLTIP,
};

const COLUMNS: readonly RetailColumn[] = [
  clientColumn("asin", "ASIN", "text", 124, 108, "asin-col"),
  clientColumn("title", "Listing", "text", 280, 180),
  clientColumn("outcome", "Outcome", "text", 200, 150),
  clientColumn("category", "Category", "text", 150, 110),
  clientColumn("kind", "Product kind", "text", 130, 110),
  clientColumn("page", "Official page", "text", 240, 160),
  VARIANT_SKU_COLUMN,
  clientColumn("confidence", "Confidence", "text", 150, 120),
  clientColumn("source", "How it was matched", "text", 170, 130),
  clientColumn("http", "HTTP status", "number", 110, 90),
  clientColumn("checked", "Checked", "date", 180, 140),
  clientColumn("explanation", "Explanation", "text", 320, 200),
  clientColumn("bundle", "Dealer bundle", "text", 150, 120),
];

const UNCHECKED_COLUMNS: readonly RetailColumn[] = [
  clientColumn("asin", "ASIN", "text", 124, 108, "asin-col"),
  clientColumn("title", "Listing", "text", 280, 180),
  clientColumn("reason", "Reason", "text", 280, 180),
  clientColumn("category", "Category", "text", 150, 110),
  clientColumn("kind", "Product kind", "text", 130, 110),
  VARIANT_SKU_COLUMN,
  clientColumn("confidence", "Confidence", "text", 150, 120),
  clientColumn("source", "How it was matched", "text", 170, 130),
  clientColumn("explanation", "Explanation", "text", 320, 200),
  clientColumn("bundle", "Dealer bundle", "text", 150, 120),
];

function columnsFor(outcome: FindabilityBucket): readonly RetailColumn[] {
  return outcome === "not_checked" ? UNCHECKED_COLUMNS : COLUMNS;
}

function OfficialPageCell({ row }: { row: FindabilityRow }) {
  const address = presentOfficialAddress(row);
  if (address.kind === "link") {
    return (
      <span className="listing-title-scroll">
        <a
          href={address.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer"
          data-findability-official-url={address.href}
        >
          {address.href}
        </a>
      </span>
    );
  }
  return <span data-findability-address={address.kind}>{address.text}</span>;
}

function ListingCell({
  columnId,
  row,
  bucket,
}: {
  columnId: string;
  row: FindabilityRow;
  bucket: FindabilityBucket;
}) {
  switch (columnId) {
    case "asin":
      return (
        <td className="asin-col">
          <span className="asin-chip">{row.asin}</span>
        </td>
      );
    case "title":
      return (
        <td>
          <span className="listing-title-scroll">{listingTitle(row)}</span>
        </td>
      );
    case "reason": {
      const reason = uncheckedReason(row);
      return <td data-findability-reason={reason}>{reason}</td>;
    }
    case "outcome":
      return <td>{bucketLabel(bucket)}</td>;
    case "category":
      return <td>{row.category?.trim() || "Not recorded"}</td>;
    case "kind":
      return <td>{productKindLabel(row.product_kind)}</td>;
    case "page":
      return (
        <td>
          <OfficialPageCell row={row} />
        </td>
      );
    case "sku":
      return <td>{row.latest_variant_sku?.trim() || "Not recorded"}</td>;
    case "confidence":
      return <td>{confidenceLabel(row.confidence)}</td>;
    case "source":
      return <td>{sourceMethodLabel(row.source_method)}</td>;
    case "http":
      return <td>{httpStatusLabel(row.http_status, bucket)}</td>;
    case "checked":
      return <td>{attemptLabel(row.latest_attempt_at, bucket)}</td>;
    case "explanation":
      return <td>{presentExplanation(row)}</td>;
    case "bundle":
      return <td>{dealerBundleLabel(row.dealer_bundle)}</td>;
    default:
      return <td />;
  }
}

export function FindabilityTable({
  rows,
  outcome,
}: {
  rows: readonly FindabilityRow[];
  outcome: FindabilityBucket;
}) {
  const columns = columnsFor(outcome);
  const population = useFullPopulationSort(
    rows,
    columns,
    findabilitySortValue,
    (row) => row.asin,
    CLIENT_TABLE_PAGE_SIZE,
  );
  const shownFrom = rows.length === 0 ? 0 : population.page * CLIENT_TABLE_PAGE_SIZE + 1;
  const shownTo = Math.min(rows.length, (population.page + 1) * CLIENT_TABLE_PAGE_SIZE);

  return (
    <div id="findability-listings">
      <ResizableTable
        tableId="findability-listings"
        columns={columns}
        freezeHeader
        maxHeight={520}
        fillColumnId="title"
        sort={population.sort}
        onSort={population.onSort}
      >
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No listings in this outcome.</td>
            </tr>
          ) : (
            population.pageRows.map((row) => {
              const bucket = findabilityOutcome(row);
              return (
                <tr key={row.asin} data-findability-asin={row.asin} data-findability-row={bucket}>
                  {columns.map((column) => (
                    <ListingCell key={column.id} columnId={column.id} row={row} bucket={bucket} />
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </ResizableTable>
      {rows.length > CLIENT_TABLE_PAGE_SIZE ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button
            type="button"
            className="segmented-btn"
            disabled={population.page <= 0}
            onClick={() => population.setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: 13 }}>
            {formatInt(shownFrom)}–{formatInt(shownTo)} of {formatInt(rows.length)}
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
      ) : null}
    </div>
  );
}
