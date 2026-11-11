import { activeClient } from "@/lib/client/active-client";
import type { CanvasNode, NodeStatus } from "@/lib/canvas-sdk/types";
import type { CanvasBundle, CanvasReadFailure } from "@/lib/fender-canvas/types";
import type { buildLiveMetrics } from "@/lib/fender-canvas/metrics-from-live";
import { aiNodeFaces } from "@/lib/ai-search/canvas-surfaces";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import {
  EXACT_PAGE_SHARE_BANDS,
  outcomeShareFigure,
  outcomeSharePct,
} from "@/lib/findability/lead";
import { countFindability } from "@/lib/findability/outcomes";
import { pageFoundHero, pageFoundTone } from "@/lib/fender-canvas/ai-readiness-lead";
import {
  PARTIAL_TITLE,
  READ_NOT_AVAILABLE,
  freshnessLastRun,
  markPartial,
  partialFigureTip,
  readFailedPartial,
  type PartialFigure,
} from "@/lib/fender-canvas/canvas-reads";
import { aiSearchStale } from "@/lib/ai-search/stale";
import { findabilityStale } from "@/lib/findability/last-checked";
import { contentSharePartial } from "@/lib/fender-canvas/listing-content";
import { specPagesStale } from "@/lib/fender-canvas/machine-readability";
import { SPEC_CHECK_JOB } from "@/lib/fender-canvas/page-found-checked-at";
import { pageFoundStale } from "@/lib/fender-canvas/page-found-hero";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import { bulletCounts, type BulletCounts } from "@/lib/fender-canvas/listing-content";
import { specPageCounts, type SpecPageCounts } from "@/lib/fender-canvas/machine-readability";
import {
  retailBubbleFaces,
  type RetailCanvasRead,
} from "@/lib/fender-canvas/portfolio-retail-display";
import { primarySpoke, satelliteNode } from "@/lib/fender-canvas/primary-spoke-layout";
import { roadmapBubbleFace } from "@/lib/fender-canvas/roadmap-bubble";
import { brandSite } from "@/lib/brand-copy";

type MetricsMap = ReturnType<typeof buildLiveMetrics>;

const EMPTY_TOOLTIP = { title: "", desc: "" } as const;

/* Bubble labels stay one or two words so they render at 11px or more at 1280x720. The tab
   behind each bubble carries the full name. */
const FINDABILITY_BUBBLE_LABEL = "Exact page";
const READINESS_BUBBLE_LABEL = "Page found";

/** The hover box on a Not available* face: which read failed and what that leaves out. */
function failedReadTooltip(failure: CanvasReadFailure) {
  return { title: PARTIAL_TITLE["read-failed"], desc: partialFigureTip(readFailedPartial(failure)) };
}

/** The hover box on a Not available* face whose read loaded with no rows to count. */
function emptyReadTooltip(source: string, missing: string) {
  return {
    title: READ_NOT_AVAILABLE,
    desc: partialFigureTip({ reason: "coverage", missing, source, effect: "No share is shown until rows arrive." }),
  };
}

type HeroFace = Pick<CanvasNode, "heroValue" | "tooltip" | "partialTip">;

/**
 * X-25: a bubble whose figure is partial (stale past its check schedule, or covering part of
 * its population) carries the asterisk, and its hover box says what is missing. A bubble whose
 * read failed already reads Not available* and keeps its own box. `withTip: false` keeps the
 * asterisk without a hover box, for the AI Search Visibility and Competitive Radar bubbles,
 * which have none (PM24-1).
 */
function withPartialMark<T extends HeroFace>(face: T, partial: PartialFigure | null, withTip = true): T {
  const hero = face.heroValue;
  if (!partial || !hero || !/\d/.test(hero.value)) return face;
  const desc = partialFigureTip(partial);
  return {
    ...face,
    heroValue: { ...hero, value: markPartial(hero.value, partial) },
    tooltip: withTip ? { title: PARTIAL_TITLE[partial.reason], desc } : { ...EMPTY_TOOLTIP },
    partialTip: desc,
  };
}

/** Exact official product page share — same figure the Findability tab leads with. */
function findabilitySatellite(findability: FindabilityRead): Pick<
  CanvasNode,
  "status" | "title" | "stats" | "meta" | "heroValue" | "subTab" | "tooltip"
