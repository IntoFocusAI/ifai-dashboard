"use client";

import { AuthorizedSellersControl } from "@/components/v3/live/AuthorizedSellersControl";
import { CommerceConsensusPanel } from "@/components/v3/live/CommerceConsensusPanel";
import { ExploreListings } from "@/components/v3/live/ExploreListings";
import { DefinedTerm } from "@/components/v3/live/DefinedTerm";
import { FeaturedOfferReadings } from "@/components/v3/live/FeaturedOfferReadings";
import { authorizedSellerControlOffered } from "@/lib/fender-canvas/authorized-sellers";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";

const RETAIL_SELLER_TYPE = "Partner-led";

export function RetailOverview({
  read,
  freshness = null,
}: {
  read: RetailCanvasRead;
  freshness?: CanvasFreshnessRow[] | null;
}) {
  const counts =
    read.phase === "ready" ? read.snapshot.suppressedListings.detail?.counts ?? null : null;

  return (
    <div className="retail-health retail-surface">
      <p
        className="metric-card-sub"
        data-seller-type={RETAIL_SELLER_TYPE}
        style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: "0.02em" }}
      >
        Seller type: {RETAIL_SELLER_TYPE}
      </p>
      {authorizedSellerControlOffered(RETAIL_SELLER_TYPE) ? (
        <AuthorizedSellersControl read={read} />
      ) : null}

      <CommerceConsensusPanel read={read} />

      <div className="ceo-callout" style={{ marginTop: 12 }}>
        <div className="ceo-callout-header">
          <span>How do these retail findings change AI search?</span>
        </div>
        <div className="ceo-callout-body">
          A withheld{" "}
          <span
            className="ifai-term"
            data-ifai-tooltip-title="Buy Box"
            data-ifai-tooltip-desc="Amazon also calls it the Featured Offer. The one-click Add to Cart button. Only one seller wins it. When nobody wins it, shoppers see other sellers listed and far fewer of them buy."
            tabIndex={0}
            aria-label="Buy Box: Amazon also calls it the Featured Offer. The one-click Add to Cart button. Only one seller wins it. When nobody wins it, shoppers see other sellers listed and far fewer of them buy."
          >
            Buy Box
          </span>{" "}
          removes the one-click path shoppers and AI assistants use when they name a product someone
          can buy. A price below <DefinedTerm term="MAP" /> publishes a lower number than the brand
          agreed to advertise. A bundle that is not nested under a parent{" "}
          <DefinedTerm term="ASIN" /> keeps its reviews off the listing those assistants treat as
          the product.
        </div>
      </div>

      {counts ? <FeaturedOfferReadings counts={counts} freshness={freshness} /> : null}

      <ExploreListings />
    </div>
  );
}
