/**
 * The action slot reads the Priorities items (command center). Priorities lists critical
 * items first, then high, then moderate, so the first item that opens a bubble is its
 * highest-priority action. The figure is the stored count behind that item.
 */

import { summarizeRun } from "@/lib/ai-search/summary";
import type { HubEvidenceSlot } from "@/lib/canvas-sdk/hub-slot-types";
import type { NodeStatus, PriorityItem } from "@/lib/canvas-sdk/types";
import { formatInt } from "@/lib/fender-canvas/format";
import type { CheckBook, CheckId, SlotCheck, SlotReads } from "@/lib/fender-canvas/hub-slot-checks";
import {
  checkChart,
  countLine,
  evidenceSlot,
  lastCheckedLine,
  loadingSlot,
  NO_TARGET_SET,
  notAvailableLine,
  targetLine,
} from "@/lib/fender-canvas/hub-slot-format";
import { selectRetailHeadline } from "@/lib/fender-canvas/portfolio-retail";

const SEVERITY: Record<PriorityItem["severity"], { tone: NodeStatus; word: string }> = {
  critical: { tone: "danger", word: "Critical" },
  high: { tone: "warning", word: "High" },
  moderate: { tone: "neutral", word: "Moderate" },
};

const ITEM_CHECK: Record<string, CheckId> = {
  "schema-coverage": "machine_readable",
  "map-leakage": "map_violation",
  "aplus-tables": "five_bullets",
};

type ActionCount = { check: SlotCheck | null; pending: boolean };

function headlineCount(book: CheckBook, reads: SlotReads): ActionCount {
  const retail = reads.retail ?? { phase: "loading" as const };
  if (retail.phase === "loading") return { check: null, pending: true };
  if (retail.phase !== "ready") return { check: null, pending: false };
  const headline = selectRetailHeadline(retail.snapshot);
  if (headline?.findingId === "map_leakage") return { check: book.checks.map_violation ?? null, pending: false };
  if (headline?.findingId === "unnested_bundles") return { check: book.checks.splintered ?? null, pending: false };
  const reading = retail.snapshot.suppressedListings;
  const counts = reading.detail?.counts;
  const withheld = book.checks.buy_box_withheld;
  if (!withheld || !counts || reading.issueCount == null || reading.issueCount > counts.current) {
    return { check: withheld ?? null, pending: false };
  }
  const label = reading.headlineLabel ?? withheld.label;
  return {
    check: { ...withheld, failing: reading.issueCount, label, failLabel: label, passLabel: "Rest of current readings" },
    pending: false,
  };
}

function contradictionCount(reads: SlotReads): ActionCount {
  if (reads.ai.phase === "loading") return { check: null, pending: true };
  if (reads.ai.phase !== "ready") return { check: null, pending: false };
  const drift = summarizeRun(reads.ai.snapshot).drift;
  if (!(drift.totalChecked > 0) || drift.totalConfirmed > drift.totalChecked) return { check: null, pending: false };
  return {
    check: {
      id: "contradictions",
      label: "Answers that contradict a verified fact",
      failing: drift.totalConfirmed,
      total: drift.totalChecked,
      population: "answers checked against a verified fact",
      failLabel: "Contradicts",
      passLabel: "No contradiction",
      target: null,
      checkedAt: [reads.ai.snapshot.run.completed_at],
      source: "The published AI run",
      spokeId: "aeo",
      subTab: "Product Fact Checks",
      note: "",
    },
    pending: false,
  };
}

function competitorGapCount(book: CheckBook, reads: SlotReads): ActionCount {
  if (book.categoriesPending) return { check: null, pending: true };
  if (reads.ai.phase !== "ready") return { check: null, pending: false };
  const gap = summarizeRun(reads.ai.snapshot).largestGap;
  return { check: book.categories.find((check) => check.category === gap?.category) ?? null, pending: false };
}

function actionCount(item: PriorityItem, book: CheckBook, reads: SlotReads): ActionCount {
  if (item.id === "buybox-suppression") return headlineCount(book, reads);
  if (item.id === "ai-confirmed-contradiction") return contradictionCount(reads);
  if (item.id === "ai-competitor-gap") return competitorGapCount(book, reads);
  const id = ITEM_CHECK[item.id];
  if (!id) return { check: null, pending: false };
  return { check: book.checks[id] ?? null, pending: book.pending.has(id) };
}

/** Priorities can name a short tab, such as A+. The link names the full tab when the check lives there. */
function itemTab(item: PriorityItem, check: SlotCheck | null): { spokeId: string; subTab: string } {
  const spokeId = item.spokeId ?? "suggestions";
  const subTab = item.subTab ?? "Urgent Interventions";
  if (check && check.spokeId === spokeId && check.subTab.toLowerCase().includes(subTab.toLowerCase())) {
    return { spokeId, subTab: check.subTab };
  }
  return { spokeId, subTab };
}

export type ActionScope = {
  /** Spoke id the item must open. Omit for the first item overall. */
  spokeId?: string;
  bubble: string;
  /** Check times shown when no item opens this bubble. */
  fallbackTimes: Array<string | null | undefined>;
};

export function pickAction(items: PriorityItem[], book: CheckBook, reads: SlotReads, scope: ActionScope): HubEvidenceSlot {
  const item = scope.spokeId ? items.find((row) => row.spokeId === scope.spokeId) : items[0];
  const order = "Priorities lists critical items first, then high, then moderate.";
  if (!item) {
    const rule = scope.spokeId
      ? `No Priorities item opens ${scope.bubble} today, so this slot opens the full action list.`
      : "Priorities has no item today, so this slot opens the full action list.";
    return evidenceSlot({
      role: "action",
      rule,
      figure: "None",
      label: scope.spokeId ? `No priority opens ${scope.bubble}` : "No priority is stored",
      note: "",
      tone: "neutral",
      statusWord: "None open",
      chart: items.length > 0
        ? { part: 0, total: items.length, partLabel: `open ${scope.bubble}`, restLabel: "open other areas" }
        : null,
      target: { text: NO_TARGET_SET },
      countedOutOf: { text: `0 of ${formatInt(items.length)} open priorities` },
      lastChecked: lastCheckedLine(scope.fallbackTimes, `${scope.bubble} reads`),
      spokeId: "suggestions",
      subTab: "Urgent Interventions",
    });
  }

  const rule = scope.spokeId
    ? `This is the first Priorities item that opens ${scope.bubble}. ${order}`
    : `This is the first item in Priorities. ${order}`;
  const { check, pending } = actionCount(item, book, reads);
  const link = itemTab(item, check);
  if (pending) return loadingSlot("action", item.title, rule, link.spokeId, link.subTab);
  const severity = SEVERITY[item.severity];
  const missing = "This priority has no stored count to show here.";
  return evidenceSlot({
    role: "action",
    rule,
    figure: check ? formatInt(check.failing) : "Open",
    label: item.title,
    note: check?.note ?? "",
    noteDefinition: check?.noteDefinition,
    tone: severity.tone,
    statusWord: severity.word,
    chart: check ? checkChart(check) : null,
    target: targetLine(check?.target ?? null),
    countedOutOf: check ? countLine(check.failing, check.total, check.population) : notAvailableLine("", missing),
    lastChecked: check ? lastCheckedLine(check.checkedAt, check.source) : notAvailableLine("Last checked", missing),
    spokeId: link.spokeId,
    subTab: link.subTab,
  });
}
