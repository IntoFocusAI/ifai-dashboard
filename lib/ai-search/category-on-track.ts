import { headlineCompetitorWins, type RoleGroupTally } from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel, isCommercial, isError } from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";

/** Who leads one category on unbranded discovery. */
export type CategoryLeadStatus = "on_track" | "behind" | "even" | "not_available";

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
  behind: "Behind",
  even: "Even",
  not_available: "Not available*",
};

const LEAD_STATUS_DEFINITIONS: Record<Exclude<CategoryLeadStatus, "not_available">, string> = {
  on_track:
    "Fender or Squier was named most in more of this category's resolved unbranded discovery answers than every other brand together.",
  behind:
    "Other brands together were named most in more of this category's resolved unbranded discovery answers than Fender or Squier.",
  even: "Fender/Squier and other brands were each named most in the same number of this category's resolved unbranded discovery answers.",
};

export function leadStatusDefinition(lead: Pick<CategoryLead, "status" | "asked">): string {
  if (lead.status !== "not_available") return LEAD_STATUS_DEFINITIONS[lead.status];
  if (lead.asked <= 0) {
    return "This category has no unbranded discovery questions, so no brand leads it on that measure. The table below shows its branded consideration rate.";
  }
  return "No unbranded discovery answer in this category had a clear leader, so no brand leads it on that measure.";
}

export function categoryLeadStatus(tally: {
  resolved: number;
  fenderWins: number;
  competitorWins: number;
}): CategoryLeadStatus {
  if (tally.resolved <= 0) return "not_available";
  if (tally.fenderWins > tally.competitorWins) return "on_track";
  if (tally.competitorWins > tally.fenderWins) return "behind";
  return "even";
}

const STATUS_ORDER: Record<CategoryLeadStatus, number> = { behind: 0, even: 1, on_track: 2, not_available: 3 };

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
        status: categoryLeadStatus(unbranded),
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
  "A category is on track when Fender or Squier is named most in more of its resolved unbranded discovery answers than every other brand together. Branded consideration is not part of this test.";

export type CategoryLeadSummary = {
  /** Categories with at least one resolved unbranded discovery answer. */
  measured: number;
  onTrack: number;
  /** Labels of the categories other brands lead, in display order. */
  behind: string[];
  even: string[];
};

export function categoryLeadSummary(leads: readonly CategoryLead[]): CategoryLeadSummary {
  const labels = (status: CategoryLeadStatus) => leads.filter((lead) => lead.status === status).map((lead) => lead.label);
  return {
    measured: leads.filter((lead) => lead.status !== "not_available").length,
    onTrack: labels("on_track").length,
    behind: labels("behind"),
    even: labels("even"),
  };
}

function rivalClause(lead: CategoryLead): string {
  const rival = lead.topRival;
  if (!rival) return "";
  if (rival.wins === lead.otherLeads) return `, all ${rival.brand}`;
  return `, ${rival.brand} the most (${rival.wins})`;
}

/** One plain sentence per category. Every count shares the resolved denominator. */
export function leadSentence(lead: CategoryLead): string {
  const { fenderLeads: fender, otherLeads: other, resolved } = lead;
  const flagged =
    lead.disqualified > 0 ? ` ${lead.disqualified} more named Fender/Squier most with a confirmed product error.` : "";
  if (lead.status === "not_available") {
    return lead.asked > 0
      ? "No unbranded discovery answer in this category had a clear leader."
      : "No unbranded discovery questions in this category.";
  }
  if (lead.status === "even") {
    return `Fender/Squier and other brands each lead ${fender} of ${resolved} resolved answers.${flagged}`;
  }
  if (lead.status === "behind") {
    return `Other brands lead ${other} of ${resolved} resolved answers${rivalClause(lead)}. Fender/Squier leads ${fender}.${flagged}`;
  }
  const others = other > 0 ? ` Other brands lead ${other}${rivalClause(lead)}.` : " No other brand leads any.";
  return `Fender/Squier leads ${fender} of ${resolved} resolved answers.${others}${flagged}`;
}

export type LeadFilter = "all" | "fender" | "other";

export type BattlecardFilter = { engine: string; lead: LeadFilter };

export const NO_BATTLECARD_FILTER: BattlecardFilter = { engine: "", lead: "all" };

export const LEAD_FILTER_LABELS: Record<LeadFilter, string> = {
  all: "All categories",
  fender: "Fender/Squier leads",
  other: "Other brands lead",
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
