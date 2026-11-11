"use client";

import { useMemo } from "react";
import { clientColumn, ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useLandOnFindabilityRow } from "@/components/v3/live/findability/useFindabilityRowLanding";
import { useFullPopulationSort } from "@/components/v3/live/useFullPopulationSort";
import "@/components/v3/live/findability/findability-landing.css";
import {
  attemptLabel,
  confidenceLabel,
  DEALER_BUNDLE_NOT_LOADED,
  DEALER_BUNDLE_NOTE,
  dealerBundleLabel,
  listingTitle,
  presentExplanation,
  productKindLabel,
  uncheckedReason,
} from "@/lib/findability/copy";
import {
  FINDABILITY_WRAP_COLUMNS,
  findabilityTableValue,
  httpStatusLine,
  listingContextLine,
  matchMethodLine,
  variantSkuLine,
} from "@/lib/findability/table-columns";
import { CLIENT_TABLE_PAGE_SIZE } from "@/lib/fender-canvas/full-result-sort";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  findabilityOutcome,
  presentOfficialAddress,
  type FindabilityBucket,
  type FindabilityRow,
} from "@/lib/findability/outcomes";

const VARIANT_SKU_TOOLTIP = {
  title: "Official page",
  description:
    "The official page this listing matched, with the brand's variant SKU stored for that match. The variant SKU is not the Amazon ASIN.",
} as const;

const CONFIDENCE_TOOLTIP = {
  title: "Confidence",
  description: "The identifier that matched the listing to the page, then how the page was found.",
} as const;

const CHECKED_TOOLTIP = {
  title: "Checked",
  description: "When this listing's official-page check last ran, in UTC, with the page's HTTP status when one is stored.",
} as const;

function bundleColumn(bundleLoaded: boolean): RetailColumn {
  return {
    ...clientColumn("bundle", "Dealer bundle", "text", 96, 84),
    headerTooltip: {
      title: "Dealer bundle",
      description: bundleLoaded ? DEALER_BUNDLE_NOTE : DEALER_BUNDLE_NOT_LOADED,
    },
  };
}

/** Outcome tables: seven columns that fit the panel at 1280 px. See lib/findability/table-columns. */
function outcomeColumns(bundleLoaded: boolean): readonly RetailColumn[] {
  return [
    clientColumn("asin", "ASIN", "text", 118, 104, "asin-col"),
    clientColumn("title", "Listing", "text", 220, 150),
    { ...clientColumn("page", "Official page", "text", 170, 140), headerTooltip: VARIANT_SKU_TOOLTIP },
    { ...clientColumn("confidence", "Confidence", "text", 116, 100), headerTooltip: CONFIDENCE_TOOLTIP },
    { ...clientColumn("checked", "Checked", "date", 112, 100), headerTooltip: CHECKED_TOOLTIP },
    clientColumn("explanation", "Explanation", "text", 190, 150),
    bundleColumn(bundleLoaded),
  ];
}

/** Unchecked (D-09): Reason leads after ASIN and Listing; not-checked columns stay off. */
function uncheckedColumns(bundleLoaded: boolean): readonly RetailColumn[] {
  return [
    clientColumn("asin", "ASIN", "text", 118, 104, "asin-col"),
    clientColumn("title", "Listing", "text", 200, 150),
    clientColumn("reason", "Reason", "text", 150, 120),
    clientColumn("category", "Category", "text", 112, 96),
    clientColumn("kind", "Product kind", "text", 104, 96),
    clientColumn("explanation", "Explanation", "text", 170, 140),
    bundleColumn(bundleLoaded),
  ];
}

function columnsFor(outcome: FindabilityBucket, bundleLoaded: boolean): readonly RetailColumn[] {
  return outcome === "not_checked" ? uncheckedColumns(bundleLoaded) : outcomeColumns(bundleLoaded);
}

/** A cell's second line in muted text. Nothing when the line is empty. */
function SubLine({ text }: { text: string }) {
  if (!text) return null;
  return <span className="findability-cell-sub">{text}</span>;
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function OfficialPageCell({ row }: { row: FindabilityRow }) {
  const address = presentOfficialAddress(row);
  if (address.kind === "link") {
    return (
      <a
        className="findability-official-link"
        href={address.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        referrerPolicy="no-referrer"
        data-findability-official-url={address.href}
      >
        {address.href.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
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
    case "asin": {
      const href = amazonHref(row.asin);
      return (
        <td className="asin-col">
          {href ? (
            <a className="listing-link" href={href} target="_blank" rel="noopener noreferrer">
              <span className="asin-chip">{row.asin}</span>
            </a>
          ) : (
            <span className="asin-chip">{row.asin}</span>
          )}
        </td>
      );
    }
    case "title":
      return (
        <td>
          <span className="findability-listing-title">{listingTitle(row)}</span>
          {bucket === "not_checked" ? null : <SubLine text={listingContextLine(row)} />}
        </td>
      );
    case "reason": {
      const reason = uncheckedReason(row);
      return <td data-findability-reason={reason}>{reason}</td>;
    }
    case "category":
      return <td>{row.category?.trim() || "Not recorded"}</td>;
    case "kind":
      return <td>{productKindLabel(row.product_kind)}</td>;
    case "page":
      return (
        <td>
          <OfficialPageCell row={row} />
          <SubLine text={variantSkuLine(row)} />
        </td>
      );
    case "confidence":
      return (
        <td>
          {confidenceLabel(row.confidence)}
          <SubLine text={matchMethodLine(row)} />
        </td>
      );
    case "checked":
      return (
        <td>
          {attemptLabel(row.latest_attempt_at, bucket)}
          <SubLine text={httpStatusLine(row, bucket)} />
        </td>
      );
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
  bundleLoaded,
  landAsin = null,
}: {
  rows: readonly FindabilityRow[];
  outcome: FindabilityBucket;
  /** False when the retail read behind Dealer bundle did not load; the header tooltip says so. */
  bundleLoaded: boolean;
  /** A listing linked from Brand-Site Specs. Its page opens and its row is highlighted. */
  landAsin?: string | null;
}) {
  const columns = useMemo(() => columnsFor(outcome, bundleLoaded), [outcome, bundleLoaded]);
  const population = useFullPopulationSort(
    rows,
    columns,
    findabilityTableValue,
    (row) => row.asin,
    CLIENT_TABLE_PAGE_SIZE,
  );
  const landed = useLandOnFindabilityRow(landAsin, rows, CLIENT_TABLE_PAGE_SIZE, population.setPage);
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
        wrapColumnIds={FINDABILITY_WRAP_COLUMNS}
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
                <tr
                  key={row.asin}
                  data-findability-asin={row.asin}
                  data-findability-row={bucket}
                  data-findability-landed={landed === row.asin ? "" : undefined}
                >
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
