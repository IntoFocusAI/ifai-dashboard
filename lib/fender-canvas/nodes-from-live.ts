import type { CanvasNode, NodeStatus } from "@/lib/canvas-sdk/types";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
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
import { failedReadTip, READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import { bulletCounts, type BulletCounts } from "@/lib/fender-canvas/listing-content";
import { specPageCounts, type SpecPageCounts } from "@/lib/fender-canvas/machine-readability";
import {
  retailBubbleFaces,
  type RetailCanvasRead,
} from "@/lib/fender-canvas/portfolio-retail-display";
import { primarySpoke, satelliteNode } from "@/lib/fender-canvas/primary-spoke-layout";

type MetricsMap = ReturnType<typeof buildLiveMetrics>;

const EMPTY_TOOLTIP = { title: "", desc: "" } as const;

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
      heroValue: { value: "Loading", label: "exact official product page" },
      subTab: "Findability",
      tooltip: { ...EMPTY_TOOLTIP },
    };
  }
  if (findability.phase === "error") {
    return {
      status: "danger",
      title: "Findability",
      stats: ["Read failed"],
      heroValue: { value: "Read failed", label: "exact official product page" },
      subTab: "Findability",
      tooltip: { ...EMPTY_TOOLTIP },
    };
  }
  const counts = countFindability(findability.rows);
  if (counts.total <= 0) {
    return {
      status: "neutral",
      title: "Findability",
      stats: ["No listings"],
      heroValue: { value: "No listings", label: "exact official product page" },
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
    heroValue: { value, label: "exact official product page" },
    subTab: "Findability",
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

type SatelliteFace = Pick<
  CanvasNode,
  "status" | "title" | "stats" | "meta" | "heroValue" | "subTab" | "tooltip"
>;

/** Missing machine-readable specs on found fender.com pages. Opens Brand-Site Specs. */
function machineReadabilityFace(counts: SpecPageCounts | null): SatelliteFace {
  if (!counts) {
    return {
      status: "warning",
      title: "Brand-Site Specs",
      stats: ["Not available*"],
      heroValue: { value: "Not available*", label: "missing machine-readable specs" },
      subTab: "Brand-Site Specs",
      tooltip: { ...EMPTY_TOOLTIP },
    };
  }
  const missingPct = (100 * counts.missingSpecBlock) / counts.pages;
  return {
    status: counts.missingSpecBlock === 0 ? "success" : "danger",
    title: "Brand-Site Specs",
    stats: [`${formatInt(counts.missingSpecBlock)} of ${formatInt(counts.pages)} pages`],
    heroValue: { value: formatPct(missingPct), label: "missing machine-readable specs" },
    subTab: "Brand-Site Specs",
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

/** Five-bullet share of live Amazon listings. Same figure as the A+ Matrix hero. */
function aplusFace(counts: BulletCounts | null): SatelliteFace {
  if (!counts) {
    return {
      status: "warning",
      title: "Amazon A+ Matrix",
      stats: ["Not available*"],
      heroValue: { value: "Not available*", label: "Five bullets filled" },
      subTab: "Amazon A+ Matrix",
      tooltip: { ...EMPTY_TOOLTIP },
    };
  }
  return {
    status: counts.short === 0 ? "success" : "danger",
    title: "Amazon A+ Matrix",
    stats: [`${formatInt(counts.fullBullets)} of ${formatInt(counts.listings)} listings`],
    heroValue: { value: formatPct(counts.pct), label: "Five bullets filled" },
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
  const aiFaces = aiNodeFaces(ai);
  // Main AI Readiness bubble keeps its title and page-found figure; it opens Brand-Site Specs.
  const pageHero = pageFoundHero(m);
  const pageTone = pageFoundTone(m.spec_fender_found_pct);
  const metricsTip = failedReadTip(bundle, "m");
  const readinessStatus: NodeStatus = metricsTip ? "warning" : (pageTone ?? "neutral");
  const readinessHero = metricsTip
    ? { value: READ_NOT_AVAILABLE, label: "fender.com page found" }
    : pageHero.ratio != null
      ? { value: pageHero.percent, label: "fender.com page found" }
      : { value: pageHero.percent === "Pending data" ? "Pending data" : "Not available", label: "fender.com page found" };

  return [
    {
      ...satelliteNode("sat-prompts"),
      spokeId: "aeo",
      ...aiFaces.satPrompts,
    },
    {
      ...satelliteNode("sat-citations"),
      spokeId: "aeo",
      ...aiFaces.satCitations,
    },
    {
      ...satelliteNode("sat-drift"),
      spokeId: "aeo",
      ...aiFaces.satDrift,
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
      ...findabilitySatellite(findability),
    },
    {
      ...satelliteNode("sat-schema"),
      spokeId: "specs",
      ...machineReadabilityFace(schemaPages),
    },
    {
      ...satelliteNode("sat-tables"),
      spokeId: "specs",
      ...aplusFace(bullets),
    },
    {
      ...satelliteNode("sat-taylor"),
      spokeId: "competitors",
      ...aiFaces.satGap,
    },
    {
      ...satelliteNode("sat-amps"),
      spokeId: "competitors",
      ...aiFaces.satLead,
    },
    {
      ...aiFaces.spokeAeo,
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
      tooltip: metricsTip ? { title: READ_NOT_AVAILABLE, desc: metricsTip } : { title: "", desc: "" },
    },
    {
      ...aiFaces.spokeCompetitors,
      spokeId: "competitors",
      ...primarySpoke("spoke-competitors"),
    },
    {
      ...primarySpoke("spoke-fixes"),
      status: "success",
      title: "Action Items",
      stats: [],
      // Phase 1 dollar figure stays an analyst estimate — never a fee or ROI multiple.
      heroValue: { value: metrics.phaseOneLift.value, label: "Phase 1 lift" },
      spokeId: "suggestions",
      tooltip: { title: "", desc: "" },
    },
    {
      ...primarySpoke("spoke-roadmap"),
      status: "success",
      title: "Strategy Roadmap",
      stats: [],
      heroValue: { value: "90 Days", label: "3 phases" },
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
      title: "Summary",
      stats: [],
      logoSrc: "/image.png",
      spokeId: "hub",
      tooltip: { title: "", desc: "" },
    },
  ];
}
