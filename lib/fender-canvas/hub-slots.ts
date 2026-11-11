import type { HubSlot, HubSlotChart, HubSlotFeed, HubSlotRole, NodeStatus, PriorityItem } from "@/lib/canvas-sdk/types";
import { strongestCategory } from "@/lib/ai-search/canvas-surfaces";
import { categoryBattles } from "@/lib/ai-search/competitors";
import { pct, summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { categoryLabel } from "@/lib/ai-search/run-metrics";
import { findabilityWidgetCopy, type FindabilityRead } from "@/lib/findability/copy";
import { countFindability } from "@/lib/findability/outcomes";
import { formatInt } from "@/lib/fender-canvas/format";
import type { SuppressionDetail } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailReading } from "@/lib/fender-canvas/portfolio-retail";
import { brandName, brandSite } from "@/lib/brand-copy";

export type SuppressedSlotRead = RetailReading<SuppressionDetail | null> | "loading" | "error";

export type HubSlotInput = {
  suppressed: SuppressedSlotRead;
  ai: AiSearchRead;
  findability: FindabilityRead;
  missingSpecPages: number | null;
  phaseOneValue: string;
  phaseOneDetail: string;
  commandItems: PriorityItem[];
};

const ROLE_LABEL: Record<HubSlotRole, string> = {
  gap: "Performance gap",
  opportunity: "Opportunity",
  action: "Next action",
};

export function hubSlotRoleLabel(role: HubSlotRole): string {
  return ROLE_LABEL[role];
}

function statusWord(tone: NodeStatus): string {
  if (tone === "danger") return "Needs attention";
  if (tone === "warning") return "Watch";
  if (tone === "success") return "Ahead";
  return "Recorded";
}

function share(part: number, total: number, partLabel: string, restLabel: string): HubSlotChart | null {
  if (!Number.isInteger(part) || !Number.isInteger(total)) return null;
  if (total <= 0 || part < 0 || part > total) return null;
  return { part, total, partLabel, restLabel };
}

function slot(input: Omit<HubSlot, "statusWord">): HubSlot {
  return { ...input, statusWord: statusWord(input.tone) };
}

function actionSlot(item: PriorityItem | undefined, figure: string, fallback: HubSlot): HubSlot {
  if (!item) return fallback;
  const tone: NodeStatus =
    item.severity === "critical" ? "danger" : item.severity === "high" ? "warning" : "success";
  return slot({
    role: "action",
    figure,
    label: item.title,
    detail: item.why,
    note: "Opens the evidence for this action.",
    tone,
    chart: null,
    spokeId: item.spokeId ?? fallback.spokeId,
    subTab: item.subTab ?? fallback.subTab,
  });
}

function firstFor(items: PriorityItem[], spokeId: string): PriorityItem | undefined {
  return items.find((item) => item.spokeId === spokeId);
}

function retailPair(reading: SuppressedSlotRead): [HubSlot, HubSlot] {
  const base = {
    spokeId: "ecommerce",
    subTab: "Suppressed Listings",
  };
  if (reading === "loading" || reading === "error") {
    const failed = reading === "error";
    const gap = slot({
      role: "gap",
      figure: failed ? "Unavailable" : "Loading",
      label: "Suppressed listings",
      detail: failed ? "The retail read did not succeed." : "The retail read is still loading.",
      note: "",
      tone: "warning",
      chart: null,
      ...base,
    });
    const opportunity = slot({
      role: "opportunity",
      figure: failed ? "Unavailable" : "Loading",
      label: "Listings outside this gap",
      detail: "The same retail read supplies this count.",
      note: "",
      tone: "neutral",
      chart: null,
      ...base,
    });
    return [gap, opportunity];
  }

  const count = reading.issueCount;
  const population = reading.detail?.population ?? null;
  const label = reading.headlineLabel ?? "Suppressed listings";
  if (count == null) {
    const gap = slot({
      role: "gap",
      figure: "Not stored",
      label,
      detail: reading.missingMessage ?? "This retail read has no suppressed-listing count.",
      note: "Live retail read.",
      tone: "warning",
      chart: null,
      ...base,
    });
    const opportunity = slot({
      role: "opportunity",
      figure: "Not stored",
      label: "Listings outside this gap",
      detail: "The monitored population is not in this read.",
      note: "Live retail read.",
      tone: "neutral",
      chart: null,
      ...base,
    });
    return [gap, opportunity];
  }

  const chart =
    population != null && population >= count
      ? share(count, population, "Suppressed", "Not suppressed")
      : null;
  const outside = chart ? population! - count : null;
  const gap = slot({
    role: "gap",
    figure: formatInt(count),
    label,
    detail: chart
      ? `${formatInt(count)} of ${formatInt(population!)} monitored listings`
      : (reading.missingMessage ?? "The monitored population for this count is not in this read."),
    note: reading.missingMessage ?? "Live retail read.",
    tone: count > 0 ? "danger" : "success",
    chart,
    ...base,
  });
  const opportunity = slot({
    role: "opportunity",
    figure: outside == null ? "Not stored" : formatInt(outside),
    label: "Listings outside this gap",
    detail:
      outside == null
        ? "The monitored population is not in this read."
        : `${formatInt(outside)} of ${formatInt(population!)} monitored listings`,
    note: "Same monitored population as the gap.",
    tone: outside == null ? "neutral" : outside > 0 ? "success" : "warning",
    chart:
      outside == null ? null : share(outside, population!, "Outside the gap", "Inside the gap"),
    ...base,
  });
  return [gap, opportunity];
}

