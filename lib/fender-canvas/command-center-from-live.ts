import { isPlanPending } from "@/lib/fender-canvas/plan-settled";
import { clientStorageKey } from "@/lib/client/active-client";
import { activeSetAsideClientKey } from "@/lib/set-aside/keys";
import type { CommandCenterSpec, PriorityItem, PriorityOwner } from "@/lib/canvas-sdk/types";
import { aiCommandSummary, aiPriorityItems } from "@/lib/ai-search/canvas-surfaces";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { markPartial } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import { countFigure, severityOf, SEVERITY_FLOOR_SENTENCE, type Severity } from "@/lib/fender-canvas/priority-rank";
import { emptyPlanLine, firstMove, inPriorities, type PlanItem } from "@/lib/fender-canvas/roadmap-plan";
import { bulletCounts } from "@/lib/fender-canvas/listing-content";
import { specPageCounts } from "@/lib/fender-canvas/machine-readability";
import {
  headlineSentence,
  headlineSurface,
  type RetailCanvasRead,
} from "@/lib/fender-canvas/portfolio-retail-display";
import { mapPricesNotStored } from "@/lib/fender-canvas/portfolio-retail";
import { mapReadLine } from "@/lib/fender-canvas/retail-copy";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import { brandName, brandSite } from "@/lib/brand-copy";
import { activeClientSettings } from "@/lib/client/active-client";
import { specBlockPhrase } from "@/lib/findability/placeholder-spec-fields";

