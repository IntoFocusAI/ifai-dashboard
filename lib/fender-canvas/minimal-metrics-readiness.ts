/** Minimal view entries for AI Readiness, in tab order. */

import { bucketLabel, OUTCOME_LABEL } from "@/lib/findability/copy";
import {
  exactPageLeadPie,
  outcomeLeadPie,
  outcomeLeadTip,
  outcomeRatioFigure,
  outcomeShareColor,
  outcomeShareFigure,
} from "@/lib/findability/lead";
import { countFindability, type FindabilityBucket, type OutcomeCounts } from "@/lib/findability/outcomes";
import {
  amazonCompletenessHero,
  PAGE_FOUND_LABEL,
  presentAmazonCompletenessFieldShare,
  resolveAmazonFieldTotals,
} from "@/lib/fender-canvas/ai-readiness-lead";
import { failedReadTip } from "@/lib/fender-canvas/canvas-reads";
import { listingContentHeroes } from "@/lib/fender-canvas/listing-content";
import { machineReadabilityHeroes } from "@/lib/fender-canvas/machine-readability";
import { brandSitePageFoundHero } from "@/lib/fender-canvas/page-found-hero";
import {
  bubbleEntry,
  cached,
  counted,
  heroFigure,
  isNotAvailable,
  loadingFigure,
  missingFigure,
  toneFromColor,
  type MinimalContext,
  type MinimalEntry,
  type MinimalFigure,
} from "@/lib/fender-canvas/minimal-metric-kit";

const LISTINGS_IN_READ = "listings in this read";

/** Not available* naming the page read, when that read failed. */
function pageReadFigure(ctx: MinimalContext, key: "specPages" | "listingContent"): MinimalFigure | null {
  const failed = failedReadTip(ctx.bundle, key);
  return failed ? missingFigure(failed) : null;
}

function findabilityCounts(ctx: MinimalContext): OutcomeCounts | null {
  return cached(ctx, "findability-counts", () => (ctx.findability.phase === "ready" ? countFindability(ctx.findability.rows) : null));
}

/** One Findability outcome hero: its share of the read, N of M, and its disc. */
function outcomeEntry(bucket: Exclude<FindabilityBucket, "exact_official_product">): MinimalEntry {
  return {
    id: `findability-${bucket.replace(/_/g, "-")}`,
    spokeId: "specs",
    tab: "Findability",
    label: bucket === "other" ? bucketLabel("other") : OUTCOME_LABEL[bucket],
    offered: (ctx) => bucket !== "other" || (findabilityCounts(ctx)?.other ?? 0) > 0,
    read: (ctx): MinimalFigure => {
      if (ctx.findability.phase === "loading") return loadingFigure("Official-page outcomes are loading.");
      const counts = findabilityCounts(ctx);
      if (!counts) return missingFigure("The official-page read did not load.");
      const share = outcomeShareFigure(counts, bucket);
      const ratio = outcomeRatioFigure(counts, bucket);
      if (!share || !ratio) return missingFigure("This official-page read has no listings.");
      return {
        value: share,
        tone: toneFromColor(outcomeShareColor(counts, bucket)),
        ratio: `${ratio} ${LISTINGS_IN_READ}`,
        pie: outcomeLeadPie(counts, bucket),
        tip: outcomeLeadTip(counts, bucket),
        missing: null,
      };
    },
  };
}

