import { categoryLeads, type CategoryLead } from "@/lib/ai-search/category-on-track";
import { categoryRoleTallies } from "@/lib/ai-search/question-role";
import type { AiCallRow } from "@/lib/ai-search/types";

/**
 * The category the Competitive Radar bubble names: the first category the Category Battlecards
 * tab lists as Behind, with that tab's own top rival. The tab and the bubble call the same
 * function on the same rows, so they cannot name different rivals.
 */
export function radarBubbleLead(calls: readonly AiCallRow[]): CategoryLead | null {
  const rows = [...calls];
  return categoryLeads(categoryRoleTallies(rows), rows).find((lead) => lead.status === "behind" && lead.topRival) ?? null;
}
