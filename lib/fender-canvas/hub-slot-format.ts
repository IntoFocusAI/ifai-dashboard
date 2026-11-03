/**
 * Shared wording for the hover slots: target, N of M, Last checked, and status words.
 * Every slot line comes from a stored count or a stored time. Missing reads Not available*.
 */

import type { HubEvidenceSlot, HubSlotLine } from "@/lib/canvas-sdk/hub-slot-types";
import type { HubSlotChart, HubSlotRole, NodeStatus } from "@/lib/canvas-sdk/types";
import { formatInt } from "@/lib/fender-canvas/format";
import type { CheckTarget, SlotCheck } from "@/lib/fender-canvas/hub-slot-checks";
import { LAST_CHECKED_UNAVAILABLE_LABEL } from "@/lib/findability/last-checked";

export const NOT_AVAILABLE = LAST_CHECKED_UNAVAILABLE_LABEL;
export const NO_TARGET_SET = "No target set";
export const LOADING = "Loading";

export const HUB_SLOT_ROLE_LABEL: Record<HubSlotRole, string> = {
  gap: "Largest gap",
  opportunity: "Largest opportunity",
  action: "Top action",
};

const BAND_WORD: Record<Exclude<NodeStatus, "neutral">, string> = {
  danger: "Needs attention",
  warning: "Watch",
  success: "On target",
};

export function bandWord(tone: Exclude<NodeStatus, "neutral">): string {
  return BAND_WORD[tone];
}

const checkedDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function newestTime(times: ReadonlyArray<string | null | undefined>): Date | null {
  let newest: Date | null = null;
  for (const raw of times) {
    if (!raw) continue;
    const at = new Date(raw);
    if (!Number.isFinite(at.getTime())) continue;
    if (!newest || at > newest) newest = at;
  }
  return newest;
}

export function notAvailableLine(prefix: string, definition: string): HubSlotLine {
  return {
    text: prefix ? `${prefix} ${NOT_AVAILABLE}` : NOT_AVAILABLE,
    term: NOT_AVAILABLE,
    definition,
  };
}

/** Newest stored check time, as a UTC date. */
export function lastCheckedLine(times: ReadonlyArray<string | null | undefined>, source: string): HubSlotLine {
  const newest = newestTime(times);
  if (!newest) return notAvailableLine("Last checked", `${source} has no stored check time.`);
  return { text: `Last checked ${checkedDate.format(newest)}` };
}

export function targetLine(target: CheckTarget | null): HubSlotLine {
  if (!target) return { text: NO_TARGET_SET };
  return { text: `Target: ${target.text} (now ${target.now})` };
}

export function countLine(failing: number, total: number, population: string, suffix = ""): HubSlotLine {
  return { text: `${formatInt(failing)} of ${formatInt(total)} ${population}${suffix}` };
}

export function checkChart(check: Pick<SlotCheck, "failing" | "total" | "failLabel" | "passLabel">): HubSlotChart {
  return { part: check.failing, total: check.total, partLabel: check.failLabel, restLabel: check.passLabel };
}

/** Share falling short, as a percentage with one decimal. */
export function shortShare(check: Pick<SlotCheck, "failing" | "total">): number {
  return (100 * check.failing) / check.total;
}

export function percentFigure(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Whole numbers drop the decimal: 35%, 41.7%. */
export function weightFigure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function evidenceLabel(subTab: string | undefined): string {
  return subTab ? `Open ${subTab}` : "Open the evidence";
}

type SlotFields = Omit<HubEvidenceSlot, "roleLabel" | "detail" | "evidenceLabel"> & {
  evidenceLabel?: string;
};

/** Legacy `detail` repeats the N of M line for any reader that still shows it. */
export function evidenceSlot(fields: SlotFields): HubEvidenceSlot {
  return {
    ...fields,
    roleLabel: HUB_SLOT_ROLE_LABEL[fields.role],
    detail: fields.countedOutOf.text,
    evidenceLabel: fields.evidenceLabel ?? evidenceLabel(fields.subTab),
  };
}

/** A slot whose reads are still loading. */
export function loadingSlot(role: HubSlotRole, label: string, rule: string, spokeId: string, subTab: string): HubEvidenceSlot {
  const line = { text: LOADING };
  return evidenceSlot({
    role,
    rule,
    figure: LOADING,
    label,
    note: "",
    tone: "neutral",
    statusWord: LOADING,
    chart: null,
    target: line,
    countedOutOf: line,
    lastChecked: line,
    spokeId,
    subTab,
  });
}

/** A slot with no stored population. Never a zero. */
export function unavailableSlot(
  role: HubSlotRole,
  label: string,
  rule: string,
  reason: string,
  spokeId: string,
  subTab: string,
): HubEvidenceSlot {
  return evidenceSlot({
    role,
    rule,
    figure: NOT_AVAILABLE,
    figureDefinition: reason,
    label,
    note: "",
    tone: "neutral",
    statusWord: "Not stored",
    chart: null,
    target: { text: NO_TARGET_SET },
    countedOutOf: notAvailableLine("", reason),
    lastChecked: notAvailableLine("Last checked", reason),
    spokeId,
    subTab,
  });
}
