/**
 * Minimal view entries for figures no tab shows yet. The picker lists them under Other, last,
 * so they stay in view. Each opens the closest related tab, and its definition says where the
 * figure comes from.
 */

import { strongestCategory } from "@/lib/ai-search/canvas-surfaces";
import { categoryBattles } from "@/lib/ai-search/competitors";
import { categoryLabel } from "@/lib/ai-search/run-metrics";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { failedReadTip } from "@/lib/fender-canvas/canvas-reads";
import { ACTUATION_OMITTED_REASON } from "@/lib/fender-canvas/consensus-score-display";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import { categoryUnbrandedFigure } from "@/lib/fender-canvas/minimal-metrics-ai";
import {
  aiFigure,
  cached,
  missingFigure,
  type MinimalContext,
  type MinimalEntry,
  type MinimalFigure,
} from "@/lib/fender-canvas/minimal-metric-kit";

const NO_TAB = "No tab shows this figure yet.";

function finite(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function toneFromPct(pct: number, dangerBelow: number, warnBelow: number): NodeStatus {
  if (pct < dangerBelow) return "danger";
  if (pct < warnBelow) return "warning";
  return "success";
}

/** A stored share with its counts, or the reason it is missing. */
function storedShare(
  pct: number | null,
  part: number | null,
  whole: number | null,
  noun: string,
  bands: [number, number],
  missing: string,
): MinimalFigure {
  if (pct == null) return missingFigure(missing);
  return {
    value: formatPct(pct),
    tone: toneFromPct(pct, ...bands),
    ratio: part != null && whole != null ? `${formatInt(part)} of ${formatInt(whole)} ${noun}` : null,
    pie: null,
    tip: null,
    missing: null,
  };
}

function strongest(ctx: MinimalContext) {
  return cached(ctx, "strongest-category", () =>
    ctx.ai.phase === "ready" ? strongestCategory(categoryBattles(ctx.ai.snapshot.calls)) : null,
  );
}

function other(entry: Omit<MinimalEntry, "area">): MinimalEntry {
  return { ...entry, area: "Other" };
}

export const OTHER_ENTRIES: MinimalEntry[] = [
  other({
    id: "buy-box-retention",
    spokeId: "ecommerce",
    tab: "Retail Overview",
    label: "Amazon 1P Buy Box share",
    definition:
      "Listings where Amazon itself (1P) holds the Buy Box, out of every listing in the stored Buy Box count, from the catalog metrics row. That count includes listings with no offer, so this share runs lower than the active-offer share on Briefing. " +
      NO_TAB,
    read: (ctx) => {
      const failed = failedReadTip(ctx.bundle, "m");
      if (failed) return missingFigure(failed);
      const m = ctx.bundle.m;
      return storedShare(
        finite(m.bb_1p_pct),
        finite(m.bb_1p),
        finite(m.bb_total),
        "listings in the stored Buy Box count",
        [15, 40],
        "The catalog metrics row does not store a 1P Buy Box share.",
      );
    },
  }),
  other({
    id: "seller-data-coverage",
    spokeId: "ecommerce",
    tab: "Retail Overview",
    label: "Seller data harvested",
    definition: `Catalog listings with stored seller data, out of every catalog listing, from the catalog metrics row. ${NO_TAB}`,
    read: (ctx) => {
      const failed = failedReadTip(ctx.bundle, "m");
      if (failed) return missingFigure(failed);
      const m = ctx.bundle.m;
      return storedShare(
        finite(m.seller_harvested_pct),
        finite(m.seller_harvested),
        finite(m.catalog_skus),
        "catalog listings",
        [10, 40],
        "The catalog metrics row does not store a seller data count.",
      );
    },
  }),
  other({
    id: "stranded-reviews",
    spokeId: "ecommerce",
    tab: "Catalog Governance",
    label: "Stranded customer reviews",
    definition:
      "Customer reviews that sit on partner bundle pages instead of the main Fender listing, from the catalog metrics row. Catalog Governance lists the bundles. " +
      NO_TAB,
    read: (ctx) => {
      const failed = failedReadTip(ctx.bundle, "m");
      if (failed) return missingFigure(failed);
      const reviews = finite(ctx.bundle.m.bundle_reviews);
      if (reviews == null) return missingFigure("The catalog metrics row does not store a stranded review count.");
      return { value: formatInt(reviews), tone: reviews > 0 ? "danger" : "success", ratio: null, pie: null, tip: null, missing: null };
    },
  }),
  other({
    id: "beginner-sov-gap",
    spokeId: "competitors",
    tab: "Category Battlecards",
    label: "Beginner share-of-voice gap",
    definition:
      "Fender/Squier leads minus the top competitor's leads, in points of resolved Beginner unbranded discovery answers in the published AI run. Category Battlecards shows the Beginner row. " +
      NO_TAB,
    read: (ctx) =>
      aiFigure(ctx, (_summary, snapshot) => {
        const battle = categoryBattles(snapshot.calls).find((item) => item.category === "beginner");
        if (!battle || battle.resolved <= 0) return missingFigure("The published run has no resolved Beginner unbranded discovery answers.");
        const rival = battle.leaders[0];
        const gap = ((battle.fenderWins - (rival?.wins ?? 0)) * 100) / battle.resolved;
        const scope = `of ${formatInt(battle.resolved)} resolved Beginner unbranded discovery answers`;
        return {
          value: `${gap > 0 ? "+" : ""}${gap.toFixed(1)} pts`,
          tone: gap < 0 ? "danger" : gap > 0 ? "success" : "warning",
          ratio: rival
            ? `Fender/Squier ${formatInt(battle.fenderWins)} vs ${rival.brand} ${formatInt(rival.wins)} ${scope}`
            : `Fender/Squier ${formatInt(battle.fenderWins)} ${scope}. No competitor led one.`,
          pie: null,
          tip: null,
          missing: null,
        };
      }),
  }),
  other({
    id: "strongest-category-sov",
    spokeId: "competitors",
    tab: "Category Battlecards",
    label: (ctx) => {
      const best = strongest(ctx);
      return best ? `Strongest category: ${categoryLabel(best.category)}` : "Strongest category";
    },
    definition:
      "The question category where Fender/Squier leads the largest share of resolved unbranded discovery answers in the published AI run. Categories with too few answers to compare are skipped while others qualify. Category Battlecards shows every category. " +
      NO_TAB,
    read: (ctx) =>
      aiFigure(ctx, () => {
        const best = strongest(ctx);
        if (!best) return missingFigure("The published run has no resolved unbranded discovery answers.");
        return categoryUnbrandedFigure(ctx, best.category);
      }),
  }),
  other({
    id: "resolved-simulations",
    spokeId: "aeo",
    tab: "Run Summary",
    label: "Answered AI calls",
    definition:
      "Calls that returned an answer, out of the calls the published AI run asked for. The AI Search Visibility header lists it as Answered. No tab shows it as a figure yet.",
    read: (ctx) =>
      aiFigure(ctx, (summary) => {
        const { answered, expected, isPartial } = summary.completeness;
        if (answered == null || expected == null) return missingFigure("The published run does not store its answered call count.");
        const count = `${formatInt(answered)} of ${formatInt(expected)}`;
        return { value: count, tone: isPartial ? "warning" : "success", ratio: `${count} calls answered`, pie: null, tip: null, missing: null };
      }),
  }),
  other({
    id: "ai-actuation",
    spokeId: "hub",
    tab: "Performance",
    label: "AI Actuation",
    definition:
      "The third AI Consensus input: actions with an owner, evidence, and a date. No records are stored yet, so Performance lists it as Not included. No tab shows a figure for it yet.",
    read: () => missingFigure(ACTUATION_OMITTED_REASON),
  }),
  other({
    id: "day-90-buy-box-target",
    spokeId: "roadmap",
    tab: "30-60-90 Day Milestones",
    label: "90-day plan",
    definition:
      "The Strategy Roadmap bubble's 90-day plan, in phases for MAP, catalog nesting, and estimated lift. It is a plan, not a measured result. No tab shows the phases yet.",
    read: (ctx) => {
      const phases = ctx.node("spoke-roadmap")?.heroValue?.label?.trim();
      if (!phases) return missingFigure("The Strategy Roadmap bubble has no plan stored.");
      return { value: phases, tone: "neutral", ratio: "MAP, catalog nesting, and estimated lift", pie: null, tip: null, missing: null };
    },
  }),
];