function rateSlot(
  role: HubSlotRole,
  label: string,
  wins: number,
  resolved: number,
  note: string,
  spokeId: string,
  subTab: string,
): HubSlot {
  if (resolved <= 0) {
    return slot({
      role,
      figure: "No resolved answers",
      label,
      detail: "This run has no resolved answers for this question.",
      note,
      tone: "neutral",
      chart: null,
      spokeId,
      subTab,
    });
  }
  const missed = resolved - wins;
  const focus = role === "gap" ? missed : wins;
  const tone: NodeStatus =
    role === "gap"
      ? missed / resolved >= 0.5
        ? "danger"
        : missed > 0
          ? "warning"
          : "success"
      : wins / resolved >= 0.75
        ? "success"
        : "warning";
  return slot({
    role,
    figure: pct(focus, resolved),
    label,
    detail:
      role === "gap"
        ? `${brandName()} led ${wins} of ${resolved} (${pct(wins, resolved)}). This gap is the other ${missed}.`
        : `${brandName()} led ${wins} of ${resolved} resolved answers.`,
    note,
    tone,
    chart: share(
      focus,
      resolved,
      role === "gap" ? `${brandName()} did not lead` : `${brandName()} led`,
      role === "gap" ? `${brandName()} led` : `${brandName()} did not lead`,
    ),
    spokeId,
    subTab,
  });
}

function aiPair(ai: AiSearchRead): [HubSlot, HubSlot] {
  if (ai.phase !== "ready") {
    const [figure, detail] =
      ai.phase === "loading"
        ? ["Loading", "The published AI run is still loading."]
        : ai.phase === "error"
          ? ["Unavailable", "The published AI run did not load."]
          : ["No run", "No AI run has been published."];
    const make = (role: HubSlotRole, label: string): HubSlot =>
      slot({
        role,
        figure,
        label,
        detail,
        note: "Published AI run.",
        tone: "neutral",
        chart: null,
        spokeId: "aeo",
        subTab: "Run Summary",
      });
    return [make("gap", `Unbranded answers ${brandName()} did not lead`), make("opportunity", "Branded consideration")];
  }
  const summary = summarizeRun(ai.snapshot);
  const note = `Published run · ${summary.completedAt}`;
  return [
    rateSlot(
      "gap",
      `Unbranded answers ${brandName()} did not lead`,
      summary.roles.unbranded.fenderWins,
      summary.roles.unbranded.resolved,
      note,
      "aeo",
      "Run Summary",
    ),
    rateSlot(
      "opportunity",
      "Branded consideration",
      summary.roles.branded.fenderWins,
      summary.roles.branded.resolved,
      note,
      "aeo",
      "Run Summary",
    ),
  ];
}