/** "Amazon, Walmart, and Musician's Friend": Amazon plus the retailers in the client's settings (P-13). */
function mapChannelNames(): string {
  const names = ["Amazon", ...activeClientSettings().retailers.map((retailer) => retailer.name)];
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/* Read per call, never at import (P-13), so a server export reads the request's client. */
export function mapChannelWhy(): string {
  return `Open the MAP Leakage tab for the current below-MAP listings. ${mapChannelNames()} appear only when this read stored a price for that channel. Any other retailer appears only when a stored price exists for that channel.`;
}

export function mapPricesNotStoredWhy(): string {
  return `${brandName()} MAP prices have not been stored. ${mapChannelNames()} prices still show when a price is stored for that channel. A missing price stays blank.`;
}

/** The MAP tab shows this sentence while the reading is unfinished or missing. */
function mapMissingSentence(retail: RetailCanvasRead): string | null {
  if (retail.phase !== "ready") return null;
  const reading = retail.snapshot.mapLeakage;
  const showMissing = reading.status === "incomplete" || reading.status === "unavailable";
  return showMissing ? reading.missingMessage : null;
}

function mapPriority(retail: RetailCanvasRead): { title: string; why: string } {
  if (retail.phase === "ready" && retail.snapshot.mapLeakage.missingMessage === mapPricesNotStored()) {
    return { title: mapPricesNotStored(), why: mapPricesNotStoredWhy() };
  }
  const title = mapReadLine(retail).replace(/\.$/, "");
  return { title, why: mapMissingSentence(retail) ?? mapChannelWhy() };
}

/**
 * Plan items that keep the id Priorities stored their set-asides and owners under, and their
 * default owner, so a saved set-aside still applies.
 */
const KEPT_IDS: Readonly<Record<string, { id: string; owner: PriorityOwner }>> = {
  "finding:buy_box": { id: "buybox-suppression", owner: "intofocus" },
  "finding:map_leakage": { id: "map-leakage", owner: "client" },
};

/** The Priorities id for a plan item (the hub slots and the Briefing read the same ids). */
export function priorityId(planId: string): string {
  return KEPT_IDS[planId]?.id ?? planId;
}

export { inPriorities };

/** The Priorities card's word for each level of the one severity order (priority-rank.ts). */
const PRIORITY_SEVERITY: Record<Severity, PriorityItem["severity"]> = {
  critical: "critical",
  at_risk: "high",
  moderate: "moderate",
  low: "moderate",
};

/**
 * The item's figure line from its one count (priority-rank.ts countFigure), so the card shows the
 * same N as its rank reason. An item with no single count shows its label and its own figure.
 */
export function planFigureLine(item: PlanItem): string {
  if (item.count) return countFigure(item.count);
  const figure = item.ratio ? markPartial(item.ratio, item.partial) : null;
  return figure ? `${item.label}: ${figure}` : item.label;
}

/**
 * One Priorities card from a plan item: the task, why it ranks where it does, and the finding
 * behind it. A grouped item lists its members after its figure.
 */
export function priorityFromPlan(item: PlanItem): PriorityItem {
  const kept = KEPT_IDS[item.id];
  const lead = planFigureLine(item);
  const members = item.members?.length ? `. ${item.members.map((member) => `${member.label} (${member.ratio})`).join("; ")}` : "";
  return {
    id: priorityId(item.id),
    title: item.title,
    why: item.reason,
    impact: `${lead}${members}`,
    severity: PRIORITY_SEVERITY[item.inputs.severity ?? severityOf(item.tone)],
    spokeId: item.open.spokeId,
    subTab: item.open.tab,
    ...(kept ? { defaultOwner: kept.owner } : {}),
  };
}

export const PRIORITIES_DESC = `Every fix in one order: Critical items first, then At risk, then the rest. ${SEVERITY_FLOOR_SENTENCE} Within each, the share of all resolved AI answers or all monitored listings each gap touches, then the monthly analyst estimate, then the smaller effort. Action Items, the Roadmap, the deck, and the map read the same order.`;

/** Priorities lists the first 10 items of the central order (Brian Magazu, 23 Nov 2026 fix round). */
export const PRIORITIES_CAP = 10;

/**
 * Every plan item that needs action, in the central order, as Priorities cards. Its positions
 * are the plan's ranks, so the map cards read their rank from it. Priorities shows the first
 * PRIORITIES_CAP; the deck's fix slide shows the first five with a stored reading.
 */
export function priorityItems(plan: readonly PlanItem[]): PriorityItem[] {
  return plan.filter(inPriorities).map(priorityFromPlan);
}

/**
 * TODAY'S READ opens on central #1 (firstMove), the first card below it: "First move: Publish one
 * fender.com page for each exact product. Listings without an exact official product page: 1,018 of 1,109."
 */
export function firstMoveLine(plan: readonly PlanItem[]): string | null {
  const first = firstMove(plan);
  if (!first) return null;
  return `First move: ${first.title}. ${planFigureLine(first)}.`;
}

/**
 * Command center copy from the canvas reads. With the plan (the one central ranking), the queue is
 * the plan's items that need action, in rank order. Without it (first paint, server tests), the
 * queue falls back to the reads it has. Unsourced counts are omitted.
 */
export function buildLiveCommandCenter(
  bundle: CanvasBundle,
  retail: RetailCanvasRead = { phase: "loading" },
  ai: AiSearchRead = { phase: "loading" },
  plan: readonly PlanItem[] | null = null,
): CommandCenterSpec {
  const schemaPages = specPageCounts(bundle.specPages);
  const bullets = bulletCounts(bundle.listingContent);
  const headline = headlineSurface(retail);
  const mapItem = mapPriority(retail);
  const aiItems = aiPriorityItems(ai);
  const aiCritical = aiItems.filter((item) => item.severity === "critical");
  const aiOther = aiItems.filter((item) => item.severity !== "critical");

  const summaryParts = [headlineSentence(headline)];
  const aiLine = aiCommandSummary(ai);
  if (aiLine) summaryParts.push(aiLine);

  const base = {
    badge: "COMMAND CENTER · TODAY",
    title: "What do I need to worry about?",
    desc: "The highest-value moves across the monitored electric catalog, ranked by what they cost you while they sit open.",
    summary: summaryParts.join(" "),
    openByDefault: true,
    storageKey: clientStorageKey("ifai:fender:command-center"),
    setAsideClientKey: activeSetAsideClientKey(),
  };
  if (isPlanPending(plan)) {
    // A read the ranking needs is still loading: no #1 until every source has landed.
    return { ...base, desc: PRIORITIES_DESC, items: [], loading: true };
  }
  if (plan?.length) {
    // The read leads with the list's first item, then the AI run line.
    const lead = firstMoveLine(plan);
    const summary = [lead ?? emptyPlanLine(plan), aiLine].filter(Boolean).join(" ");
    return { ...base, summary, desc: PRIORITIES_DESC, items: priorityItems(plan).slice(0, PRIORITIES_CAP) };
  }
  return {
    ...base,
    items: [
      {
        id: "buybox-suppression",
        title: headline.countLabel ? `${headline.label}: ${headline.countLabel}` : headline.label,
        why: headline.missingMessage
          ? headline.missingMessage
          : `${headline.label} is the current retail headline${headline.countLabel ? `, with ${headline.countLabel}` : ""}.`,
        severity: "critical",
        spokeId: "ecommerce",
        subTab: headline.commandTab,
        defaultOwner: "intofocus",
      },
      ...aiCritical,
      {
        id: "schema-coverage",
        title: `${brandSite()} pages are missing machine-readable specs`,
        why: schemaPages
          ? `${formatInt(schemaPages.missingSpecBlock)} of ${formatInt(schemaPages.pages)} ${brandSite()} product pages have no spec block, so AI engines cannot read ${specBlockPhrase()} there as product data.`
          : `The ${brandSite()} page read could not be loaded.`,
        severity: "high",
        spokeId: "specs",
        subTab: "Brand-Site Specs",
        defaultOwner: "intofocus",
      },
      {
        id: "map-leakage",
        title: mapItem.title,
        why: mapItem.why,
        impact: "The summary and the listing rows are the rows returned by the latest retail listing read.",
        severity: "high",
        spokeId: "ecommerce",
        subTab: "MAP Leakage",
        defaultOwner: "client",
      },
      ...aiOther,
      {
        id: "aplus-tables",
        title: "Amazon listings are missing bullet copy",
        why: bullets
          ? `${formatInt(bullets.short)} of ${formatInt(bullets.listings)} live Amazon listings fill fewer than five bullets. Bullets are the first copy an AI shopping assistant quotes about a listing.`
          : "The Amazon listing-content read could not be loaded.",
        severity: "moderate",
        spokeId: "specs",
        subTab: "A+",
        defaultOwner: "intofocus",
      },
    ],
  };
}
