"use client";

import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { ScoreHeroCard } from "@/components/v3/live/ConsensusScoreView";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { briefingConsensusSentence } from "@/lib/fender-canvas/briefing-consensus-sentence";
import { consensusFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * Summary → Briefing lead: one Consensus sentence, then the same score card
 * Performance uses for AI Consensus. Pillar cards, Actuation, and the explainer stay off this tab.
 */
export function BriefingConsensusLead({
  bundle,
  retail,
}: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
}) {
  const findability = useFindability();
  const ai = useAiSearch();

  if (retail.phase === "loading" || findability.phase === "loading" || ai.phase === "loading") {
    return (
      <p className="retail-missing" data-briefing-consensus-loading="">
        Loading AI Consensus…
      </p>
    );
  }

  const consensus = consensusFromLive({
    findability,
    specPages: bundle.specPages,
    retail,
    ai,
  });

  return (
    <div className="briefing-consensus-lead" data-briefing-consensus="">
      <p className="briefing-consensus-sentence" data-briefing-consensus-sentence="">
        {briefingConsensusSentence(consensus)}
      </p>
      <ScoreHeroCard
        id="consensus"
        label="AI Consensus"
        score={consensus?.score ?? null}
        coverage={consensus?.coverage ?? null}
        dominant
      />
    </div>
  );
}
