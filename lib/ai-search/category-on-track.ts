import { headlineCompetitorWins, type RoleGroupTally } from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel, isCommercial, isError } from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";
import { brandName, leadBrand, leadBrandOr } from "@/lib/brand-copy";
import { PARTIAL_TITLE, partialFigureTip } from "@/lib/fender-canvas/canvas-reads";

/** Who leads one category on unbranded discovery. */
export type CategoryLeadStatus = "on_track" | "tied" | "behind" | "not_available";

export type CategoryLead = {
  key: string;
  label: string;
  status: CategoryLeadStatus;
  /** Resolved unbranded discovery answers in this category. Both lead counts use it as the denominator. */
  resolved: number;
  fenderLeads: number;
  otherLeads: number;
  /** Fender/Squier named most with a confirmed product error. Counted in `resolved`, in neither lead. */
  disqualified: number;
  topRival: { brand: string; wins: number } | null;
  /** Unbranded discovery questions sent in this category, answered or not. */
  asked: number;
};

export const LEAD_STATUS_LABELS: Record<CategoryLeadStatus, string> = {
  on_track: "On track",
  tied: "Tied",
  behind: "Behind",
  not_available: "Not available*",
};

const LEAD_STATUS_DEFINITIONS: Record<Exclude<CategoryLeadStatus, "not_available">, string> = {
  on_track:
    `${leadBrandOr()} was named most in more of this category's resolved unbranded discovery answers than any single other brand.`,
  tied: `${leadBrand()} and the top other brand were each named most in the same number of this category's resolved unbranded discovery answers.`,
  behind:
    `One other brand was named most in more of this category's resolved unbranded discovery answers than ${leadBrandOr()}.`,
};

export function leadStatusDefinition(lead: Pick<CategoryLead, "status" | "asked">): string {
  if (lead.status !== "not_available") return LEAD_STATUS_DEFINITIONS[lead.status];
  if (lead.asked <= 0) {
    return "This category has no unbranded discovery questions, so no brand leads it on that measure. The table below shows its branded consideration rate.";
  }
  return "No unbranded discovery answer in this category had a clear leader, so no brand leads it on that measure.";
}

/** Fender/Squier against the single brand named most, not against every other brand together. */
export function categoryLeadStatus(tally: {
  resolved: number;
  fenderWins: number;
  topRivalWins: number;
}): CategoryLeadStatus {
  if (tally.resolved <= 0) return "not_available";
  if (tally.fenderWins > tally.topRivalWins) return "on_track";
  if (tally.fenderWins === tally.topRivalWins) return "tied";
  return "behind";
}

const STATUS_ORDER: Record<CategoryLeadStatus, number> = { behind: 0, tied: 1, on_track: 2, not_available: 3 };

function fenderShare(lead: CategoryLead): number {
  return lead.resolved > 0 ? lead.fenderLeads / lead.resolved : 1;
}

