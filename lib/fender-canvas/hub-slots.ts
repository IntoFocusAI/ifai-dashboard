/**
 * Hover slots for each main bubble (FDD X-22): largest performance gap, largest defensible
 * opportunity, and highest-priority action. Each slot names the rule that picked it, its
 * target (or No target set), what it is counted out of, when it was last checked, and the
 * tab that holds the rows. Targets are only the FDD-approved bands.
 */

import type { HubEvidenceFeed, HubEvidenceSlot } from "@/lib/canvas-sdk/hub-slot-types";
import type { HubSlotFeed, HubSlotRole, PriorityItem } from "@/lib/canvas-sdk/types";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import { pickAction } from "@/lib/fender-canvas/hub-slot-actions";
import { buildCheckBook, type CheckBook, type CheckId, type SlotReads } from "@/lib/fender-canvas/hub-slot-checks";
import {
  evidenceSlot,
  HUB_SLOT_ROLE_LABEL,
  NO_TARGET_SET,
  notAvailableLine,
} from "@/lib/fender-canvas/hub-slot-format";
import {
  consensusGap,
  pickCategoryGap,
  pickCategoryOpportunity,
  pickGap,
  pickOpportunity,
  readScores,
  type GapPool,
} from "@/lib/fender-canvas/hub-slot-rules";
import { buildLiveMetrics } from "@/lib/fender-canvas/metrics-from-live";
import type { RetailReading, SuppressionDetail } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

export type SuppressedSlotRead = RetailReading<SuppressionDetail | null> | "loading" | "error";

export type HubSlotInput = {
  ai: AiSearchRead;
  findability: FindabilityRead;
  commandItems: PriorityItem[];
  phaseOneValue: string;
  phaseOneDetail: string;
  bundle?: CanvasBundle | null;
  /** Undefined is read as still loading. */
  retail?: RetailCanvasRead;
  /** Null keeps the placeholder partner list. */
  authorizedPartners?: readonly string[] | null;
  /** Accepted from older callers and not read. The slots use `retail` and `bundle`. */
  suppressed?: SuppressedSlotRead;
  missingSpecPages?: number | null;
};

export function hubSlotRoleLabel(role: HubSlotRole): string {
  return HUB_SLOT_ROLE_LABEL[role];
}

const ALL_CHECKS: CheckId[] = [
  "buy_box_withheld",
  "controlled_buy_box",
  "map_violation",
  "splintered",
  "specs_complete",
  "required_specs",
  "machine_readable",
  "exact_pages",
  "five_bullets",
  "unbranded",
  "branded",
  "fact_checks",
];

const SHARE_RULE = "this one has the highest share of its own population falling short.";

const POOLS = {
  retail: {
    ids: ["buy_box_withheld", "controlled_buy_box", "map_violation", "splintered", "specs_complete"],
    rule: `Of the Catalog Health checks with a stored population, ${SHARE_RULE}`,
  },
  specs: {
    ids: ["exact_pages", "machine_readable", "required_specs", "specs_complete", "five_bullets"],
    rule: `Of the AI Readiness checks with a stored population, ${SHARE_RULE}`,
    evidence: { specs_complete: { spokeId: "specs", subTab: "Amazon Specs" } },
  },
  aeo: {
    ids: ["unbranded", "branded", "fact_checks"],
    rule: `Of the AI Search Visibility checks in the published run, ${SHARE_RULE}`,
  },
  findings: {
    ids: ["buy_box_withheld", "map_violation", "splintered", "exact_pages", "unbranded"],
    rule: `Of the five current findings, ${SHARE_RULE}`,
  },
  all: {
    ids: ALL_CHECKS,
    rule: `Of every check behind the map's bubbles, ${SHARE_RULE}`,
  },
} satisfies Record<string, GapPool>;

function times(book: CheckBook, ids: CheckId[]): Array<string | null | undefined> {
  return ids.flatMap((id) => book.checks[id]?.checkedAt ?? []);
}

/** Action Items: the only stored dollar opportunity is the Phase 1 analyst estimate. */
function estimateOpportunity(input: HubSlotInput): HubEvidenceSlot {
  return evidenceSlot({
    role: "opportunity",
    rule: "The Phase 1 lift is the only dollar opportunity stored for Action Items. It is an analyst estimate, and its inputs are not open yet.",
    figure: input.phaseOneValue,
    label: `Recoverable Revenue: ${input.phaseOneDetail}`,
    note: "Analyst estimate.",
    tone: "neutral",
    statusWord: "Analyst estimate",
    chart: null,
    target: { text: NO_TARGET_SET },
    countedOutOf: notAvailableLine("", "This analyst estimate does not open to its inputs and formula yet."),
    lastChecked: notAvailableLine("Last checked", "This analyst estimate has no stored date."),
    spokeId: "suggestions",
    subTab: "Revenue Estimates",
  });
}

