"use client";

import type { ReactNode } from "react";
import "@/components/v3/live/catalog-health.css";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import type { RetailColumn } from "@/components/v3/live/ResizableTable";
import { StatusGlyph } from "@/components/v3/live/StatusMark";
import { formatUsd } from "@/lib/fender-canvas/format";
import {
  aboveBenchmarkDollars,
  benchmarkDollars,
  competitiveExternalPriceState,
  listingLabel,
  observedOfferDollars,
  type FeaturedOfferRow as Row,
} from "@/lib/fender-canvas/featured-offer";
import {
  NO_COMPARABLE_PAIR_LABEL,
  NO_COMPARABLE_PAIR_TIP,
  formatCheckedAt,
} from "@/lib/fender-canvas/featured-offer-copy";

/**
 * Suppressed Listings only shows withheld offers, so a Buy Box column would never vary.
 * A Source column would be constant too: withheld state only comes from an Amazon listing read.
 */
export const SUPPRESSED_LISTINGS_TABLE_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 230, minWidth: 140, sort: "text" },
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
  { id: "checked", name: "Checked", label: "Checked", width: 170, minWidth: 120, sort: "date" },
];

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
  trailing,
}: {
  row: Row;
  /** Extra last cell, e.g. a set-aside control. */
  trailing?: ReactNode;
}) {
  const asin = typeof row.asin === "string" ? row.asin : null;
  const href = amazonHref(asin);
  const offer = observedOfferDollars(row);
  const benchmark = benchmarkDollars(row);
  const gap = aboveBenchmarkDollars(row);
  const checkedAt = formatCheckedAt(row.featured_offer_checked_at);

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
      <td className="money">
        {offer != null ? formatUsd(offer) : <span className="fo-note">Not observed</span>}
      </td>
      <td className="money">
        {benchmark != null ? formatUsd(benchmark) : <span className="fo-note">{benchmarkNote(row)}</span>}
      </td>
      <td className="money">
        {gap != null ? (
          <span className="fo-gap data-status data-status-bad" data-status="bad">
            <StatusGlyph status="bad" />
            <span className="data-status-word">{formatUsd(gap, { signed: true })} above</span>
          </span>
        ) : (
          <span
            {...figureTipAttrs(NO_COMPARABLE_PAIR_LABEL, NO_COMPARABLE_PAIR_TIP, "no-comparable-pair")}
            className="ifai-term fo-note"
          >
            {NO_COMPARABLE_PAIR_LABEL}
          </span>
        )}
      </td>
      <td>{checkedAt ?? <span className="fo-note">Never</span>}</td>
      {trailing}
    </tr>
  );
}
