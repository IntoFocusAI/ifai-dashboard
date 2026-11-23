/** Minimal view entries for Summary and Action Items. */

import { failedReadTip } from "@/lib/fender-canvas/canvas-reads";
import { ACTUATION_OMITTED_REASON } from "@/lib/fender-canvas/consensus-score-display";
import { consensusFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import type { ConsensusScore } from "@/lib/fender-canvas/consensus-scores";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import {
  bubbleEntry,
  cached,
  loadingFigure,
  missingFigure,
  scoreFigure,
  type MinimalContext,
  type MinimalEntry,
} from "@/lib/fender-canvas/minimal-metric-kit";
import { activeOfferSplit, brandSellerLed } from "@/lib/fender-canvas/offer-clarity";
import { brandName } from "@/lib/brand-copy";

const PERFORMANCE = "Performance";
const NO_SCORE = "AI Consensus scores are not available until the retail reading loads.";

/** Same inputs and loading rule as Summary → Performance. */
function consensus(ctx: MinimalContext): ConsensusScore | null | "loading" {
  return cached(ctx, "consensus", () => {
    if (ctx.retail.phase === "loading" || ctx.findability.phase === "loading" || ctx.ai.phase === "loading") {
      return "loading";
    }
    return consensusFromLive({
      findability: ctx.findability,
      specPages: ctx.bundle.specPages,
      retail: ctx.retail,
      ai: ctx.ai,
      authorizedPartners: ctx.authorizedPartners,
      actuation: ctx.bundle.actuation,
    });
  });
}

function scoreEntry(
  id: string,
  label: string,
  pieId: string,
  pick: (score: ConsensusScore) => Pick<ConsensusScore["foundation"], "score" | "coverage">,
  noScore = "Not enough inputs are stored for this score yet.",
): MinimalEntry {
  return {
    id,
    spokeId: "hub",
    tab: PERFORMANCE,
    label,
    read: (ctx) => {
      const score = consensus(ctx);
      if (score === "loading") return loadingFigure("The AI Consensus inputs are still loading.");
      if (!score) return missingFigure(NO_SCORE);
      return scoreFigure(pieId, label, pick(score), noScore);
    },
  };
}

export const SUMMARY_ENTRIES: MinimalEntry[] = [
  {
    id: "briefing-amazon-buy-box",
    spokeId: "hub",
    tab: "Briefing",
    // A brand-led client's own store is meant to hold the Buy Box, so its card counts that store, not Amazon.
    label: () => (brandSellerLed() ? `${brandName()}'s own store holds the Buy Box` : "Amazon holds the Buy Box"),
    read: (ctx) => {
      const failed = failedReadTip(ctx.bundle, "m");
      if (failed) return missingFigure(failed);
      const split = activeOfferSplit(ctx.bundle.m);
      if (!split) return missingFigure("The offer split is not stored.");
      if (split.active <= 0) return missingFigure("No listing in this catalog read has an active Amazon offer.");
      const held = brandSellerLed() ? split.brand : split.oneP;
      return {
        value: formatPct((held / split.active) * 100),
        tone: "neutral",
        ratio: `${formatInt(held)} of ${formatInt(split.active)} listings with an active Amazon offer`,
        pie: null,
        tip: null,
        missing: null,
      };
    },
  },
  scoreEntry("summary-ai-consensus", "AI Consensus", "score-consensus", (score) => score),
  scoreEntry("summary-ai-foundation", "AI Foundation", "score-foundation", (score) => score.foundation),
  scoreEntry("summary-ai-commerce", "AI Commerce", "score-commerce", (score) => score.commerce),
  // The id predates the score (it was an Other figure), so viewers' saved slots keep it.
  scoreEntry("ai-actuation", "AI Actuation", "score-actuation", (score) => score.actuation, ACTUATION_OMITTED_REASON),
];

export const ACTION_ITEM_ENTRIES: MinimalEntry[] = [
  bubbleEntry({
    id: "spoke-fixes",
    spokeId: "suggestions",
    label: "Recoverable Revenue, Phase 1",
    tab: "Revenue Estimates",
    provenance: "estimate",
    read: (ctx) => ({ ratio: null, pie: null, tip: null, missing: null, estimate: ctx.phaseOne.detail }),
  }),
  {
    id: "enterprise-potential",
    spokeId: "suggestions",
    tab: "Revenue Estimates",
    label: "Enterprise GMV potential",
    provenance: "estimate",
    read: (ctx) => ({
      value: ctx.enterprise.value,
      tone: "success",
      ratio: null,
      pie: null,
      tip: null,
      missing: null,
      estimate: ctx.enterprise.detail,
    }),
  },
];
