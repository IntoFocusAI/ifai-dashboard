import { CONSENSUS_SCORE_TARGET } from "@/lib/fender-canvas/consensus-score-display";
import type { ConsensusScore } from "@/lib/fender-canvas/consensus-scores";

/** The Summary → Performance score cards that open a breakdown with their chevron. */
export type ScoreCardId = "consensus" | "foundation" | "commerce";

/**
 * Decision 94: the weakest score card opens its breakdown by default. Weakest is the lowest score
 * against its target (every card's target is 70 today). A score that reads Not included or has no
 * figure does not count. A tie keeps the card order on screen. Null when no card has a score.
 */
export function weakestScoreCard(
  consensus: ConsensusScore,
  target: number = CONSENSUS_SCORE_TARGET,
): ScoreCardId | null {
  const cards: Array<{ id: ScoreCardId; score: number | null; included: boolean }> = [
    { id: "consensus", score: consensus.score, included: true },
    { id: "foundation", score: consensus.foundation.score, included: consensus.foundation.included },
    { id: "commerce", score: consensus.commerce.score, included: consensus.commerce.included },
  ];
  let weakest: { id: ScoreCardId; gap: number } | null = null;
  for (const card of cards) {
    if (!card.included || card.score == null || !Number.isFinite(card.score)) continue;
    const gap = card.score - target;
    if (!weakest || gap < weakest.gap) weakest = { id: card.id, gap };
  }
  return weakest?.id ?? null;
}