export const READINESS_ENTRIES: MinimalEntry[] = [
  bubbleEntry({
    id: "sat-findability",
    spokeId: "specs",
    label: "Exact official product page",
    tab: "Findability",
    read: (ctx) => {
      if (ctx.findability.phase === "loading") return counted(null, "", null, null, "Official-page outcomes are loading.");
      const counts = findabilityCounts(ctx);
      if (!counts) return counted(null, "", null, null, "The official-page read did not load.");
      return counted(
        outcomeRatioFigure(counts, "exact_official_product"),
        LISTINGS_IN_READ,
        exactPageLeadPie(counts),
        outcomeLeadTip(counts, "exact_official_product"),
        "This official-page read has no listings.",
      );
    },
  }),
  outcomeEntry("official_family_page"),
  outcomeEntry("completed_not_found"),
  outcomeEntry("ambiguous_candidate"),
  outcomeEntry("not_checked"),
  outcomeEntry("other"),
  {
    id: "amazon-specs-completeness",
    spokeId: "specs",
    tab: "Amazon Specs",
    label: "Amazon attribute completeness",
    read: (ctx) => {
      const failed = failedReadTip(ctx.bundle, "m");
      if (failed) return missingFigure(failed);
      const hero = amazonCompletenessHero(ctx.bundle.m, ctx.amazonFieldTotals);
      if (isNotAvailable(hero.percent)) return missingFigure("The Amazon listing check has not reported an attribute completeness figure.");
      const totals = resolveAmazonFieldTotals(ctx.bundle.m, ctx.amazonFieldTotals);
      const share = presentAmazonCompletenessFieldShare(totals?.found, totals?.expected, ctx.bundle.m.spec_avg_amazon_pct);
      return {
        value: hero.percent,
        tone: toneFromColor(hero.color),
        ratio: share.kind === "share" ? `${share.ratio} Amazon attribute fields filled` : null,
        pie: hero.pie,
        tip: hero.tip,
        missing: null,
      };
    },
  },
  bubbleEntry({
    id: "spoke-specs",
    spokeId: "specs",
    label: PAGE_FOUND_LABEL,
    tab: "Brand-Site Specs",
    read: (ctx) => {
      const failed = failedReadTip(ctx.bundle, "m");
      if (failed) return counted(null, "", null, null, failed);
      const hero = brandSitePageFoundHero(ctx.bundle.m);
      return counted(hero.ratio, "checked SKUs", hero.pie, hero.tip, hero.figureTip ?? hero.explainer);
    },
  }),
  bubbleEntry({
    id: "sat-schema",
    spokeId: "specs",
    label: "Found pages missing machine-readable specs",
    tab: "Brand-Site Specs",
    read: (ctx) => {
      const hero = machineReadabilityHeroes(ctx.bundle.specPages ?? null)[0];
      const missing = failedReadTip(ctx.bundle, "specPages") ?? hero.explainer;
      return counted(hero.ratio, "found fender.com pages", hero.pie, hero.tip, missing);
    },
  }),
  {
    id: "brand-site-product-basics",
    spokeId: "specs",
    tab: "Brand-Site Specs",
    label: "Product basics present",
    read: (ctx) =>
      pageReadFigure(ctx, "specPages") ??
      heroFigure(machineReadabilityHeroes(ctx.bundle.specPages ?? null)[1], "fender.com pages checked", "The fender.com page read could not be loaded."),
  },
  bubbleEntry({
    id: "sat-tables",
    spokeId: "specs",
    label: "Five Amazon bullets filled",
    tab: "Amazon A+ Matrix",
    read: (ctx) => {
      const hero = listingContentHeroes(ctx.bundle.listingContent ?? null)[0];
      const missing = failedReadTip(ctx.bundle, "listingContent") ?? hero.explainer;
      return counted(hero.ratio, "live Amazon listings checked", hero.pie, hero.tip, missing);
    },
  }),
  {
    id: "aplus-content",
    spokeId: "specs",
    tab: "Amazon A+ Matrix",
    label: "A+ content",
    read: (ctx) =>
      pageReadFigure(ctx, "listingContent") ??
      heroFigure(listingContentHeroes(ctx.bundle.listingContent ?? null)[1], "live Amazon pages read", "No A+ read yet."),
  },
  {
    id: "aplus-video",
    spokeId: "specs",
    tab: "Amazon A+ Matrix",
    label: "Product video",
    read: (ctx) =>
      pageReadFigure(ctx, "listingContent") ??
      heroFigure(listingContentHeroes(ctx.bundle.listingContent ?? null)[2], "live Amazon pages read", "No video read yet."),
  },
];
