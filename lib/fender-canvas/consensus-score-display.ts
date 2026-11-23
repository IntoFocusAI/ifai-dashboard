/**
 * Display helpers for AI Consensus heroes. Score math stays in consensus-scores.ts.
 * Higher scores are better. Bands use the same traffic-light tokens as other share leads.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import type { ConsensusScore, PillarScore } from "@/lib/fender-canvas/consensus-scores";

/**
 * Score color bands (0-100, higher is better).
 * Below 40 is danger red. Above 70 is success green. The closed interval is warning amber.
 */
export const CONSENSUS_SCORE_BANDS = { redBelow: 40, greenAbove: 70 } as const;

/**
 * H-07, decision 8: AI Consensus, AI Foundation, and AI Commerce are each read against a
 * target of 70, shown as "41 /100" with "Target 70" below (Brian, 18 Nov 2026).
 */
export const CONSENSUS_SCORE_TARGET = 70;

/** Why AI Actuation sits out of AI Consensus: only when its records did not load (decision 97). */
export const ACTUATION_OMITTED_REASON = "The AI Actuation records did not load.";

export const CONSENSUS_EXPLAINER_TITLE = "What is the AI Consensus score?";

export const CONSENSUS_EXPLAINER_BODY =
  "AI Consensus is IntoFocus's 0 to 100 read of how the brand is doing from AI search and ecommerce together. It weights AI Foundation 40%, AI Commerce 40%, and AI Actuation 20%. Coverage shows how many of those three inputs are in the number.";

export type ScoreTone = "danger" | "warning" | "success";

export function scoreTone(score: number | null | undefined): ScoreTone | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score < CONSENSUS_SCORE_BANDS.redBelow) return "danger";
  if (score > CONSENSUS_SCORE_BANDS.greenAbove) return "success";
  return "warning";
}

export function scoreToneColor(score: number | null | undefined): string {
  const tone = scoreTone(score);
  if (tone === "danger") return "var(--danger-red)";
  if (tone === "success") return "var(--success-green)";
  if (tone === "warning") return "var(--warning-amber)";
  return "var(--text-muted)";
}

/**
 * Disc of the score versus the rest of 100. Same CitationPieDisc family as other tabs.
 * Empty when the score is missing.
 */
export function scoreAgainst100Pie(
  id: string,
  title: string,
  score: number | null | undefined,
): PieDiscData | null {
  if (score == null || !Number.isFinite(score)) return null;
  const filled = Math.max(0, Math.min(100, Math.round(score)));
  const rest = 100 - filled;
  const slices = [
    { key: "matched", label: "Score", count: filled },
    { key: "none", label: "Rest to 100", count: rest },
  ].filter((slice) => slice.count > 0);
  if (slices.length === 0) return null;
  return {
    id,
    title,
    total: 100,
    totalLabel: "points",
    slices,
  };
}

/** The score as whole points out of 100 ("41"), or Not available when there is none. */
export function scoreFigure(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "Not available";
  return String(Math.round(score));
}

/** The small mark right after a score figure, so the score reads out of 100. */
export const SCORE_OUT_OF = "/100";

/** "Target 70" under a score figure (H-07). */
export function scoreTargetLabel(target: number = CONSENSUS_SCORE_TARGET): string {
  return `Target ${target}`;
}

/** "41/100, target 70", for tooltips and accessible names. Null when there is no score. */
export function scoreAgainstTarget(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  return `${scoreFigure(score)}${SCORE_OUT_OF}, target ${CONSENSUS_SCORE_TARGET}`;
}

/** The brand status for a score band: Poor below 40, Fair 40 to 70, Good above 70. */
export function scoreStatus(score: number | null | undefined): DataStatus | null {
  const tone = scoreTone(score);
  if (tone === "danger") return "bad";
  if (tone === "warning") return "okay";
  if (tone === "success") return "good";
  return null;
}

function namesSentence(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const PILLAR_SOURCES: Record<"foundation" | "commerce", string> = {
  foundation: "the Findability, brand-site page, Amazon spec, and AI Search reads",
  commerce: "the retail read (Buy Box, suppression, bundles, and MAP)",
};

/**
 * X-25: a pillar score that leaves out some of its components covers part of its population,
 * so it carries the asterisk. The tooltip names the components left out and how the weights
 * rescale. Null when every component is in, or when there is no score.
 */
export function pillarPartial(pillar: PillarScore): PartialFigure | null {
  if (pillar.id === "actuation" || pillar.score == null || !pillar.coverage) return null;
  if (pillar.coverage.numerator >= pillar.coverage.denominator) return null;
  const dropped = pillar.components.filter((component) => !component.included).map((c) => c.name);
  if (dropped.length === 0) return null;
  return {
    reason: "coverage",
    missing: `${namesSentence(dropped)} ${dropped.length === 1 ? "is" : "are"} left out of ${pillar.name}: the input is not stored or did not load`,
    coverage: `${pillar.coverage.numerator} of ${pillar.coverage.denominator} components`,
    source: PILLAR_SOURCES[pillar.id],
    effect: "The remaining weights rescale. A missing input is never counted as zero",
  };
}

/**
 * X-25: AI Consensus covers part of its population while a pillar is left out (a pillar whose
 * inputs did not load). Null when all three pillars are in, or when there is no score.
 */
export function consensusPartial(consensus: ConsensusScore): PartialFigure | null {
  if (consensus.score == null) return null;
  const { numerator, denominator } = consensus.coverage;
  if (numerator >= denominator) return null;
  const pillars = [consensus.foundation, consensus.commerce, consensus.actuation];
  const omitted = pillars.filter((pillar) => !pillar.included || pillar.score == null);
  const names = omitted.map((pillar) => pillar.name);
  const why =
    omitted.length === 1 && omitted[0].id === "actuation"
      ? "its records did not load"
      : "its inputs are not stored or did not load";
  return {
    reason: "coverage",
    missing: `${namesSentence(names)} ${names.length === 1 ? "is" : "are"} left out of AI Consensus: ${why}`,
    coverage: `${numerator} of ${denominator} pillars`,
    source: "the AI Foundation, AI Commerce, and AI Actuation scores on this tab",
    effect: "The remaining pillar weights rescale. A missing pillar is never counted as zero",
  };
}