> {
  if (findability.phase === "loading") {
    return {
      status: "neutral",
      title: "Findability",
      stats: ["Loading"],
      heroValue: { value: "Loading", label: FINDABILITY_BUBBLE_LABEL },
      subTab: "Findability",
      tooltip: { ...EMPTY_TOOLTIP },
    };
  }
  if (findability.phase === "error") {
    return {
      status: "neutral",
      title: "Findability",
      stats: [READ_NOT_AVAILABLE],
      heroValue: { value: READ_NOT_AVAILABLE, label: FINDABILITY_BUBBLE_LABEL },
      subTab: "Findability",
      tooltip: failedReadTooltip({
        key: "specPages",
        source: "canvas_spec_findability",
        label: "Findability read",
        message: findability.message,
      }),
    };
  }
  const counts = countFindability(findability.rows);
  if (counts.total <= 0) {
    return {
      status: "neutral",
      title: "Findability",
      stats: ["No listings"],
      heroValue: { value: "No listings", label: FINDABILITY_BUBBLE_LABEL },
      subTab: "Findability",
      tooltip: { ...EMPTY_TOOLTIP },
    };
  }
  const pct = outcomeSharePct(counts, "exact_official_product");
  const value = outcomeShareFigure(counts, "exact_official_product") ?? "Not available";
  const status: NodeStatus =
    pct == null
      ? "neutral"
      : pct < EXACT_PAGE_SHARE_BANDS.redBelow
        ? "danger"
        : pct > EXACT_PAGE_SHARE_BANDS.greenAbove
          ? "success"
          : "warning";
  return {
    status,
    title: "Findability",
    stats: [
      `${formatInt(counts.exact_official_product)} of ${formatInt(counts.total)} exact`,
    ],
    meta: "Official-page outcomes",
    heroValue: { value, label: FINDABILITY_BUBBLE_LABEL },
    subTab: "Findability",
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

function findabilityFace(findability: FindabilityRead): SatelliteFace {
  const face = findabilitySatellite(findability);
  return findability.phase === "ready" ? withPartialMark(face, findabilityStale(findability.rows)) : face;
}

type SatelliteFace = Pick<
  CanvasNode,
  "status" | "title" | "stats" | "meta" | "heroValue" | "subTab" | "tooltip"
>;

/** Missing machine-readable specs on found fender.com pages. Opens Brand-Site Specs. */
function machineReadabilityFace(counts: SpecPageCounts | null, failure: CanvasReadFailure | undefined): SatelliteFace {
  if (!counts) {
    return {
      status: "neutral",
      title: "Brand-Site Specs",
      stats: [READ_NOT_AVAILABLE],
      heroValue: { value: READ_NOT_AVAILABLE, label: "Specs missing" },
      subTab: "Brand-Site Specs",
      tooltip: failure
        ? failedReadTooltip(failure)
        : emptyReadTooltip("canvas_spec_readiness", `The read returned no found ${brandSite()} pages`),
    };
  }
  const missingPct = (100 * counts.missingSpecBlock) / counts.pages;
  return {
    status: counts.missingSpecBlock === 0 ? "success" : "danger",
    title: "Brand-Site Specs",
    stats: [`${formatInt(counts.missingSpecBlock)} of ${formatInt(counts.pages)} pages`],
    heroValue: { value: formatPct(missingPct), label: "Specs missing" },
    subTab: "Brand-Site Specs",
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

/** Five-bullet share of live Amazon listings. Same figure as the A+ Matrix hero. */
function aplusFace(counts: BulletCounts | null, failure: CanvasReadFailure | undefined): SatelliteFace {
  if (!counts) {
    return {
      status: "neutral",
      title: "Amazon A+ Matrix",
      stats: [READ_NOT_AVAILABLE],
      heroValue: { value: READ_NOT_AVAILABLE, label: "Five bullets" },
      subTab: "Amazon A+ Matrix",
      tooltip: failure
        ? failedReadTooltip(failure)
        : emptyReadTooltip("canvas_listing_content", "The read returned no Amazon listing bullets"),
    };
  }
  return {
    status: counts.short === 0 ? "success" : "danger",
    title: "Amazon A+ Matrix",
    stats: [`${formatInt(counts.fullBullets)} of ${formatInt(counts.listings)} listings`],
    heroValue: { value: formatPct(counts.pct), label: "Five bullets" },
    subTab: "Amazon A+ Matrix",
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

export function buildLiveNodes(
  bundle: CanvasBundle,
  metrics: MetricsMap,
  retail: RetailCanvasRead = { phase: "loading" },
  ai: AiSearchRead = { phase: "loading" },
  findability: FindabilityRead = { phase: "loading" },
): CanvasNode[] {
  const { m } = bundle;
  const schemaPages = specPageCounts(bundle.specPages);
  const bullets = bulletCounts(bundle.listingContent);
  const retailFaces = retailBubbleFaces(retail);
  const aiStale = ai.phase === "ready" ? aiSearchStale(ai.snapshot.run) : null;
  const aiFaces = aiNodeFaces(ai);
  // Main AI Readiness bubble keeps its title and page-found figure; it opens Brand-Site Specs.
  const pageHero = pageFoundHero(m);
  const pageTone = pageFoundTone(m.spec_fender_found_pct);
  const metricsFailure = bundle.unavailable?.m;
  const metricsTip = metricsFailure ? failedReadTooltip(metricsFailure) : null;
  const pageStale = metricsTip || pageHero.ratio == null ? null : pageFoundStale(freshnessLastRun(bundle, SPEC_CHECK_JOB));
  const readinessStatus: NodeStatus = metricsTip ? "neutral" : (pageTone ?? "neutral");
  const readinessHero = metricsTip
    ? { value: READ_NOT_AVAILABLE, label: READINESS_BUBBLE_LABEL }
    : pageHero.ratio != null
      ? { value: markPartial(pageHero.percent, pageStale), label: READINESS_BUBBLE_LABEL }
      : { value: pageHero.percent === "Pending data" ? "Pending data" : "Not available", label: READINESS_BUBBLE_LABEL };

  return [
    {
      ...satelliteNode("sat-prompts"),
      spokeId: "aeo",
      ...withPartialMark(aiFaces.satPrompts, aiStale),
    },
    {
      ...satelliteNode("sat-citations"),
      spokeId: "aeo",
      ...withPartialMark(aiFaces.satCitations, aiStale),
    },
    {
      ...satelliteNode("sat-drift"),
      spokeId: "aeo",
      ...withPartialMark(aiFaces.satDrift, aiStale),
    },
    {
      ...satelliteNode("sat-buybox"),
      spokeId: "ecommerce",
      ...retailFaces.suppressed,
    },
    {
      ...satelliteNode("sat-asin"),
      spokeId: "ecommerce",
      ...retailFaces.catalog,
    },
    {
      ...satelliteNode("sat-map"),
      spokeId: "ecommerce",
      ...retailFaces.map,
    },
    {
      ...satelliteNode("sat-findability"),
      spokeId: "specs",
      ...findabilityFace(findability),
    },
    {
      ...satelliteNode("sat-schema"),
      spokeId: "specs",
      ...withPartialMark(
        machineReadabilityFace(schemaPages, bundle.unavailable?.specPages),
        schemaPages ? specPagesStale(bundle.specPages ?? null) : null,
      ),
    },
    {
      ...satelliteNode("sat-tables"),
      spokeId: "specs",
      ...withPartialMark(
        aplusFace(bullets, bundle.unavailable?.listingContent),
        bullets && bundle.listingContent ? contentSharePartial(bundle.listingContent, "bullets") : null,
      ),
    },
    {
      ...satelliteNode("sat-taylor"),
      spokeId: "competitors",
      ...withPartialMark(aiFaces.satGap, aiStale),
    },
    {
      ...satelliteNode("sat-amps"),
      spokeId: "competitors",
      ...withPartialMark(aiFaces.satLead, aiStale),
    },
    {
      ...withPartialMark(aiFaces.spokeAeo, aiStale, false),
      spokeId: "aeo",
      ...primarySpoke("spoke-aeo"),
    },
    {
      ...retailFaces.main,
      spokeId: "ecommerce",
      ...primarySpoke("spoke-retail"),
    },
    {
      ...primarySpoke("spoke-specs"),
      status: readinessStatus,
      title: "AI Readiness",
      stats: [],
      heroValue: readinessHero,
      spokeId: "specs",
      subTab: "Brand-Site Specs",
      tooltip:
        metricsTip ??
        (pageStale ? { title: PARTIAL_TITLE[pageStale.reason], desc: partialFigureTip(pageStale) } : { title: "", desc: "" }),
      partialTip: pageStale ? partialFigureTip(pageStale) : undefined,
    },
    {
      ...withPartialMark(aiFaces.spokeCompetitors, aiStale, false),
      spokeId: "competitors",
      ...primarySpoke("spoke-competitors"),
    },
    {
      ...primarySpoke("spoke-fixes"),
      status: "neutral",
      title: "Action Items",
      stats: [],
      // Phase 1 dollar figure stays an analyst estimate — never a fee or ROI multiple.
      heroValue: { value: metrics.phaseOneLift.value, label: "Phase 1 lift" },
      spokeId: "suggestions",
      tooltip: { title: "", desc: "" },
    },
    {
      ...primarySpoke("spoke-roadmap"),
      title: "Roadmap",
      stats: [],
      ...roadmapBubbleFace(),
      spokeId: "roadmap",
      tooltip: { title: "", desc: "" },
    },
    {
      id: "hub",
      x: 800,
      y: 500,
      r: 98,
      status: "danger",
      variant: "hub",
      title: activeClient().logoSrc ? "Summary" : `${activeClient().brandName} Summary`,
      stats: [],
      logoSrc: activeClient().logoSrc ?? undefined,
      spokeId: "hub",
      tooltip: { title: "", desc: "" },
    },
  ];
}
