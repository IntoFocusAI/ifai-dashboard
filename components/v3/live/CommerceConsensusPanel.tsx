"use client";

import { useState } from "react";
import {
  CommerceHeroCard,
  ConsensusComponentBars,
  COMPONENTS_ID,
} from "@/components/v3/live/ConsensusScoreView";
import { RetailOverviewLead } from "@/components/v3/live/RetailOverviewLead";
import { authorizedPartnersFromSave } from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import { commerceInputsFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import { commerceScore } from "@/lib/fender-canvas/consensus-scores";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

/**
 * Catalog Health → Retail Overview: AI Commerce hero in the same band as the
 * three share pies. Chevron opens full-width commerce component bars below.
 */
export function CommerceConsensusPanel({ read }: { read: RetailCanvasRead }) {
  const [open, setOpen] = useState(false);
  const [saved] = useAuthorizedSellers();
  const authorizedPartners = authorizedPartnersFromSave(saved);

  if (read.phase === "loading") {
    return <p className="retail-missing">Loading AI Commerce score…</p>;
  }
  if (read.phase === "error") {
    return <p className="retail-missing">The AI Commerce score could not be loaded.</p>;
  }

  const inputs = commerceInputsFromLive(read, authorizedPartners);
  if (!inputs) {
    return (
      <>
        <p className="retail-missing" data-consensus-commerce-unavailable="">
          AI Commerce is not available until the retail reading loads.
        </p>
        <RetailOverviewLead read={read} />
      </>
    );
  }

  const commerce = commerceScore(inputs, { authorizedPartners });

  return (
    <div data-consensus-commerce-block="">
      <RetailOverviewLead
        read={read}
        leading={
          <CommerceHeroCard
            commerce={commerce}
            open={open}
            onToggle={() => setOpen((value) => !value)}
          />
        }
      />
      {open ? <ConsensusComponentBars pillar={commerce} id={COMPONENTS_ID} /> : null}
    </div>
  );
}
