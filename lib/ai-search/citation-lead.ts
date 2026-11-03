import { pct } from "@/lib/ai-search/summary";

/**
 * Link-share lead for Citation Ecosystem: share of cited links that are Fender-owned.
 * Same definition as the Citations satellite (`pct(fenderOwnedRows, rows)`).
 */
export function citationOwnedLinksLead(
  owned: number,
  total: number,
): { figure: string; population: string | null } {
  if (total <= 0) return { figure: "No cited links", population: null };
  return {
    figure: pct(owned, total),
    population: `${owned} of ${total} cited links lead to Fender-owned sites`,
  };
}

/** The headline chain's counts. Each share is of the step before it; null when that step is empty. */
export type CitationChainCounts = {
  answered: number;
  showed: number;
  none: number;
  links: number;
  owned: number;
  other: number;
  showedShare: number | null;
  ownedShare: number | null;
};

export function citationChain(
  read: { answered: number; answersWithCitation: number },
  lead: { owned: number; total: number },
): CitationChainCounts {
  const { answered, answersWithCitation: showed } = read;
  const { owned, total: links } = lead;
  return {
    answered,
    showed,
    none: answered - showed,
    links,
    owned,
    other: links - owned,
    showedShare: answered > 0 ? showed / answered : null,
    ownedShare: links > 0 ? owned / links : null,
  };
}