function feed(bubbleId: string, title: string, slots: [HubEvidenceSlot, HubEvidenceSlot, HubEvidenceSlot]): HubEvidenceFeed {
  return { bubbleId, title, slots };
}

/** Three evidence slots for each main bubble, keyed by bubble id. */
export function buildHubSlots(input: HubSlotInput): Record<string, HubSlotFeed> {
  const reads: SlotReads = {
    bundle: input.bundle,
    retail: input.retail,
    ai: input.ai,
    findability: input.findability,
    authorizedPartners: input.authorizedPartners,
  };
  const book = buildCheckBook(reads);
  const scores = readScores(reads);
  const items = input.commandItems;
  const performance = { spokeId: "hub", subTab: "Performance" };
  const consensusOpportunity = pickOpportunity(book, scores, {
    unit: "AI Consensus",
    waitFor: ALL_CHECKS,
    evidence: performance,
    rule: "Of every check in AI Consensus, closing this one would add the most AI Consensus points, by its approved weight.",
  });
  const firstItem = (bubble: string) => pickAction(items, book, reads, { bubble, fallbackTimes: times(book, ALL_CHECKS) });
  const bubbleItem = (bubble: string, spokeId: string, ids: CheckId[]) =>
    pickAction(items, book, reads, { bubble, spokeId, fallbackTimes: times(book, ids) });

  return {
    hub: feed("hub", "Summary", [
      pickGap(book, POOLS.all, "Summary", { spokeId: "hub", subTab: "Briefing" }),
      consensusOpportunity,
      firstItem("Summary"),
    ]),
    "spoke-retail": feed("spoke-retail", "Catalog Health", [
      pickGap(book, POOLS.retail, "Catalog Health", { spokeId: "ecommerce", subTab: "Retail Overview" }),
      pickOpportunity(book, scores, {
        unit: "AI Commerce",
        waitFor: POOLS.retail.ids,
        evidence: { spokeId: "ecommerce", subTab: "Retail Overview" },
      }),
      bubbleItem("Catalog Health", "ecommerce", POOLS.retail.ids),
    ]),
    "spoke-aeo": feed("spoke-aeo", "AI Search Visibility", [
      pickGap(book, POOLS.aeo, "AI Search Visibility", { spokeId: "aeo", subTab: "Run Summary" }),
      pickOpportunity(book, scores, {
        unit: "AI Foundation",
        only: ["unbranded_named_most", "fact_check_match"],
        waitFor: ["unbranded", "fact_checks"],
        evidence: performance,
      }),
      bubbleItem("AI Search Visibility", "aeo", POOLS.aeo.ids),
    ]),
    "spoke-specs": feed("spoke-specs", "AI Readiness", [
      pickGap(book, POOLS.specs, "AI Readiness", { spokeId: "specs", subTab: "Findability" }),
      pickOpportunity(book, scores, {
        unit: "AI Foundation",
        only: ["exact_official_pages", "machine_readable_specs", "required_marketplace_specs"],
        waitFor: ["exact_pages", "machine_readable", "required_specs"],
        evidence: performance,
      }),
      bubbleItem("AI Readiness", "specs", POOLS.specs.ids),
    ]),
    "spoke-competitors": feed("spoke-competitors", "Competitive Radar", [
      pickCategoryGap(book),
      pickCategoryOpportunity(book, scores),
      bubbleItem("Competitive Radar", "competitors", ["unbranded"]),
    ]),
    "spoke-fixes": feed("spoke-fixes", "Action Items", [
      pickGap(book, POOLS.findings, "Action Items", { spokeId: "suggestions", subTab: "Current findings" }),
      estimateOpportunity(input),
      firstItem("Action Items"),
    ]),
    "spoke-roadmap": feed("spoke-roadmap", "Strategy Roadmap", [
      consensusGap(book, scores),
      consensusOpportunity,
      firstItem("Strategy Roadmap"),
    ]),
  };
}

/** Live slots from the same reads the canvas shows. The Phase 1 figure comes from the live metrics. */
export function buildLiveHubSlots(args: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
  ai: AiSearchRead;
  findability: FindabilityRead;
  commandItems: PriorityItem[];
  authorizedPartners: readonly string[] | null;
}): Record<string, HubSlotFeed> {
  const phaseOne = buildLiveMetrics(args.bundle, args.retail, args.findability).phaseOneLift;
  return buildHubSlots({
    ...args,
    phaseOneValue: phaseOne.value,
    phaseOneDetail: phaseOne.detail ?? "Phase 1 annual estimate",
  });
}
