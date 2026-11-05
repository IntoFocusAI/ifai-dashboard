/**
 * Story pack for /dashboard/deck.
 * Composes the Summary Briefing lead, the published AI Search run, and the
 * date-pill name of the window the dashboard is showing. It does not read the
 * database itself, and it does not choose a different run for the map.
 */

import { aiSpokeDesc } from "@/lib/ai-search/canvas-surfaces";
import { utcDay } from "@/lib/ai-search/history-eligibility";
import { DEFAULT_HISTORY_MODE, historyControlLabel } from "@/lib/ai-search/history-mode";
import { ROLE_LABELS } from "@/lib/ai-search/question-role";
import {
  BRANDED_RATE_BANDS,
  leadRateTip,
  roleRateLead,
  summarizeRun,
  UNBRANDED_RATE_BANDS,
} from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import {
  briefingFindingsLead,
  type BriefingFinding,
  type BriefingFindingId,
} from "@/lib/fender-canvas/briefing-retail-lead";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatRatio, sanitizeUiText } from "@/lib/fender-canvas/format";
import { headlineSurface, type RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { findabilityWidgetCopy, type FindabilityRead } from "@/lib/findability/copy";
import type { RoleTally } from "@/lib/ai-search/question-role";

export const STORY_DECK_PATH = "/dashboard/deck";

export const DECK_PAGE = {
  title: "Story pack",
  lead: "The Summary Briefing for the window on the dashboard, and the published AI Search run.",
  backLabel: "Back to dashboard",
  windowHeading: "Window",
  findingsHeading: "Summary Briefing",
  publishedHeading: "Published run",
} as const;

/** Same empty figure Run Details shows when a lead rate has no resolved answers. */
export const NO_RESOLVED_ANSWERS = "No resolved answers";

export const DECK_LOADING = aiSpokeDesc({ phase: "loading" });

export type StoryDeckRate = {
  id: "unbranded_discovery" | "branded_consideration";
  label: string;
  percent: string;
  ratio: string | null;
  tip: string | null;
  color: string | null;
};

export type StoryDeckFinding = {
  id: BriefingFindingId;
  label: string;
  /** Null while that finding's read is still loading. */
  percent: string | null;
  ratio: string | null;
  color: string | null;
  /** Briefing label tooltip. */
  explainer: string;
  /** Loading sentence, or the failure sentence on a Not available* figure. */
  note: string | null;
};

export type StoryDeckPublished =
  | { phase: "loading" | "error" | "no-run"; copy: string }
  | { phase: "ready"; runId: string; unbranded: StoryDeckRate; branded: StoryDeckRate };

export type StoryDeck = {
  findings: StoryDeckFinding[];
  published: StoryDeckPublished;
  /** The date pill's name for this window. Not a second period control. */
  windowLabel: string;
};

export type StoryDeckInput = {
  retail: RetailCanvasRead;
  findability: FindabilityRead;
  /** The published run the map stays on. */
  published: AiSearchRead;
  /** The AI Search read Summary Briefing uses for this window. */
  briefingAi: AiSearchRead;
  /** historyControlLabel for the dashboard's date pill. */
  windowLabel: string;
};

/**
 * The name the dashboard date pill uses on open: last 30 days ending on the
 * published run's day. Same function as the pill (`historyControlLabel`).
 */
export function dashboardWindowLabel(published: AiSearchRead): string {
  const run = published.phase === "ready" ? published.snapshot.run : null;
  return historyControlLabel(
    DEFAULT_HISTORY_MODE,
    run ? utcDay(run.published_at ?? run.completed_at) : null,
    null,
    run?.audit_run_id ?? null,
  );
}

function clean(value: string): string {
  return sanitizeUiText(value);
}

function sourcePhase(phase: string): "loading" | "failed" | "ready" {
  if (phase === "loading") return "loading";
  if (phase === "ready") return "ready";
  return "failed";
}

function phaseFor(
  id: BriefingFindingId,
  input: StoryDeckInput,
): "loading" | "failed" | "ready" {
  if (id === "exact_official_product") return sourcePhase(input.findability.phase);
  if (id === "unbranded_discovery") return sourcePhase(input.briefingAi.phase);
  return sourcePhase(input.retail.phase);
}

function loadingNote(id: BriefingFindingId): string {
  if (id === "exact_official_product") return findabilityWidgetCopy({ phase: "loading" }).detail;
  if (id === "unbranded_discovery") return aiSpokeDesc({ phase: "loading" });
  return headlineSurface({ phase: "loading" }).missingMessage ?? DECK_LOADING;
}

function failureNote(id: BriefingFindingId, input: StoryDeckInput): string {
  if (id === "exact_official_product") return findabilityWidgetCopy(input.findability).detail;
  if (id === "unbranded_discovery") return aiSpokeDesc(input.briefingAi);
  return headlineSurface(input.retail).missingMessage ?? READ_NOT_AVAILABLE;
}

function toFinding(finding: BriefingFinding, input: StoryDeckInput): StoryDeckFinding {
  const phase = phaseFor(finding.id, input);
  const loading = phase === "loading";
  const failed = phase === "failed";
  return {
    id: finding.id,
    label: finding.label,
    percent: loading ? null : finding.percent,
    ratio: loading || failed ? null : finding.ratio,
    color: loading ? null : finding.color,
    explainer: clean(finding.explainer),
    note: loading ? clean(loadingNote(finding.id)) : failed ? clean(failureNote(finding.id, input)) : null,
  };
}

function rateFor(
  id: StoryDeckRate["id"],
  tally: RoleTally,
  bands: { redBelow: number; greenAbove: number },
): StoryDeckRate {
  const label = ROLE_LABELS[id];
  const lead = roleRateLead(tally, bands);
  if (lead.rate == null || lead.color == null) {
    return { id, label, percent: NO_RESOLVED_ANSWERS, ratio: null, tip: null, color: null };
  }
  return {
    id,
    label,
    percent: lead.rate,
    ratio: formatRatio(tally.fenderWins, tally.resolved),
    tip: leadRateTip(tally),
    color: lead.color,
  };
}

function publishedSection(published: AiSearchRead): StoryDeckPublished {
  if (published.phase !== "ready") {
    return { phase: published.phase, copy: clean(aiSpokeDesc(published)) };
  }
  const summary = summarizeRun(published.snapshot);
  return {
    phase: "ready",
    runId: published.snapshot.run.audit_run_id,
    unbranded: rateFor("unbranded_discovery", summary.roles.unbranded, UNBRANDED_RATE_BANDS),
    branded: rateFor("branded_consideration", summary.roles.branded, BRANDED_RATE_BANDS),
  };
}

/** Five briefing findings, the published run, and the date-pill window name. */
export function storyDeck(input: StoryDeckInput): StoryDeck {
  const lead = briefingFindingsLead(input.retail, input.findability, input.briefingAi);
  return {
    findings: lead.findings.map((finding) => toFinding(finding, input)),
    published: publishedSection(input.published),
    windowLabel: clean(input.windowLabel),
  };
}
