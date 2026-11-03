"use client";

import "@/components/v3/live/ai-search/citation-glance.css";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationLeadFigure } from "@/components/v3/live/ai-search/CitationLeadFigure";
import type { CitationRead } from "@/lib/ai-search/citations";
import { pct } from "@/lib/ai-search/summary";

export type CitationLeadInput = { owned: number; total: number; within: string | null };

/** One row of figures: Fender-owned link share, answers that cited the web, and cited links. */
export function CitationFigureTiles({
  lead,
  read,
  scopeNoun,
  engines,
  note,
}: {
  lead: CitationLeadInput;
  read: CitationRead;
  scopeNoun: string;
  engines: string[];
  /** Window note, e.g. runs left out because citations were not stored. */
  note: string;
}) {
  return (
    <div className="citation-figure-tiles" data-citation-figures>
      <CitationLeadFigure owned={lead.owned} total={lead.total} within={lead.within} ready />
      <section className="citation-figure-tile" data-citation-figure="cited-answers">
        <span className="citation-figure-label">Answers citing web sources</span>
        <span className="citation-figure-row">
          {read.answered > 0 ? (
            <span className="ai-lead-figure citation-figure-value citation-figure-cited">
              {pct(read.answersWithCitation, read.answered)}
            </span>
          ) : (
            <span
              className="ai-lead-figure citation-figure-value ifai-term"
              tabIndex={0}
              data-ifai-tooltip-title="Not available"
              data-ifai-tooltip-desc={`No ${scopeNoun} were answered in this view, so there is no share to show.`}
              aria-label={`Not available: no ${scopeNoun} were answered in this view.`}
            >
              Not available*
            </span>
          )}
          <span className="citation-figure-ratio" data-ai-cited-answers>
            {read.answersWithCitation} of {read.answered} {scopeNoun} cited web sources
          </span>
        </span>
      </section>
      <section className="citation-figure-tile" data-citation-figure="cited-links">
        <span className="citation-figure-label">Total</span>
        <span className="citation-figure-row">
          <span className="ai-lead-figure citation-figure-value" data-ai-cited-links>
            {read.rows.length}{" "}
            <span className="citation-figure-unit">
              <AiTerm term="cited link">cited links</AiTerm>
            </span>
          </span>
          <span className="citation-figure-ratio" data-citation-run-context>
            <span>{engines.length ? engines.join(", ") : "No engines"}</span>
            {note ? <span data-citation-window>{note}</span> : null}
          </span>
        </span>
      </section>
    </div>
  );
}
