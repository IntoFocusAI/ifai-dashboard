"use client";

import "@/components/v3/live/catalog-health.css";
import { useState } from "react";
import { ConsensusComponentBars, COMPONENTS_ID } from "@/components/v3/live/ConsensusScoreView";
import { RetailShareDisc, RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import { RetailOverviewLead } from "@/components/v3/live/RetailOverviewLead";
import { authorizedPartnersFromSave } from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import {
  scoreAgainst100Pie,
  scoreAgainstTarget,
  scoreFigure,
  scoreTargetLabel,
  scoreTone,
  scoreToneColor,
} from "@/lib/fender-canvas/consensus-score-display";
import { commerceInputsFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import { commerceScore, type PillarScore } from "@/lib/fender-canvas/consensus-scores";
import { formatRatio } from "@/lib/fender-canvas/format";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

/**
 * The AI Commerce card in the Retail Overview hero row. Same layout as its three siblings:
 * label, figure, N of M, status mark and word, and the disc in the chart tokens. The score
 * bands are the shared ones (below 40, 40 to 70, above 70); the word is the default for the band.
 * The chevron opens the component bars under the row.
 */
function CommerceCard({
  commerce,
  open,
  onToggle,
}: {
  commerce: PillarScore;
  open: boolean;
  onToggle: () => void;
}) {
  const { score, coverage, name } = commerce;
  const tone = scoreTone(score);
  const pie = scoreAgainst100Pie("score-commerce", name, score);
  const tip =
    score != null && coverage
      ? `${name}: ${scoreAgainstTarget(score)} · ${formatRatio(coverage.numerator, coverage.denominator)} of inputs in.`
      : null;
  return (
    <div
      className="retail-finding retail-overview-hero retail-commerce-hero"
      data-consensus-pillar="commerce"
      data-consensus-commerce-hero="commerce"
    >
      <span className="metric-card-label" data-consensus-pillar-name="">
        {name}
      </span>
      <span className="retail-overview-hero-row">
        <span className="retail-overview-hero-figures">
          <span
            className="ai-lead-figure"
            data-consensus-pillar-score=""
            data-consensus-pillar-included="true"
            style={{ color: tone ? scoreToneColor(score) : "var(--text-muted)" }}
          >
            {score == null ? "Not available" : scoreFigure(score)}
          </span>
          {score != null ? (
            <span className="retail-overview-hero-ratio" data-consensus-target="">
              {scoreTargetLabel()}
            </span>
          ) : null}
          {coverage ? (
            <span className="retail-overview-hero-ratio" data-consensus-pillar-coverage="">
              {formatRatio(coverage.numerator, coverage.denominator)}
            </span>
          ) : null}
          <RetailStatusMark tone={tone} />
        </span>
        {pie ? <RetailShareDisc pie={pie} measuredKey="matched" tip={tip} /> : null}
      </span>
      <button
        type="button"
        className="retail-explore"
        aria-label={name}
        aria-expanded={open}
        aria-controls={COMPONENTS_ID}
        onClick={onToggle}
      >
        <svg className="retail-explore-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path
            d="M2.2 4.2 6 8l3.8-3.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Catalog Health → Retail Overview: AI Commerce hero in the same band as the
 * three share pies. Chevron opens full-width commerce component bars below.
 */
export function CommerceConsensusPanel({ read }: { read: RetailCanvasRead }) {
  const [open, setOpen] = useState(false);
  const [saved] = useAuthorizedSellers();
  const authorizedPartners = authorizedPartnersFromSave(saved);

  if (read.phase === "loading") {
    return <p className="retail-missing">Loading AI Commerce score…</p>;
  }
  if (read.phase === "error") {
    return <p className="retail-missing">The AI Commerce score could not be loaded.</p>;
  }

  const inputs = commerceInputsFromLive(read, authorizedPartners);
  if (!inputs) {
    return (
      <>
        <p className="retail-missing" data-consensus-commerce-unavailable="">
          AI Commerce is not available until the retail reading loads.
        </p>
        <RetailOverviewLead read={read} />
      </>
    );
  }

  const commerce = commerceScore(inputs, { authorizedPartners });

  return (
    <div data-consensus-commerce-block="">
      <RetailOverviewLead
        read={read}
        leading={<CommerceCard commerce={commerce} open={open} onToggle={() => setOpen((value) => !value)} />}
      />
      {open ? <ConsensusComponentBars pillar={commerce} id={COMPONENTS_ID} /> : null}
    </div>
  );
}
