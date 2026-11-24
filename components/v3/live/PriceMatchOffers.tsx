"use client";

import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { formatUsd } from "@/lib/fender-canvas/format";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import {
  PRICE_MATCH_LINK_LABEL,
  noMatchText,
  type ListingPriceMatches,
  type PriceMatchOffer,
} from "@/lib/fender-canvas/price-match";

const KIND_LABEL = { landed: "landed price", item: "item price" } as const;
const KIND_TIP = {
  landed: "Item price plus shipping equals Amazon's reference price. Amazon compares landed prices.",
  item: "The item price equals Amazon's reference price. The store did not show shipping, or shipping is extra.",
} as const;

/** One store at the benchmark: store, price, which price matched, and the page, labeled "price match". */
export function PriceMatchOfferLine({ offer, showReason = false }: { offer: PriceMatchOffer; showReason?: boolean }) {
  const checked = formatCheckedAt(offer.observedAt);
  return (
    <div className="price-match-offer" data-price-match-offer={offer.domain ?? offer.store} data-verdict={offer.verdict}>
      <strong>{offer.store}</strong> {formatUsd(offer.itemCents / 100)}{" "}
      <span {...figureTipAttrs(KIND_LABEL[offer.kind], KIND_TIP[offer.kind])} className="ifai-term fo-note">
        {KIND_LABEL[offer.kind]}
      </span>
      {offer.url ? (
        <>
          {" · "}
          <a
            className="listing-link"
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            data-price-match-link=""
          >
            {PRICE_MATCH_LINK_LABEL}
          </a>
        </>
      ) : null}
      {checked ? <span className="fo-note"> · checked {checked}</span> : null}
      {showReason && offer.reason ? <div className="fo-note">{offer.reason}</div> : null}
    </div>
  );
}

/** The Price match cell: the summary line, then each store at the benchmark. */
export function PriceMatchCell({
  listing,
  summary,
}: {
  listing: ListingPriceMatches;
  summary: string | null;
}) {
  const searched = formatCheckedAt(listing.searchedAt);
  return (
    <td data-price-match-state={listing.state} data-price-match-stale={listing.stale ? "" : undefined}>
      {summary ? (
        <details className="price-match-details">
          <summary data-price-match-summary="">{summary}</summary>
          {listing.same.map((offer) => (
            <PriceMatchOfferLine key={`${offer.domain}-${offer.url}`} offer={offer} />
          ))}
        </details>
      ) : (
        <span className="fo-note">{noMatchText(listing)}</span>
      )}
      {listing.stale && listing.searchedBenchmarkCents != null ? (
        <div className="fo-note" data-price-match-stale-note="">
          Searched at the earlier reference price, {formatUsd(listing.searchedBenchmarkCents / 100)}
        </div>
      ) : null}
      {searched && listing.state !== "matched" ? <div className="fo-note">Searched {searched}</div> : null}
    </td>
  );
}