function findabilityPair(read: FindabilityRead): [HubSlot, HubSlot] {
  const base = { spokeId: "specs", subTab: "Findability" };
  if (read.phase !== "ready") {
    const figure = read.phase === "loading" ? "Loading" : "Unavailable";
    const detail =
      read.phase === "loading" ? "Official-page outcomes are loading." : "The official-page read did not load.";
    const make = (role: HubSlotRole, label: string): HubSlot =>
      slot({
        role,
        figure,
        label,
        detail,
        note: "Official-page read.",
        tone: "neutral",
        chart: null,
        ...base,
      });
    return [make("gap", "Listings without an exact official page"), make("opportunity", "Exact official product pages")];
  }
  const counts = countFindability(read.rows);
  if (counts.total === 0) {
    const make = (role: HubSlotRole, label: string): HubSlot =>
      slot({
        role,
        figure: "No listings",
        label,
        detail: "This official-page read has no listings.",
        note: "Official-page read.",
        tone: "neutral",
        chart: null,
        ...base,
      });
    return [make("gap", "Listings without an exact official page"), make("opportunity", "Exact official product pages")];
  }
  const exact = counts.exact_official_product;
  const other = counts.total - exact;
  return [
    slot({
      role: "gap",
      figure: formatInt(other),
      label: "Listings without an exact official page",
      detail: `${formatInt(other)} of ${formatInt(counts.total)} listings in the official-page read`,
      note: "A family page is not an exact product page.",
      tone: other > 0 ? "warning" : "success",
      chart: share(other, counts.total, "Not an exact page", "Exact official page"),
      ...base,
    }),
    slot({
      role: "opportunity",
      figure: formatInt(exact),
      label: "Exact official product pages",
      detail: findabilityWidgetCopy(read).detail,
      note: "Official-page read. A family page is not an exact page.",
      tone: exact > 0 ? "success" : "warning",
      chart: share(exact, counts.total, "Exact official page", "Other outcomes"),
      ...base,
    }),
  ];
}

function competitorPair(ai: AiSearchRead): [HubSlot, HubSlot] {
  const [pendingGap, pendingLead] = aiPair(ai);
  if (ai.phase !== "ready") {
    return [
      { ...pendingGap, spokeId: "competitors", subTab: "Category Battlecards", label: `Category answers ${brandName()} did not lead` },
      { ...pendingLead, spokeId: "competitors", subTab: "Category Battlecards", label: "Strongest category lead" },
    ];
  }
  const summary = summarizeRun(ai.snapshot);
  const note = `Published run · ${summary.completedAt}. Unbranded discovery only.`;
  const battles = categoryBattles(ai.snapshot.calls);
  const gapBattle = summary.largestGap;
  const lead = strongestCategory(battles);
  const gap = gapBattle
    ? rateSlot(
        "gap",
        `${categoryLabel(gapBattle.category)} answers ${brandName()} did not lead`,
        gapBattle.fenderWins,
        gapBattle.resolved,
        note,
        "competitors",
        "Category Battlecards",
      )
    : slot({
        role: "gap",
        figure: "No gap",
        label: `Category answers ${brandName()} did not lead`,
        detail: "No category gap in this run.",
        note,
        tone: "neutral",
        chart: null,
        spokeId: "competitors",
        subTab: "Category Battlecards",
      });
  const opportunity = lead
    ? rateSlot(
        "opportunity",
        `${categoryLabel(lead.category)} lead`,
        lead.fenderWins,
        lead.resolved,
        note,
        "competitors",
        "Category Battlecards",
      )
    : slot({
        role: "opportunity",
        figure: "No resolved answers",
        label: "Strongest category lead",
        detail: "No category in this run has a resolved answer.",
        note,
        tone: "neutral",
        chart: null,
        spokeId: "competitors",
        subTab: "Category Battlecards",
      });
  return [gap, opportunity];
}

function specAction(input: HubSlotInput, fallback: HubSlot): HubSlot {
  const item = firstFor(input.commandItems, "specs");
  const figure = input.missingSpecPages == null ? "Open" : formatInt(input.missingSpecPages);
  const fromQueue = actionSlot(item, figure, fallback);
  return {
    ...fromQueue,
    label: input.missingSpecPages == null ? fromQueue.label : `${brandSite()} pages with no spec block`,
    detail:
      input.missingSpecPages == null
        ? fromQueue.detail
        : `${formatInt(input.missingSpecPages)} ${brandSite()} product pages carry no machine-readable specs.`,
    note: "Opens Brand-Site Specs.",
    chart: null,
    subTab: "Brand-Site Specs",
    spokeId: "specs",
  };
}

/** The AI bubble's action stays on that bubble. A retail queue item never borrows the AI percentage. */
function aiBubbleAction(input: HubSlotInput, aiGap: HubSlot): HubSlot {
  const fallback = slot({
    role: "action",
    figure: "Open",
    label: "Review the published run",
    detail: aiGap.detail,
    note: "Opens Run Summary.",
    tone: aiGap.tone,
    chart: null,
    spokeId: "aeo",
    subTab: "Run Summary",
  });
  const item = firstFor(input.commandItems, "aeo");
  if (item) {
    const confirmed = input.ai.phase === "ready" ? summarizeRun(input.ai.snapshot).drift.totalConfirmed : 0;
    return actionSlot(item, confirmed > 0 ? formatInt(confirmed) : "Open", fallback);
  }
  const missed = aiGap.chart?.part;
  if (missed == null) return fallback;
  return slot({
    role: "action",
    figure: formatInt(missed),
    label: "Unbranded answers to review",
    detail: `${formatInt(missed)} unbranded answers are the gap above.`,
    note: "Opens Run Summary.",
    tone: aiGap.tone,
    chart: null,
    spokeId: "aeo",
    subTab: "Run Summary",
  });
}

