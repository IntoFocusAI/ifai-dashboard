import {
  groupCitations,
  SOURCE_CLASS_LABELS,
  type CitationRead,
  type CitationScope,
  type SourceClass,
} from "@/lib/ai-search/citations";
import { categoryLabel } from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";

/** Rows the top-sites chart shows. */
export const TOP_SOURCES_MAX = 10;

/** What the top-sites chart counts: answers that cite a site, or links to it. */
export type TopSitesMeasure = "answers" | "links";

/** The definition key whose sentence states each measure's ranking rule. */
export const TOP_SITES_RULE = {
  answers: "top cited sites",
  links: "top cited sites by links",
} as const satisfies Record<TopSitesMeasure, string>;

export type TopCitedSource = {
  rank: number;
  domain: string;
  /** Answers in this view that cite the site at least once. */
  answers: number;
  /** Answered calls in this view, cited or not. */
  answered: number;
  /** Cited links to the site. The row count its evidence table shows. */
  links: number;
  /** Cited links in this view, to any site. */
  linksTotal: number;
  sourceClass: SourceClass;
  classLabel: string;
  fenderOwned: boolean;
};

/**
 * Sites ranked by the chosen measure, then by the other one, then by name.
 * Answers: answers that cite the site. Links: cited links to the site.
 */
export function topCitedSources(
  read: CitationRead,
  limit = TOP_SOURCES_MAX,
  measure: TopSitesMeasure = "answers",
): TopCitedSource[] {
  const classOf = new Map<string, SourceClass>();
  for (const row of read.rows) if (!classOf.has(row.domain)) classOf.set(row.domain, row.sourceClass);
  return groupCitations(read.rows, (row) => row.domain)
    .sort((a, b) =>
      measure === "links"
        ? b.rows - a.rows || b.answers - a.answers || a.key.localeCompare(b.key)
        : b.answers - a.answers || b.rows - a.rows || a.key.localeCompare(b.key),
    )
    .slice(0, Math.max(0, limit))
    .map((group, index) => {
      const sourceClass = classOf.get(group.key) ?? "other";
      return {
        rank: index + 1,
        domain: group.key,
        answers: group.answers,
        answered: read.answered,
        links: group.rows,
        linksTotal: read.rows.length,
        sourceClass,
        classLabel: SOURCE_CLASS_LABELS[sourceClass],
        fenderOwned: sourceClass === "fender_owned",
      };
    });
}

/** The stored category name, with the fact-check bucket named the way the By category table names it. */
export function citationCategoryLabel(key: string): string {
  return key === "hallucinations" ? "Product fact checks" : categoryLabel(key);
}

export type CitationCategoryOption = { key: string; label: string; answered: number };

/** Categories with at least one answered call in scope, largest first. */
export function citationCategoryOptions(calls: AiCallRow[], scope: CitationScope): CitationCategoryOption[] {
  const counts = new Map<string, number>();
  for (const call of calls) {
    if (call.call_status !== "answered") continue;
    if (scope !== "all" && call.prompt_kind !== scope) continue;
    const key = call.category ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, answered]) => ({ key, label: citationCategoryLabel(key), answered }))
    .sort((a, b) => b.answered - a.answered || a.label.localeCompare(b.label));
}

/** Keep the chosen category when the new scope still has answers in it. */
export function categoryForScope(
  calls: AiCallRow[],
  scope: CitationScope,
  category: string | null,
): string | null {
  if (category == null) return null;
  return citationCategoryOptions(calls, scope).some((option) => option.key === category) ? category : null;
}

/**
 * The snapshot narrowed to one category. Only calls are filtered: citations join to
 * calls by id, so a citation on a call outside the category drops out of every count.
 */
export function snapshotInCategory(snapshot: AiSearchSnapshot, category: string | null): AiSearchSnapshot {
  if (category == null) return snapshot;
  return { ...snapshot, calls: snapshot.calls.filter((call) => (call.category ?? "") === category) };
}
