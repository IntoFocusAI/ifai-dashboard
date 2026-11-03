import { ownedPie, sourceMix, unbrandedBrandSites, type OwnedByQuestionType } from "@/lib/ai-search/citation-insights";
import type { CitationRead } from "@/lib/ai-search/citations";
import type { AiCallRow } from "@/lib/ai-search/types";

export type CitationPieSlice = {
  key: string;
  label: string;
  count: number;
  /** Slice counts Fender-owned links, so bar charts draw it in Fender blue. */
  owned?: boolean;
};

/** Structural pie shape for CitationPieDisc. Citation views keep a closed id union below. */
export type PieDiscData = {
  id: string;
  title: string;
  total: number;
  totalLabel: string;
  slices: CitationPieSlice[];
};

export type CitationPie = PieDiscData & {
  id: "classes" | "owned" | "unbranded" | "brands";
};

/**
 * Pies for one citation view. Returns null when a slice set does not add up to
 * the same total the table uses. The former "answers that cited a source" pie
 * is no longer shown; that figure lives in the run-context strip.
 */
export function citationPies(read: CitationRead): CitationPie[] | null {
  const mix = sourceMix(read);
  const owned = ownedPie(read);
  if (read.rows.length === 0) return [];
  if (!mix || !owned) return null;

  return [
    {
      id: "classes",
      title: "Cited links by source",
      total: mix.total,
      totalLabel: "cited links",
      slices: mix.slices.map((slice) => ({
        key: slice.key,
        label: slice.label,
        count: slice.count,
      })),
    },
    {
      id: "owned",
      title: "Fender-owned and other links",
      total: owned.total,
      totalLabel: "cited links",
      slices: [
        { key: "owned", label: "Fender-owned", count: owned.owned },
        { key: "other", label: "Other cited links", count: owned.other },
      ].filter((slice) => slice.count > 0),
    },
  ];
}

/** The hero pie. Slices are the unbranded answers in the headline fraction. */
export function unbrandedAnswerPie(byType: OwnedByQuestionType | null): CitationPie | null {
  if (!byType?.ok) return null;
  const cited = byType.insight.withOwned;
  const resolved = byType.insight.resolved;
  const missed = resolved - cited;
  if (cited < 0 || missed < 0 || cited + missed !== resolved) return null;
  return {
    id: "unbranded",
    title: "Unbranded discovery answers that cited a Fender-owned page",
    total: resolved,
    totalLabel: "unbranded discovery answers",
    slices: [
      { key: "owned", label: "Cited a Fender-owned page", count: cited },
      { key: "other", label: "No Fender-owned page", count: missed },
    ].filter((slice) => slice.count > 0),
  };
}

/** Brand websites cited in unbranded discovery. Null when the slices do not add up. */
export function unbrandedBrandPie(calls: AiCallRow[], read: CitationRead): CitationPie | null {
  const sites = unbrandedBrandSites(calls, read);
  if (!sites?.ok) return null;
  return {
    id: "brands",
    title: "Brand sites cited in unbranded discovery",
    total: sites.total,
    totalLabel: "brand-site links",
    slices: sites.slices.map((slice) => ({
      key: slice.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label: slice.brand,
      count: slice.links,
      owned: slice.fenderOwned,
    })),
  };
}