function estimateOpportunity(input: HubSlotInput): HubSlot {
  return slot({
    role: "opportunity",
    figure: input.phaseOneValue,
    label: "Recoverable Revenue",
    detail: input.phaseOneDetail,
    note: "Analyst estimate.",
    tone: "success",
    chart: null,
    spokeId: "suggestions",
    subTab: "Revenue Estimates",
  });
}

function exampleGap(): HubSlot {
  return slot({
    role: "gap",
    figure: "Example",
    label: "No live gap on this bubble",
    detail: "Strategy Roadmap is a visual example until a live plan is stored.",
    note: "Not a live reading.",
    tone: "neutral",
    chart: null,
    spokeId: "roadmap",
    subTab: "30-60-90 Day Milestones",
  });
}

function feed(bubbleId: string, title: string, slots: [HubSlot, HubSlot, HubSlot]): HubSlotFeed {
  return { bubbleId, title, slots };
}

/** Three slots for each main bubble. Every chart part is a stored count, and the two parts add up to the total. */
export function buildHubSlots(input: HubSlotInput): Record<string, HubSlotFeed> {
  const [retailGap, retailOutside] = retailPair(input.suppressed);
  const [aiGap, aiLead] = aiPair(input.ai);
  const [pagesGap, exactPages] = findabilityPair(input.findability);
  const [categoryGap, categoryLead] = competitorPair(input.ai);
  const openAction = slot({
    role: "action",
    figure: "Open",
    label: "No priority is stored for this bubble",
    detail: "Action Items still lists the current queue.",
    note: "Opens Action Items.",
    tone: "neutral",
    chart: null,
    spokeId: "suggestions",
    subTab: "Urgent Interventions",
  });
  const retailAction = actionSlot(firstFor(input.commandItems, "ecommerce") ?? input.commandItems[0], retailGap.figure, openAction);
  const aiAction = aiBubbleAction(input, aiGap);
  const radarAction = actionSlot(firstFor(input.commandItems, "competitors"), "Open", {
    ...openAction,
    spokeId: "competitors",
    subTab: "Category Battlecards",
    label: "Open Category Battlecards",
    detail: "Unbranded discovery only.",
  });
  const queueAction = actionSlot(input.commandItems[0], "Open", openAction);
  const secondAction = actionSlot(input.commandItems[1], "Next", queueAction);
  const roadmapAction = actionSlot(undefined, "Open", {
    ...openAction,
    spokeId: "roadmap",
    subTab: "30-60-90 Day Milestones",
    label: "30-60-90 Day Milestones",
    detail: "The phases are a plan, not a measured result.",
    note: "Not a live reading.",
  });

  return {
    hub: feed("hub", "Summary", [retailGap, aiLead, queueAction]),
    "spoke-retail": feed("spoke-retail", "Catalog Health", [retailGap, retailOutside, retailAction]),
    "spoke-aeo": feed("spoke-aeo", "AI Search Visibility", [aiGap, aiLead, aiAction]),
    "spoke-specs": feed("spoke-specs", "AI Readiness", [pagesGap, exactPages, specAction(input, openAction)]),
    "spoke-competitors": feed("spoke-competitors", "Competitive Radar", [categoryGap, categoryLead, radarAction]),
    "spoke-fixes": feed("spoke-fixes", "Action Items", [
      {
        ...queueAction,
        role: "gap",
        note: "Dollar figures are analyst estimates.",
      },
      estimateOpportunity(input),
      secondAction,
    ]),
    "spoke-roadmap": feed("spoke-roadmap", "Strategy Roadmap", [
      exampleGap(),
      slot({
        role: "opportunity",
        figure: "3 phases",
        label: "90-day plan",
        detail: "MAP, catalog nesting, and estimated lift.",
        note: "The phases are a plan, not a measured result.",
        tone: "neutral",
        chart: null,
        spokeId: "roadmap",
        subTab: "30-60-90 Day Milestones",
      }),
      { ...roadmapAction, role: "action" },
    ]),
  };
}
