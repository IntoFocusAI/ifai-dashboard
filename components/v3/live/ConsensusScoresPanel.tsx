"use client";

import { ConsensusLeadBand } from "@/components/v3/live/ConsensusScoreView";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { ScoreHistoryChart } from "@/components/v3/live/ScoreHistoryChart";
import { useSummaryAiRead } from "@/components/v3/live/useSummaryAiRead";
import { authorizedPartnersFromSave } from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import { consensusFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * Summary → Performance: the score cards, then the saved weekly scores over time (decision 94).
 */
export function ConsensusScoresPanel({
  bundle,
  retail,
}: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
}) {
  const findability = useFindability();
  // The date-pill window, the same read as the Briefing's AI Consensus.
  const ai = useSummaryAiRead();
  const [saved] = useAuthorizedSellers();
  const authorizedPartners = authorizedPartnersFromSave(saved);

  if (retail.phase === "loading" || findability.phase === "loading" || ai.phase === "loading") {
    return <p className="retail-missing">Loading AI Consensus scores…</p>;
  }

  const consensus = consensusFromLive({
    findability,
    specPages: bundle.specPages,
    retail,
    ai,
    authorizedPartners,
  });

  if (!consensus) {
    return (
      <p className="retail-missing" data-consensus-unavailable="">
        AI Consensus scores are not available until the retail reading loads.
      </p>
    );
  }

  return (
    <>
      <ConsensusLeadBand consensus={consensus} />
      <ScoreHistoryChart />
    </>
  );
}
