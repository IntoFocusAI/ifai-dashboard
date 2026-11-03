"use client";

import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationFilteredMark } from "@/components/v3/live/ai-search/CitationFilteredMark";
import { citationOwnedLinksLead } from "@/lib/ai-search/citation-lead";

/**
 * Opening figure on Citation Ecosystem: Fender-owned share of cited links.
 * First of the figure tiles. Uses the same rows the charts already show.
 */
export function CitationLeadFigure({
  owned,
  total,
  ready,
  category = null,
}: {
  owned: number;
  total: number;
  /** False when citation URLs are not loaded or storage caution applies. */
  ready: boolean;
  /** Label of the category the share counts. The figure then carries an asterisk. */
  category?: string | null;
}) {
  if (!ready) return null;
  const lead = citationOwnedLinksLead(owned, total);
  return (
    <section
      className="citation-figure-tile"
      data-citation-lead
      data-citation-lead-total={total}
      data-citation-lead-owned={owned}
      data-citation-lead-category={category ?? ""}
    >
      <span className="citation-figure-label" data-citation-lead-label>
        <AiTerm term="Fender-owned">Fender-owned</AiTerm> links
      </span>
      <span className="citation-figure-row">
        <span className="citation-figure-main">
          <span className="ai-lead-figure citation-figure-value citation-figure-owned" data-citation-lead-figure>
            {lead.figure}
          </span>
          {lead.population ? <CitationFilteredMark category={category} /> : null}
        </span>
        {lead.population ? (
          <span className="citation-figure-ratio" data-citation-lead-population>
            {owned} of {total} cited links lead to Fender-owned sites
          </span>
        ) : null}
      </span>
    </section>
  );
}
