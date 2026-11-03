import type { HubSlot, HubSlotFeed } from "@/lib/canvas-sdk/types";

/** One short line on a slot. A definition puts `term` (or the whole line) behind a custom tooltip. */
export type HubSlotLine = {
  text: string;
  /** The part of `text` that carries the definition. Defaults to all of `text`. */
  term?: string;
  definition?: string;
};

/**
 * A hub slot that carries its evidence trail: the rule that picked it, its target,
 * what it was counted out of, when it was last checked, and the tab that holds the rows.
 */
export type HubEvidenceSlot = HubSlot & {
  /** Visible role name. The rule is its definition tooltip. */
  roleLabel: string;
  /** One plain sentence: why this is the largest gap, the largest opportunity, or the top action. */
  rule: string;
  /** Definition behind the figure, such as a Not available* reason. */
  figureDefinition?: string;
  target: HubSlotLine;
  countedOutOf: HubSlotLine;
  lastChecked: HubSlotLine;
  /** Definition behind `note`, such as a placeholder list. */
  noteDefinition?: string;
  /** Visible text of the link that opens `spokeId` / `subTab`. */
  evidenceLabel: string;
};

export type HubEvidenceFeed = Omit<HubSlotFeed, "slots"> & {
  slots: [HubEvidenceSlot, HubEvidenceSlot, HubEvidenceSlot];
};

export function isHubEvidenceSlot(slot: HubSlot): slot is HubEvidenceSlot {
  const candidate = slot as Partial<HubEvidenceSlot>;
  return typeof candidate.rule === "string" && typeof candidate.roleLabel === "string";
}
