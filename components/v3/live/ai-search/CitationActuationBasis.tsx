"use client";

import { useEffect, useState } from "react";
import { ActuationFactorBars } from "@/components/v3/live/ActuationFactorBars";
import { ScoreHeroCard } from "@/components/v3/live/ConsensusScoreView";
import { SCORE_CARD_TIPS, SCORE_CARD_TITLES } from "@/components/v3/live/score-card-tips";
import { useSummaryAiRead } from "@/components/v3/live/useSummaryAiRead";
import { activeClient } from "@/lib/client/active-client";
import { loadActuationBasis } from "@/lib/fender-canvas/actuation-basis-read";
import { actuationPartial } from "@/lib/fender-canvas/actuation-display";
import type { ClientBasis } from "@/lib/fender-canvas/actuation-records";
import { actuationScore } from "@/lib/fender-canvas/consensus-scores";
import { actuationFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";

type BasisRead = { phase: "loading" } | { phase: "done"; basis: ClientBasis | null };

/** The client's Actuation basis: the same cached read the dashboard bundle makes. */
function useActuationBasis(): BasisRead {
  const client = activeClient().key;
  const [read, setRead] = useState<{ client: string; read: BasisRead }>({ client, read: { phase: "loading" } });
  useEffect(() => {
    let live = true;
    void loadActuationBasis(client)
      .catch(() => null)
      .then((basis) => {
        if (live) setRead({ client, read: { phase: "done", basis } });
      });
    return () => {
      live = false;
    };
  }, [client]);
  return read.client === client ? read.read : { phase: "loading" };
}

/**
 * Citation Ecosystem (SC-03): the AI Actuation score and its basis, as on Summary → Performance. It
 * sits below the tab's figures and tables, so the owned-pages-in-unbranded figure stays where it is
 * (decision 86). E1 reads the date pill's window from every engine that cites sources, not the
 * engine chips or question control above, so it matches Summary.
 */
export function CitationActuationBasis() {
  const ai = useSummaryAiRead();
  const basis = useActuationBasis();
  if (basis.phase === "loading" || ai.phase === "loading") return null;
  const score = actuationFromLive({ ai, actuation: basis.basis });
  const pillar = actuationScore(score);
  return (
    <section data-citation-actuation="" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 0 }}>
      <ScoreHeroCard
        id="actuation"
        label={SCORE_CARD_TITLES.actuation}
        titleTip={SCORE_CARD_TIPS.actuation}
        score={pillar.score}
        coverage={pillar.coverage}
        coverageNoun="factors"
        partial={actuationPartial(pillar)}
        dataAttr="data-citation-actuation-card"
      />
      {score ? <ActuationFactorBars score={score} /> : null}
    </section>
  );
}
