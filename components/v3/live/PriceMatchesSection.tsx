"use client";

import { Fragment, useMemo } from "react";
import { FigureTip } from "@/components/v3/live/FigureTip";
import { PriceMatchCell, PriceMatchOfferLine } from "@/components/v3/live/PriceMatchOffers";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { ListingName, RETAIL_FIT_TABLE, wrapColumnIdsAfterFirst } from "@/components/v3/live/RetailOverviewFigure";
import { SetAsideFormRow, SetAsideHistory, useCheckSetAsides, type CheckSetAsides } from "@/components/v3/live/SetAsideTable";
import { usePriceMatches } from "@/components/v3/live/usePriceMatches";
import { activeClient } from "@/lib/client/active-client";
import type { WithheldCauseRow } from "@/lib/fender-canvas/buy-box-cause";
import { formatInt, formatUsd } from "@/lib/fender-canvas/format";
import {
  PRICE_MATCH_TIP,
  UNSURE_TIP,
  matchSummary,
  priceMatchCounts,
  priceMatchNextStep,
  priceMatchScope,
  priceMatchesByListing,
  withoutIgnored,
  type ListingPriceMatches,
} from "@/lib/fender-canvas/price-match";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";

/* R-15: price matches for withheld listings with a benchmark (Catalog Health -> Suppressed
   listings). Ignore uses the existing set-aside functions on the price_match check: an ignored
   listing leaves this list and its counts, and is restored from the history below. */

const COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 230, minWidth: 200 },
  { id: "benchmark", name: "Amazon's reference price", label: "Amazon's reference price", width: 120, minWidth: 104, className: "money" },
  { id: "match", name: "Price match", label: "Price match", width: 260, minWidth: 200 },
  { id: "next", name: "Next step", label: "Next step", width: 240, minWidth: 180 },
  { id: "ignore", name: "Ignore", label: "", width: 96, minWidth: 84 },
];

const UNSURE_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 230, minWidth: 200 },
  { id: "benchmark", name: "Amazon's reference price", label: "Amazon's reference price", width: 120, minWidth: 104, className: "money" },
  { id: "offers", name: "Unsure matches", label: "Unsure matches", width: 420, minWidth: 260 },
];

function IgnoreCell({ ctl, asin }: { ctl: CheckSetAsides; asin: string }) {
  if (!ctl.enabled || !/^[A-Z0-9]{10}$/.test(asin)) return <td />;
  return (
    <td>
      <button
        type="button"
        className="cc-undo-btn"
        aria-expanded={ctl.formFor?.key === asin}
        data-price-match-ignore={asin}
        onClick={() => ctl.toggleForm(asin, "set_aside")}
      >
        Ignore
      </button>
    </td>
  );
}

function ListingCell({ listing }: { listing: ListingPriceMatches }) {
  return (
    <td>
      <ListingName name={listing.label} />
      <span className="asin-line">
        <span className="asin-chip">{listing.asin}</span>
      </span>
    </td>
  );
}

function PriceMatchHeader({ matched, total }: { matched: number; total: number }) {
  return (
    <div className="content-box-title" data-price-matches-header="">
      <FigureTip title="Price match" desc={PRICE_MATCH_TIP} testId="price-match-tip">
        Price matches
      </FigureTip>
      <span className="metric-card-sub" data-price-matches-count={`${matched}/${total}`}>
        {" "}
        Price match found for {formatInt(matched)} of {formatInt(total)} listings with a reference price.
      </span>
    </div>
  );
}

function UnsureTable({ listings }: { listings: ListingPriceMatches[] }) {
  if (!listings.length) return null;
  return (
    <div data-price-matches-unsure="" style={{ marginTop: 12 }}>
      <div className="content-box-title">
        <FigureTip title="Unsure same-product checks" desc={UNSURE_TIP} testId="price-match-unsure-tip">
          Unsure same-product checks
        </FigureTip>
      </div>
      <ResizableTable
        tableId="price-matches-unsure"
        columns={UNSURE_COLUMNS}
        wrapColumnIds={wrapColumnIdsAfterFirst(UNSURE_COLUMNS)}
        tableClassName={RETAIL_FIT_TABLE}
      >
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.asin} data-price-match-unsure-row={listing.asin}>
              <ListingCell listing={listing} />
              <td className="money">{formatUsd(listing.benchmarkCents / 100)}</td>
              <td>
                {listing.unsure.map((offer) => (
                  <PriceMatchOfferLine key={`${offer.domain}-${offer.url}`} offer={offer} showReason />
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </ResizableTable>
    </div>
  );
}

export function PriceMatchesSection({ rows }: { rows: readonly WithheldCauseRow[] }) {
  const read = usePriceMatches();
  const ignore = useCheckSetAsides(SET_ASIDE_CHECKS.priceMatch, "Price matches");
  const client = activeClient();
  const listings = useMemo(() => {
    if (typeof read !== "object") return null;
    return withoutIgnored(priceMatchesByListing(priceMatchScope(rows), read.checks, read.matches), ignore.active);
  }, [read, rows, ignore.active]);

  if (read === "loading") return <p className="retail-missing">Loading price matches…</p>;
  if (read === "unavailable" || !listings) {
    return <p className="retail-missing">The price matches could not be loaded.</p>;
  }
  const counts = priceMatchCounts(listings);
  const unsure = listings.filter((l) => l.unsure.length > 0);

  return (
    <div className="content-box" data-price-matches="" style={{ marginTop: 12 }}>
      <PriceMatchHeader matched={counts.matched} total={counts.total} />
      {listings.length ? (
        <ResizableTable
          tableId="price-matches"
          columns={COLUMNS}
          wrapColumnIds={wrapColumnIdsAfterFirst(COLUMNS)}
          tableClassName={RETAIL_FIT_TABLE}
        >
          <tbody>
            {listings.map((listing) => (
              <Fragment key={listing.asin}>
                <tr data-price-match-row={listing.asin}>
                  <ListingCell listing={listing} />
                  <td className="money">{formatUsd(listing.benchmarkCents / 100)}</td>
                  <PriceMatchCell
                    listing={listing}
                    summary={matchSummary(listing, client.brandSiteDomains, client.brandSiteLabel)}
                  />
                  <td data-price-match-next-step="">{priceMatchNextStep(client.sellerModel, listing)}</td>
                  <IgnoreCell ctl={ignore} asin={listing.asin} />
                </tr>
                <SetAsideFormRow ctl={ignore} entityKey={listing.asin} entityLabel={listing.label} colSpan={COLUMNS.length} />
              </Fragment>
            ))}
          </tbody>
        </ResizableTable>
      ) : (
        <p className="fo-note">No withheld listing with a reference price is in the list.</p>
      )}
      <UnsureTable listings={unsure} />
      <SetAsideHistory ctl={ignore} />
    </div>
  );
}
