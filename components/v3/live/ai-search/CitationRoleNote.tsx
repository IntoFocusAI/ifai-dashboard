"use client";

import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { brandName, brandOwned } from "@/lib/brand-copy";

/** Caveat on the source mix. Shown in the source-mix chart's tooltip. */
export const SOURCE_MIX_CAVEAT =
  `A useful authorized retailer citation is not a worse outcome than a ${brandName()} page, so read this mix as a balance rather than a target.`;

/** Caveat on link counts. Shown in the Links and Fender-owned column tooltips. */
export const CITED_LINK_COUNT_CAVEAT =
  "A low count does not prove a source had no influence on the model, and an engine can use a source without returning it as a cited link.";

/** What each kind of cited source does for the brand. */
export function CitationRoleNote() {
  return (
    <div className="ceo-callout" style={{ marginTop: 12 }}>
      <div className="ceo-callout-header">
        <span>Why this matters</span>
      </div>
      <div className="ceo-callout-body">
        <ul style={{ paddingLeft: 16, margin: 0 }}>
          <li>
            <AiTerm term="Fender-owned">{brandOwned()}</AiTerm> sources provide canonical product facts.
          </li>
          <li>Retailer sources help shoppers find products they can buy.</li>
          <li>Editorial and community sources provide independent authority.</li>
          <li>Depending on third parties gives {brandName()} less control over the facts assistants repeat.</li>
        </ul>
      </div>
    </div>
  );
}
