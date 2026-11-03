"use client";

import type { ReactNode } from "react";
import type { RetailColumn } from "@/components/v3/live/ResizableTable";
import { formatUsd } from "@/lib/fender-canvas/format";
import {
  aboveBenchmarkDollars,
  benchmarkDollars,
  competitiveExternalPriceState,
  FEATURED_OFFER_STATE_LABELS,
  featuredOfferState,
  hasFailedAttempt,
  lastError,
  listingLabel,
  observedOfferDollars,
  readFromKeepa,
  type FeaturedOfferRow as Row,
} from "@/lib/fender-canvas/featured-offer";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";

export const FEATURED_OFFER_TABLE_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 230, minWidth: 140, sort: "text" },
  { id: "state", name: "Buy Box", label: "Buy Box", width: 150, minWidth: 110, sort: "text" },
  {
    id: "offer",
    name: "Observed offer",
    label: "Observed offer",
    width: 130,
    minWidth: 100,
    className: "money",
    sort: "number",
  },
  {
    id: "benchmark",
    name: "Competitive External Price",
    label: "Competitive External Price",
    width: 190,
    minWidth: 140,
    className: "money",
    sort: "number",
  },
  {
    id: "gap",
    name: "Above benchmark",
    label: "Above benchmark",
    width: 140,
    minWidth: 110,
    className: "money",
    sort: "number",
  },
  { id: "source", name: "Source", label: "Source", width: 120, minWidth: 90, sort: "text" },
  { id: "checked", name: "Checked", label: "Checked", width: 170, minWidth: 120, sort: "date" },
];

export const FEATURED_OFFER_TABLE_COLUMN_COUNT = FEATURED_OFFER_TABLE_COLUMNS.length;

/**
 * Suppressed Listings only shows withheld offers, so Buy Box never varies.
 * Source is also constant: withheld state only comes from an Amazon listing read.
 */
export const SUPPRESSED_LISTINGS_TABLE_COLUMNS: RetailColumn[] =
  FEATURED_OFFER_TABLE_COLUMNS.filter(
    (column) => column.id !== "state" && column.id !== "source",
  );

export const SUPPRESSED_LISTINGS_TABLE_COLUMN_COUNT = SUPPRESSED_LISTINGS_TABLE_COLUMNS.length;

function amazonHref(asin: string | null | undefined): string | null {
  if (typeof asin !== "string") return null;
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

/** Why there is no comparable number, said plainly. Never a zero and never a dash alone. */
function benchmarkNote(row: Row): string {
  const state = competitiveExternalPriceState(row);
  if (state === "unavailable") return "Not published by Amazon";
  if (state === "check_failed") return "Check failed";
  return "Not checked";
}

export function FeaturedOfferTableRow({
  row,
  showBuyBox = true,
  showSource = true,
  trailing,
}: {
  row: Row;
  /** False on Suppressed Listings, where every row is Buy Box withheld. */
  showBuyBox?: boolean;
  /** False when every row of that table uses the same Source label. */
  showSource?: boolean;
  /** Extra last cell, e.g. a set-aside control. */
  trailing?: ReactNode;
}) {
  const state = featuredOfferState(row);
  const asin = typeof row.asin === "string" ? row.asin : null;
  const href = amazonHref(asin);
  const offer = observedOfferDollars(row);
  const benchmark = benchmarkDollars(row);
  const gap = aboveBenchmarkDollars(row);
  const failed = hasFailedAttempt(row);
  const checkedAt = formatCheckedAt(row.featured_offer_checked_at);
  const attemptedAt = formatCheckedAt(row.featured_offer_attempted_at);

  return (
    <tr>
      <td>
        <strong>{listingLabel(row)}</strong>
        <br />
        <span className="asin-line">
          {href && asin ? (
            <a
              className="listing-link channel-tag channel-amz"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="asin-chip">{asin}</span>
            </a>
          ) : (
            <span className="asin-chip">{asin ?? ""}</span>
          )}
        </span>
      </td>
      {showBuyBox ? (
        <td>
          {FEATURED_OFFER_STATE_LABELS[state]}
          {failed ? (
            <>
              <br />
              <span className="fo-failed-note">
                Last check failed{attemptedAt ? ` ${attemptedAt}` : ""}
                {lastError(row) ? `: ${lastError(row)}` : ""}
              </span>
            </>
          ) : null}
        </td>
      ) : null}
      <td className="money">
        {offer != null ? formatUsd(offer) : <span className="fo-note">Not observed</span>}
      </td>
      <td className="money">
        {benchmark != null ? formatUsd(benchmark) : <span className="fo-note">{benchmarkNote(row)}</span>}
      </td>
      <td className="money" style={gap != null ? { color: "var(--danger-red)", fontWeight: 700 } : undefined}>
        {gap != null ? (
          formatUsd(gap, { signed: true })
        ) : (
          <span className="fo-note">No comparable pair</span>
        )}
      </td>
      {showSource ? (
        <td>{readFromKeepa(row) ? "Amazon listing read" : "Catalog"}</td>
      ) : null}
      <td>{checkedAt ?? <span className="fo-note">Never</span>}</td>
      {trailing}
    </tr>
  );
}
