import type { TourStep } from "@/lib/canvas-sdk/types";
import { aiTourLines } from "@/lib/ai-search/canvas-surfaces";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { findabilityTourLine, type FindabilityRead } from "@/lib/findability/copy";
import { ENTERPRISE_POTENTIAL_ESTIMATE, PHASE_ONE_LIFT_ESTIMATE } from "@/lib/fender-canvas/analyst-estimates";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import { specPageCounts } from "@/lib/fender-canvas/machine-readability";
import {
  headlineSentence,
  headlineSurface,
  type RetailCanvasRead,
} from "@/lib/fender-canvas/portfolio-retail-display";
import { frameTourStep } from "@/lib/fender-canvas/primary-spoke-layout";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

export function buildLiveTourSteps(
  bundle: CanvasBundle,
  retail: RetailCanvasRead = { phase: "loading" },
  ai: AiSearchRead = { phase: "loading" },
  findability: FindabilityRead = { phase: "loading" },
): TourStep[] {
  const { m } = bundle;
  const schemaPages = specPageCounts(bundle.specPages);
  const aiLines = aiTourLines(ai);
  const headline = headlineSentence(headlineSurface(retail));

  return [
    {
      nodeId: "hub",
      targetX: 800,
      targetY: 500,
      radius: 185,
      title: "Brand Overview",
      subtitle: "Fender's health across catalog divisions",
      category: "BRAND CORE",
      displays: [
        headline,
        aiLines.hub,
      ],
      value: "One page tying Amazon listing problems and AI recommendations to revenue.",
    },
    {
      nodeId: "ecommerce",
      targetX: 1160,
      targetY: 320,
      radius: 125,
      title: "Catalog Health",
      subtitle: "Buy Box, MAP, and catalog nesting",
      category: "RETAIL HEALTH",
      displays: [
        "Suppressed Buy Boxes, MAP leakage, and unnested bundles",
        "A partial reading keeps its count and says what is still missing",
      ],
      value: "These catalog and retail issues change what an assistant can recommend and what a shopper can buy.",
    },
    {
      nodeId: "aeo",
      targetX: 440,
      targetY: 320,
      radius: 125,
      title: "AI Search Visibility",
      subtitle: "What AI assistants say about Fender on buying questions",
      category: "AI SEARCH VISIBILITY",
      displays: aiLines.aeo,
      value: "See how often AI assistants name Fender on buying questions, which pages they cite, and where rivals lead.",
    },
    {
      nodeId: "specs",
      targetX: 440,
      targetY: 680,
      radius: 120,
      title: "Product Readiness",
      subtitle: "Can AI and Amazon read your specs correctly?",
      category: "AI READINESS",
      displays: [
        schemaPages
          ? `${formatInt(schemaPages.missingSpecBlock)} of ${formatInt(schemaPages.pages)} fender.com pages have no spec block`
          : "fender.com page read not available",
        findabilityTourLine(findability),
        bundle.unavailable?.missing
          ? `Amazon Specs missing-field rows: ${READ_NOT_AVAILABLE} (${bundle.unavailable.missing.source} did not load)`
          : `${formatInt(bundle.missing.length)} missing-field rows are on Amazon Specs`,
      ],
      value: "Make fender.com the source AI trusts for specs, with fewer wrong answers and fewer returns.",
    },
    {
      nodeId: "competitors",
      targetX: 1160,
      targetY: 680,
      radius: 120,
      title: "Competitors",
      subtitle: "Where rivals beat Fender, and why",
      category: "COMPETITORS",
      displays: aiLines.competitors,
      value: "See which rivals AI engines name over Fender, in which categories, with every answer behind it.",
    },
    {
      nodeId: "suggestions",
      targetX: 800,
      targetY: 180,
      radius: 115,
      title: "Action Items & ROI",
      subtitle: "Action items, with revenue labeled as estimates",
      category: "OPPORTUNITY",
      displays: [
        "Revenue figures on this spoke are estimates",
        `Phase 1: ${PHASE_ONE_LIFT_ESTIMATE}`,
        `Enterprise: ${ENTERPRISE_POTENTIAL_ESTIMATE}`,
      ],
      value: "See what each Action Item is worth, so you know where to start.",
    },
    {
      nodeId: "roadmap",
      targetX: 800,
      targetY: 820,
      radius: 115,
      title: "90-Day Roadmap",
      subtitle: "What happens at 30, 60, and 90 days",
      category: "ROADMAP",
      displays: [
        headline,
        aiLines.roadmap,
      ],
      value: "Follow a 90-day plan from the current retail headline.",
    },
  ].map(frameTourStep);
}