/** One lead per category, behind first, then the weakest Fender/Squier share. Same tallies as the table. */
export function categoryLeads(groups: readonly RoleGroupTally[], calls: readonly AiCallRow[]): CategoryLead[] {
  return groups
    .map((group) => {
      const unbranded = group.roles.unbranded_discovery;
      const rivals = headlineCompetitorWins(calls.filter((row) => (row.category ?? "") === group.key));
      return {
        key: group.key,
        label: categoryLabel(group.key),
        status: categoryLeadStatus({ ...unbranded, topRivalWins: rivals[0]?.wins ?? 0 }),
        resolved: unbranded.resolved,
        fenderLeads: unbranded.fenderWins,
        otherLeads: unbranded.competitorWins,
        disqualified: unbranded.disqualified,
        topRival: rivals[0] ?? null,
        asked: unbranded.calls,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || fenderShare(a) - fenderShare(b) || a.key.localeCompare(b.key),
    );
}

export const ON_TRACK_DEFINITION =
  `A category is on track when ${leadBrandOr()} is named most in more of its resolved unbranded discovery answers than any single other brand. Level with the top other brand reads Tied. Branded consideration is not part of this test. The pie counts every category, including any the Who leads chip hides.`;

/** The two hero rates ignore the Who leads chip, like the on-track pie. */
export const HERO_RATES_NOTE = "These count every category, including any the Who leads chip hides.";

/** Battlecard table caveats. They sit in each column header's tooltip, not on screen. */
export const BATTLE_COLUMN_NOTES = {
  competitor:
    "The other brand named most in the most of this category's resolved unbranded discovery answers, and how many it led. Branded consideration and the questions listed under the table are not counted.",
  leads:
    "Resolved unbranded discovery answers in this category where another brand was named most. Branded consideration and the questions listed under the table are not counted.",
  leader:
    `Unbranded discovery and branded consideration answers in this category where no brand was named most. They stay out of both ${brandName()}-lead rates.`,
  errors:
    `Unbranded discovery and branded consideration calls in this category where the AI engine returned no answer. They stay out of both ${brandName()}-lead rates.`,
} as const;

export type CategoryLeadSummary = {
  /** Categories with at least one resolved unbranded discovery answer. */
  measured: number;
  onTrack: number;
  /** Labels in display order. */
  tied: string[];
  behind: string[];
  /** "Taylor leads Acoustics", one per Behind category in display order, as the map words it. */
  rivalsLead: string[];
};

/** "Taylor leads Acoustics": the map bubble's wording for a category another brand leads (decision 5). */
export function rivalLeadsCategory(brand: string, category: string): string {
  return `${brand} leads ${categoryLabel(category)}`;
}

/**
 * Who leads one category, in the map bubble's wording: "Taylor leads Acoustics" when another
 * brand leads, "Fender/Squier leads Electrics" when the brand does, and the caption's
 * "Tied in Acoustics" on a tie. Null when the category has no resolved answer.
 */
export function categoryLeaderLabel(lead: Pick<CategoryLead, "key" | "label" | "status" | "topRival">): string | null {
  if (lead.status === "behind") return lead.topRival ? rivalLeadsCategory(lead.topRival.brand, lead.key) : null;
  if (lead.status === "on_track") return rivalLeadsCategory(leadBrand(), lead.key);
  if (lead.status === "tied") return `Tied in ${lead.label}`;
  return null;
}

export function categoryLeadSummary(leads: readonly CategoryLead[]): CategoryLeadSummary {
  const labels = (status: CategoryLeadStatus) => leads.filter((lead) => lead.status === status).map((lead) => lead.label);
  return {
    measured: leads.filter((lead) => lead.status !== "not_available").length,
    onTrack: labels("on_track").length,
    tied: labels("tied"),
    behind: labels("behind"),
    rivalsLead: leads.flatMap((lead) =>
      lead.status === "behind" && lead.topRival ? [rivalLeadsCategory(lead.topRival.brand, lead.key)] : [],
    ),
  };
}

/** Other brands' leads outside the top rival. */
export function restLeads(lead: Pick<CategoryLead, "otherLeads" | "topRival">): number {
  return lead.otherLeads - (lead.topRival?.wins ?? 0);
}

/** One plain sentence per category. Every count shares the resolved denominator. */
export function leadSentence(lead: CategoryLead): string {
  if (lead.status === "not_available") {
    return lead.asked > 0
      ? "No unbranded discovery answer in this category had a clear leader."
      : "No unbranded discovery questions in this category.";
  }
  const rival = lead.topRival;
  const rest = restLeads(lead);
  const rivalPart = rival ? ` ${rival.brand}, the top rival, leads ${rival.wins}.` : " No other brand leads any.";
  const restPart = rival && rest > 0 ? ` Other brands lead ${rest}.` : "";
  const flagged =
    lead.disqualified > 0 ? ` ${lead.disqualified} more named ${leadBrand()} most with a confirmed product error.` : "";
  return `${leadBrand()} leads ${lead.fenderLeads} of ${lead.resolved} resolved answers.${rivalPart}${restPart}${flagged}`;
}

/** Same shape CitationPieDisc draws. Slice keys pick the shared slice colors. */
export type LeadPie = {
  id: string;
  title: string;
  total: number;
  totalLabel: string;
  slices: Array<{ key: string; label: string; count: number }>;
};

function pie(id: string, title: string, total: number, totalLabel: string, slices: LeadPie["slices"]): LeadPie {
  return { id, title, total, totalLabel, slices: slices.filter((slice) => slice.count > 0) };
}

/** On track, tied, and behind out of the categories with a resolved unbranded discovery answer. */
export function onTrackPie(summary: CategoryLeadSummary): LeadPie | null {
  if (summary.measured <= 0) return null;
  return pie("category-on-track", "Categories on track", summary.measured, "categories with resolved answers", [
    { key: "fender", label: "On track", count: summary.onTrack },
    { key: "community", label: "Tied", count: summary.tied.length },
    { key: "competitor_brand", label: "Behind", count: summary.behind.length },
  ]);
}

/** Fender/Squier, the top rival, and every other brand, out of the category's resolved unbranded answers. */
export function categoryLeadPie(lead: CategoryLead): LeadPie | null {
  if (lead.status === "not_available" || lead.resolved <= 0) return null;
  return pie(`category-${lead.key}`, lead.label, lead.resolved, "resolved unbranded discovery answers", [
    { key: "fender", label: `${leadBrand()} leads`, count: lead.fenderLeads },
    { key: "competitor_brand", label: lead.topRival ? `${lead.topRival.brand} leads` : "Top rival leads", count: lead.topRival?.wins ?? 0 },
    { key: "other", label: "Other brands lead", count: restLeads(lead) },
    { key: "none", label: `${leadBrand()} with a confirmed product error`, count: lead.disqualified },
  ]);
}

export type LeadFilter = "all" | "fender" | "other";

export type BattlecardFilter = { engine: string; lead: LeadFilter };

export const NO_BATTLECARD_FILTER: BattlecardFilter = { engine: "", lead: "all" };

export const LEAD_FILTER_LABELS: Record<LeadFilter, string> = {
  all: "All categories",
  fender: `${leadBrand()} leads`,
  other: "Another brand leads",
};

/** Engines with at least one answered shopping call. An engine that failed every call is not a result. */
export function battlecardEngines(calls: readonly AiCallRow[]): string[] {
  const engines = new Set<string>();
  for (const row of calls) {
    if (isCommercial(row) && !isError(row)) engines.add((row.engine ?? "").toLowerCase());
  }
  return [...engines].sort((a, b) => engineLabel(a).localeCompare(engineLabel(b)));
}

/** An engine the period no longer has falls back to every engine, so a stale chip never hides every card. */
export function effectiveBattlecardFilter(filter: BattlecardFilter, engines: readonly string[]): BattlecardFilter {
  return engines.includes(filter.engine) ? filter : { ...filter, engine: "" };
}

export function callsForEngine(calls: readonly AiCallRow[], engine: string): AiCallRow[] {
  return engine ? calls.filter((row) => (row.engine ?? "").toLowerCase() === engine) : [...calls];
}

export function leadMatches(status: CategoryLeadStatus, lead: LeadFilter): boolean {
  if (lead === "fender") return status === "on_track";
  if (lead === "other") return status === "behind";
  return true;
}

export function isBattlecardFiltered(filter: BattlecardFilter): boolean {
  return filter.engine !== "" || filter.lead !== "all";
}

/** Title of the asterisk an engine chip puts on each figure it narrows (X-25). */
export const ENGINE_MARK_TITLE = PARTIAL_TITLE.filtered;

/** Tooltip on that asterisk, from the shared partial-figure helper: what is left out, the source, the effect. */
export function engineOnlyNote(engineName: string): string {
  return partialFigureTip({
    reason: "filtered",
    missing: `${engineName} only. Answers from the other engines are left out`,
    source: "AI Search answers in the date pill's selection",
    effect: "Clear the engine to see all engines.",
  });
}
