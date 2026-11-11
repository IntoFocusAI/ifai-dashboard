"use client";

import "@/components/v3/live/summary.css";
import { useState } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { ConsensusComponentBars } from "@/components/v3/live/ConsensusComponentBars";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { StatusMark } from "@/components/v3/live/StatusMark";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import {
  ACTUATION_OMITTED_REASON,
  CONSENSUS_EXPLAINER_BODY,
  CONSENSUS_EXPLAINER_TITLE,
  consensusPartial,
  pillarPartial,
  scoreAgainst100Pie,
  scoreAgainstTarget,
  scoreFigure,
  scoreStatus,
  scoreTargetLabel,
  scoreToneColor,
} from "@/lib/fender-canvas/consensus-score-display";
import { formatRatio } from "@/lib/fender-canvas/format";
import type { ConsensusScore, PillarScore } from "@/lib/fender-canvas/consensus-scores";

const PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";
const COMPONENTS_ID = "consensus-component-detail";

function ExploreChevron() {
  return (
    <svg
      className="retail-explore-chevron"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path
        d="M2.2 4.2 6 8l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Fit-content score hero: label, the score in its status color against target 70 (H-07),
 * N of M, the status mark and word, pie disc, optional chevron. A score that leaves out some
 * of its inputs carries the asterisk and its tooltip (X-25).
 */
export function ScoreHeroCard({
  id,
  label,
  score,
  coverage,
  open,
  onToggle,
  controls,
  dominant,
  dataAttr,
  partial = null,
  coverageNoun,
}: {
  id: string;
  label: string;
  score: number | null;
  coverage: { numerator: number; denominator: number } | null;
  open?: boolean;
  onToggle?: () => void;
  controls?: string;
  dominant?: boolean;
  dataAttr?: string;
  partial?: PartialFigure | null;
  /** What the coverage counts: "pillars" or "components". */
  coverageNoun?: string;
}) {
  const color = scoreToneColor(score);
  const status = scoreStatus(score);
  const pie = scoreAgainst100Pie(`score-${id}`, label, score);
  const figure = scoreFigure(score);
  const target = scoreAgainstTarget(score);
  const tip =
    target && coverage
      ? `${label}: ${target} · ${formatRatio(coverage.numerator, coverage.denominator)} ${coverageNoun ?? "inputs"} in.`
      : undefined;

  return (
    <div
      className="content-box findability-lead-card"
      data-consensus-pillar={id}
      data-consensus-hero={dominant ? "" : undefined}
      {...(dataAttr ? { [dataAttr]: id } : {})}
      style={{
        flex: "0 0 auto",
        width: "fit-content",
        maxWidth: "100%",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div className="metric-card-label" data-consensus-pillar-name="">
        {label}
      </div>
      <div className="findability-lead-row">
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            data-consensus-pillar-score=""
            data-consensus-score={dominant ? "" : undefined}
            data-consensus-pillar-included="true"
            style={{
              color,
              fontSize: dominant ? "clamp(34px, 4vw, 48px)" : undefined,
              lineHeight: 1.05,
            }}
          >
            <PartialFigureMark partial={partial} testId={`consensus-${id}`}>
              {figure}
            </PartialFigureMark>
          </span>
          {target ? (
            <span className="findability-lead-ratio" data-consensus-target="">
              {scoreTargetLabel()}
            </span>
          ) : null}
          {coverage && score != null ? (
            <span
              className="findability-lead-ratio"
              data-consensus-pillar-coverage=""
              data-consensus-coverage={dominant ? "" : undefined}
            >
              {formatRatio(coverage.numerator, coverage.denominator)}
              {coverageNoun ? ` ${coverageNoun}` : ""}
            </span>
          ) : null}
          {status ? <StatusMark status={status} /> : null}
        </div>
        {pie ? <CitationPieDisc pie={pie} sizeClass={PIE_SIZE} tip={tip} /> : null}
      </div>
      {onToggle ? (
        <button
          type="button"
          className="retail-explore"
          aria-label={label}
          aria-expanded={open}
          aria-controls={controls}
          onClick={onToggle}
          style={{ marginTop: "auto", alignSelf: "center" }}
        >
          <ExploreChevron />
        </button>
      ) : null}
    </div>
  );
}

/** Compact Actuation card: not a wide empty box. */
export function ActuationHeroCard({ pillar }: { pillar: PillarScore }) {
  return (
    <div
      className="content-box findability-lead-card"
      data-consensus-pillar="actuation"
      style={{
        flex: "0 0 auto",
        width: "fit-content",
        maxWidth: 220,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div className="metric-card-label" data-consensus-pillar-name="">
        {pillar.name}
      </div>
      <div
        className="metric-card-val"
        data-consensus-pillar-score=""
        data-consensus-pillar-included="false"
        style={{ fontSize: 16, color: "var(--text-muted)" }}
      >
        {pillar.omittedLabel ?? "Not included"}
      </div>
      <span className="metric-card-sub" data-consensus-actuation-reason="">
        {ACTUATION_OMITTED_REASON}
      </span>
    </div>
  );
}

function ConsensusExplainer() {
  return (
    <div
      className="content-box"
      data-consensus-explainer=""
      style={{ flex: "1 1 240px", minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="ceo-callout" style={{ margin: 0 }}>
        <div className="ceo-callout-header">
          <span>{CONSENSUS_EXPLAINER_TITLE}</span>
        </div>
        <div className="ceo-callout-body">{CONSENSUS_EXPLAINER_BODY}</div>
      </div>
    </div>
  );
}

/**
 * Summary → Performance top band: Consensus lead, pillar heroes, Actuation compact card,
 * and explainer. Component bars open full-width below the band.
 */
export function ConsensusLeadBand({ consensus }: { consensus: ConsensusScore }) {
  const [open, setOpen] = useState<"foundation" | "commerce" | null>(null);

  function toggle(id: "foundation" | "commerce") {
    setOpen((current) => (current === id ? null : id));
  }

  const openPillar =
    open === "foundation"
      ? consensus.foundation
      : open === "commerce"
        ? consensus.commerce
        : null;

  return (
    <div data-consensus-scores="" style={{ marginBottom: 16 }}>
      <div
        data-consensus-lead=""
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          <ScoreHeroCard
            id="consensus"
            label="AI Consensus"
            score={consensus.score}
            coverage={consensus.coverage}
            coverageNoun="pillars"
            partial={consensusPartial(consensus)}
            dominant
          />
          <ScoreHeroCard
            id="foundation"
            label={consensus.foundation.name}
            score={consensus.foundation.score}
            coverage={consensus.foundation.coverage}
            coverageNoun="components"
            partial={pillarPartial(consensus.foundation)}
            open={open === "foundation"}
            onToggle={() => toggle("foundation")}
            controls={COMPONENTS_ID}
          />
          <ScoreHeroCard
            id="commerce"
            label={consensus.commerce.name}
            score={consensus.commerce.score}
            coverage={consensus.commerce.coverage}
            coverageNoun="components"
            partial={pillarPartial(consensus.commerce)}
            open={open === "commerce"}
            onToggle={() => toggle("commerce")}
            controls={COMPONENTS_ID}
          />
          <ActuationHeroCard pillar={consensus.actuation} />
        </div>
        <ConsensusExplainer />
      </div>

      {openPillar ? <ConsensusComponentBars pillar={openPillar} id={COMPONENTS_ID} /> : null}
    </div>
  );
}

/** Catalog Health AI Commerce hero: fit-content card with chevron into full-width bars. */
export function CommerceHeroCard({
  commerce,
  open,
  onToggle,
}: {
  commerce: PillarScore;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <ScoreHeroCard
      id="commerce"
      label={commerce.name}
      score={commerce.score}
      coverage={commerce.coverage}
      open={open}
      onToggle={onToggle}
      controls={COMPONENTS_ID}
      dataAttr="data-consensus-commerce-hero"
    />
  );
}

export { ConsensusComponentBars, COMPONENTS_ID };
