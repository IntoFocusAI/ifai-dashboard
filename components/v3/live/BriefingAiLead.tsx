"use client";

import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { useSummaryAiRead } from "@/components/v3/live/useSummaryAiRead";
import { citationOwnedLinksLead } from "@/lib/ai-search/citation-lead";
import { headlineLine, summarizeRun } from "@/lib/ai-search/summary";
import { brandName } from "@/lib/brand-copy";
import { activeClient, activeClientSettings } from "@/lib/client/active-client";
import { authorizedPartnersFromSave } from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import { ESTIMATE_LOADING, NO_ANALYST_ESTIMATE } from "@/lib/fender-canvas/analyst-estimates";
import { activeOffersLine, AI_READ_FAILED } from "@/lib/fender-canvas/briefing-retail-lead";
import { formatInt } from "@/lib/fender-canvas/format";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import { ESTIMATES_READ_FAILED } from "@/components/v3/live/estimates/OpportunityEstimates";

/** How AI assistants refer the brand in the date-pill window: the two lead rates and the owned-link share. */
function AiReferral() {
  const ai = useSummaryAiRead();
  if (ai.phase === "loading") return <p data-briefing-lead-ai="">{ESTIMATE_LOADING}</p>;
  if (ai.phase !== "ready") {
    return (
      <p data-briefing-lead-ai="">
        <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, AI_READ_FAILED, "briefing-lead-ai")}>{NO_ANALYST_ESTIMATE}</span>
      </p>
    );
  }
  const summary = summarizeRun(ai.snapshot);
  const owned = citationOwnedLinksLead(summary.citations.fenderOwnedRows, summary.citations.rows);
  return (
    <p data-briefing-lead-ai="">
      {headlineLine(summary)}
      {owned.population ? ` ${owned.population}.` : null}
    </p>
  );
}

/** What the brand controls: each listing fix and the listings it touches, from the brand's own listings. */
function Controls({ bundle }: { bundle: CanvasBundle }) {
  const read = bundle.estimates;
  if (!read || read.phase === "loading") return <p>{ESTIMATE_LOADING}</p>;
  if (read.phase === "error") {
    return <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, ESTIMATES_READ_FAILED, "briefing-lead-controls")}>{NO_ANALYST_ESTIMATE}</span>;
  }
  const lines = read.estimates.phase1.parts ?? [];
  return (
    <ul style={{ margin: "4px 0 0 16px", padding: 0 }} data-briefing-lead-controls="">
      {lines.map((line) => (
        <li key={line.lineId}>
          <strong>{line.trail.title}:</strong> {formatInt(line.trail.coverage.total)} listings
        </li>
      ))}
    </ul>
  );
}

/** Who is meant to hold the Buy Box, from the seller model in settings and the saved partners. */
function SellerModel() {
  const [saved] = useAuthorizedSellers();
  const brand = brandName();
  if (activeClient().sellerModel === "Brand-led") {
    return (
      <li>
        <strong>Brand-led:</strong> {brand}&apos;s own seller accounts are meant to hold the Buy Box. Listings held by Amazon Retail or another seller are counted separately in Catalog Health.
      </li>
    );
  }
  const partners = authorizedPartnersFromSave(saved) ?? activeClientSettings().default_authorized_partners;
  return (
    <li>
      <strong>Partner-led:</strong> Amazon Retail{partners.length > 0 ? ` and ${partners.join(", ")} are` : " is"} meant to hold the Buy Box.
    </li>
  );
}

/**
 * The Briefing's lead section (decision 110): how AI assistants refer the brand in relevant shopping
 * searches today, and what the brand controls, from its own data. One layout for every client.
 */
export function BriefingAiLead({ bundle }: { bundle: CanvasBundle }) {
  const brand = brandName();
  const note = activeClientSettings().briefing_note;
  return (
    <>
      <div className="ceo-callout" data-briefing-lead="" style={{ marginTop: 12 }}>
        <div className="ceo-callout-header">
          <span>What is changing what AI assistants recommend for {brand}?</span>
        </div>
        <div className="ceo-callout-body">
          <AiReferral />
          <strong>What {brand} controls:</strong>
          <Controls bundle={bundle} />
          <br />
          <strong>Active offers:</strong> <span dangerouslySetInnerHTML={{ __html: activeOffersLine(bundle) }} />
          <br />
          <br />
          <strong>{brand}&apos;s selling model on Amazon:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            <SellerModel />
          </ul>
        </div>
      </div>
      {note ? (
        <div className="content-box" data-briefing-note="" style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{note}</p>
        </div>
      ) : null}
    </>
  );
}
