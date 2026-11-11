import { SOURCE_CLASS_LABELS, type CitationEvidence, type SourceClass } from "@/lib/ai-search/citations";
import { citationCategoryLabel } from "@/lib/ai-search/citation-top-sources";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import { brandName } from "@/lib/brand-copy";

/** A row or chart mark the cited-links table is narrowed to. */
export type CitationPick =
  | { field: "domain" | "class" | "engine" | "category"; value: string }
  | { field: "gap"; value: string; simulationIds: string[] }
  | { field: "role_owned"; value: string; simulationIds: string[] }
  | null;

export function citationPickMatches(row: CitationEvidence, pick: CitationPick): boolean {
  if (!pick) return true;
  if (pick.field === "gap" || pick.field === "role_owned") {
    return pick.simulationIds.includes(row.simulationId);
  }
  if (pick.field === "domain") return row.domain === pick.value;
  if (pick.field === "class") return row.sourceClass === pick.value;
  if (pick.field === "engine") return row.engine === pick.value;
  return row.category === pick.value;
}

/** What the cited-links table shows, named for its title. */
export function citationPickLabel(pick: CitationPick, category: string | null = null): string {
  const label = !pick
    ? "every cited link"
    : pick.field === "gap"
      ? `${categoryLabel(pick.value)} gaps (no ${brandName()}-owned page)`
      : pick.field === "role_owned"
        ? pick.value.includes("cited_owned")
          ? `answers that cited a ${brandName()}-owned page`
          : `answers with no ${brandName()}-owned page`
        : pick.field === "class"
          ? SOURCE_CLASS_LABELS[pick.value as SourceClass]
          : pick.field === "engine"
            ? engineLabel(pick.value)
            : pick.field === "category"
              ? citationCategoryLabel(pick.value)
              : pick.value;
  const categoryNamed = pick?.field === "category" || pick?.field === "gap";
  return category == null || categoryNamed ? label : `${label} in ${citationCategoryLabel(category)}`;
}

/**
 * A new category keeps a site, class, or engine pick. Category, gap, and answer-group
 * picks belong to the old category, so they clear.
 */
export function pickAfterCategoryChange(pick: CitationPick): CitationPick {
  if (pick?.field === "domain" || pick?.field === "class" || pick?.field === "engine") return pick;
  return null;
}
