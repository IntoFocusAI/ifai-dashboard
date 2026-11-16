/**
 * Summary → Performance score card titles and their custom tooltips (H-07, SC-01 to SC-04).
 * The AI Consensus text is the former "What is the AI Consensus score?" panel.
 */
import { CONSENSUS_EXPLAINER_BODY } from "@/lib/fender-canvas/consensus-score-display";
import type { ConsensusScore, PillarScore } from "@/lib/fender-canvas/consensus-scores";

export type ScoreCardId = "consensus" | PillarScore["id"];

export const SCORE_CARD_TITLES: Record<ScoreCardId, string> = {
  consensus: "AI Consensus Score",
  foundation: "AI Foundation Score",
  commerce: "AI Commerce Score",
  actuation: "AI Actuation Score",
};

export const SCORE_CARD_TIPS: Record<ScoreCardId, string> = {
  consensus: CONSENSUS_EXPLAINER_BODY,
  foundation:
    "AI Foundation measures whether AI search can find and trust the brand's product facts: exact official pages, machine-readable specs on the brand site, filled marketplace specs, and unbranded answers that name the brand. Fact checks count where a verified fact exists.",
  commerce:
    "AI Commerce measures how well the brand's Amazon listings are controlled: who holds the Buy Box, whether listings are suppressed or splintered, and whether any listing has a current MAP violation.",
  actuation:
    "AI Actuation is not included yet because no response to cited community sources or outreach to cited publications has an owner, evidence, and a dated record.",
};

/** One row of the AI Consensus weight breakdown. Weight and contribution are null when left out. */
export type ConsensusWeightRow = {
  id: PillarScore["id"];
  title: string;
  score: number | null;
  weight: number | null;
  contribution: number | null;
  included: boolean;
};

/**
 * SC-04: each pillar's score, its weight in AI Consensus, and the points it adds. The weights
 * are the ones consensusScore() assigned (pillar.weight), so the contributions add up to the
 * Consensus score. A pillar left out (AI Actuation today) has no weight and no contribution.
 */
export function consensusWeightRows(consensus: ConsensusScore): ConsensusWeightRow[] {
  return [consensus.foundation, consensus.commerce, consensus.actuation].map((pillar) => {
    const included = pillar.included && pillar.score != null && pillar.weight != null;
    return {
      id: pillar.id,
      title: SCORE_CARD_TITLES[pillar.id],
      score: included ? pillar.score : null,
      weight: included ? pillar.weight : null,
      contribution: included ? ((pillar.score as number) * (pillar.weight as number)) / 100 : null,
      included,
    };
  });
}
