import { categoryLeads, rivalLeadsCategory, type CategoryLead } from "@/lib/ai-search/category-on-track";
import { discoveryCategoryRoleTallies } from "@/lib/ai-search/question-role";
import { MIN_COMPARABLE_RESOLVED } from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";
import { leadBrand } from "@/lib/brand-copy";

/**
 * The client's strongest and weakest question category (decision 106). Categories come from the
 * client's own loaded questions, read the way Category Battlecards reads them: only categories
 * with Unbranded Discovery questions in the selected period, with the Battlecards lead rule
 * (On track, Tied, Behind) and top rival. No category name is fixed in code.
 */
export type CategoryStanding = {
  lead: CategoryLead;
  /** Brand leads minus the top rival's leads. Positive when the brand is ahead. */
  margin: number;
  /** The margin in points of the category's resolved Unbranded Discovery answers. */
  marginPts: number;
};

export type CategoryStandingResult = { standing: CategoryStanding; missing: null } | { standing: null; missing: string };

/** Battlecard leads for the calls in the selected period, every engine. */
export function periodCategoryLeads(calls: readonly AiCallRow[]): CategoryLead[] {
  const rows = [...calls];
  return categoryLeads(discoveryCategoryRoleTallies(rows), rows);
}

function standing(lead: CategoryLead): CategoryStanding {
  const margin = lead.fenderLeads - (lead.topRival?.wins ?? 0);
  return { lead, margin, marginPts: (margin * 100) / lead.resolved };
}

/** Categories with enough resolved answers to compare: the same floor the small-sample mark uses. */
function comparable(leads: readonly CategoryLead[]): CategoryLead[] {
  return leads.filter((lead) => lead.status !== "not_available" && lead.resolved >= MIN_COMPARABLE_RESOLVED);
}

/** Largest gap first, then the larger sample, then A to Z, so equal gaps always pick the same category. */
function byGap(a: CategoryStanding, b: CategoryStanding, sign: 1 | -1): number {
  return sign * (b.marginPts - a.marginPts) || b.lead.resolved - a.lead.resolved || a.lead.label.localeCompare(b.lead.label);
}

function noComparableReason(leads: readonly CategoryLead[]): string | null {
  if (!leads.length) return "The selected period has no Unbranded Discovery questions in any category.";
  if (!leads.some((lead) => lead.status !== "not_available")) {
    return "No Unbranded Discovery answer in the selected period had a clear leader in any category.";
  }
  if (!comparable(leads).length) {
    return `No category has ${MIN_COMPARABLE_RESOLVED} or more resolved Unbranded Discovery answers in the selected period, too few to compare.`;
  }
  return null;
}

/** The On track category where the brand's lead over the top rival is largest. */
export function strongestCategoryStanding(leads: readonly CategoryLead[]): CategoryStandingResult {
  const none = noComparableReason(leads);
  if (none) return { standing: null, missing: none };
  const ahead = comparable(leads).filter((lead) => lead.status === "on_track").map(standing);
  if (!ahead.length) {
    return {
      standing: null,
      missing: `${leadBrand()} does not lead any category with ${MIN_COMPARABLE_RESOLVED} or more resolved Unbranded Discovery answers in the selected period. Category Battlecards shows each category's status.`,
    };
  }
  return { standing: ahead.sort((a, b) => byGap(a, b, 1))[0], missing: null };
}

/** The Behind category where the top rival's lead over the brand is largest. */
export function weakestCategoryStanding(leads: readonly CategoryLead[]): CategoryStandingResult {
  const none = noComparableReason(leads);
  if (none) return { standing: null, missing: none };
  const behind = comparable(leads).filter((lead) => lead.status === "behind" && lead.topRival).map(standing);
  if (!behind.length) {
    return {
      standing: null,
      missing: `No other brand leads ${leadBrand()} in any category with ${MIN_COMPARABLE_RESOLVED} or more resolved Unbranded Discovery answers in the selected period. Category Battlecards shows each category's status.`,
    };
  }
  return { standing: behind.sort((a, b) => byGap(a, b, -1))[0], missing: null };
}

/** "18 pts" or "12.5 pts": one decimal, without a trailing ".0". */
export function formatGapPts(pts: number): string {
  const rounded = Math.round(Math.abs(pts) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} pts`;
}

/** "Fender/Squier leads Electrics by 18 pts" or "Taylor leads Acoustics by 12 pts". */
export function standingHeadline(item: CategoryStanding): string {
  const brand = item.margin >= 0 ? leadBrand() : (item.lead.topRival?.brand ?? "Another brand");
  return `${rivalLeadsCategory(brand, item.lead.key)} by ${formatGapPts(item.marginPts)}`;
}

/** The counts under the headline, on the category's resolved Unbranded Discovery answers. */
export function standingCounts(item: CategoryStanding): string {
  const { lead } = item;
  const scope = `of ${lead.resolved} resolved ${lead.label} Unbranded Discovery answers`;
  return lead.topRival
    ? `${leadBrand()} ${lead.fenderLeads} vs ${lead.topRival.brand} ${lead.topRival.wins} ${scope}`
    : `${leadBrand()} ${lead.fenderLeads} ${scope}. No other brand led one.`;
}

const COMPARED = `Categories come from the brand's own questions. Categories with fewer than ${MIN_COMPARABLE_RESOLVED} resolved answers, and tied categories, are not compared. Category Battlecards shows every category.`;

/** Picker definitions. They name no brand, so they read the same for every client. */
export const STRONGEST_CATEGORY_DEFINITION = `The question category where the brand's lead over the top rival is largest, in points of the category's resolved Unbranded Discovery answers in the selected period. ${COMPARED}`;

export const WEAKEST_CATEGORY_DEFINITION = `The question category where the top rival's lead over the brand is largest, in points of the category's resolved Unbranded Discovery answers in the selected period. ${COMPARED}`;
