"use client";

import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { citationOwnedLinksLead } from "@/lib/ai-search/citation-lead";

/**
 * Opening figure on Citation Ecosystem: Fender-owned share of cited links.
 * First of the figure tiles. Uses the same rows the charts already show.
 */
export function CitationLeadFigure({
  owned,
  total,
  ready,
  within = null,
}: {
  owned: number;
  total: number;
  /** False when citation URLs are not loaded or storage caution applies. */
  ready: boolean;
  /** Names the slice the share counts, e.g. "all categories". */
  within?: string | null;
}) {
  if (!ready) return null;
  const lead = citationOwnedLinksLead(owned, total);
  return (
    <section
      className="citation-figure-tile"
      data-citation-lead
      data-citation-lead-total={total}
      data-citation-lead-owned={owned}
      data-citation-lead-within={within ?? ""}
    >
      <span className="citation-figure-label" data-citation-lead-label>
        <AiTerm term="Fender-owned">Fender-owned</AiTerm> links{within ? ` in ${within}` : ""}
      </span>
      <span className="citation-figure-row">
        <span className="ai-lead-figure citation-figure-value citation-figure-owned" data-citation-lead-figure>
          {lead.figure}
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
