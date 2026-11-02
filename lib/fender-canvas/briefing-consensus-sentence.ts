/**
 * One result sentence for Summary → Briefing.
 * The number is the live AI Consensus score, rounded the same way as the score card.
 * This is not the Performance explainer and not a second score.
 */

import { formatPct, formatRatio } from "@/lib/fender-canvas/format";

export const BRIEFING_CONSENSUS_UNAVAILABLE = "AI Consensus is not available.";

export function briefingConsensusSentence(
  consensus: {
    score: number | null;
    coverage: { numerator: number; denominator: number } | null;
  } | null,
): string {
  if (
    consensus == null ||
    consensus.score == null ||
    !Number.isFinite(consensus.score) ||
    consensus.coverage == null
  ) {
    return BRIEFING_CONSENSUS_UNAVAILABLE;
  }

  const shown = formatPct(consensus.score, 0).replace(/%$/, "");
  const coverage = formatRatio(consensus.coverage.numerator, consensus.coverage.denominator);
  return `AI Consensus is ${shown}, from ${coverage} pillars.`;
}
