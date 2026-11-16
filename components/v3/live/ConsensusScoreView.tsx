"use client";

import "@/components/v3/live/summary.css";
import { useState } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { ConsensusComponentBars } from "@/components/v3/live/ConsensusComponentBars";
import { ConsensusWeightBreakdown } from "@/components/v3/live/ConsensusWeightBreakdown";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { SCORE_CARD_TIPS, SCORE_CARD_TITLES } from "@/components/v3/live/score-card-tips";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import {
  ACTUATION_OMITTED_REASON,
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

/** Card title. With a tip it is a custom tooltip term (custom-tooltips rule), never a native title. */
function ScoreCardTitle({ label, tip }: { label: string; tip?: string }) {
  return (
    <div className="metric-card-label" data-consensus-pillar-name="">
      {tip ? (
        <span
          className="ifai-term"
          data-ifai-tooltip-title={label}
          data-ifai-tooltip-desc={tip}
          data-score-card-tip=""
          tabIndex={0}
          aria-label={`${label}: ${tip}`}
        >
          {label}
        </span>
      ) : (
        label
      )}
    </div>
  );
}

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
  titleTip,
  wide,
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
  /** Custom tooltip on the title. */
  titleTip?: string;
  /** Fill its cell in the Summary → Performance score row instead of fitting its content. */
  wide?: boolean;
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
        width: wide ? "auto" : "fit-content",
        maxWidth: "100%",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <ScoreCardTitle label={label} tip={titleTip} />
      <div className="findability-lead-row">
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            data-consensus-pillar-score=""
            data-consensus-score={dominant ? "" : undefined}
            data-consensus-pillar-included="true"
            style={{
              color,
              fontSize: dominant && !wide ? "clamp(34px, 4vw, 48px)" : undefined,
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
export function ActuationHeroCard({ pillar, wide }: { pillar: PillarScore; wide?: boolean }) {
  return (
    <div
      className="content-box findability-lead-card"
      data-consensus-pillar="actuation"
      style={{
        flex: "0 0 auto",
        width: wide ? "auto" : "fit-content",
        maxWidth: wide ? "100%" : 220,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <ScoreCardTitle
        label={wide ? SCORE_CARD_TITLES.actuation : pillar.name}
        tip={wide ? SCORE_CARD_TIPS.actuation : undefined}
      />
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

type OpenCard = "consensus" | "foundation" | "commerce";

/**
 * Summary → Performance top band: four equal score cards in one row (AI Consensus, AI Foundation,
 * AI Commerce, AI Actuation). Each title carries its tooltip. A chevron opens the Consensus
 * weights or a pillar's components full-width below the row.
 */
export function ConsensusLeadBand({ consensus }: { consensus: ConsensusScore }) {
  const [open, setOpen] = useState<OpenCard | null>(null);

  function toggle(id: OpenCard) {
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
      <div data-consensus-lead="" className="consensus-score-row">
        <ScoreHeroCard
          id="consensus"
          label={SCORE_CARD_TITLES.consensus}
          titleTip={SCORE_CARD_TIPS.consensus}
          score={consensus.score}
          coverage={consensus.coverage}
          coverageNoun="pillars"
          partial={consensusPartial(consensus)}
          open={open === "consensus"}
          onToggle={() => toggle("consensus")}
          controls={COMPONENTS_ID}
          dominant
          wide
        />
        <ScoreHeroCard
          id="foundation"
          label={SCORE_CARD_TITLES.foundation}
          titleTip={SCORE_CARD_TIPS.foundation}
          score={consensus.foundation.score}
          coverage={consensus.foundation.coverage}
          coverageNoun="components"
          partial={pillarPartial(consensus.foundation)}
          open={open === "foundation"}
          onToggle={() => toggle("foundation")}
          controls={COMPONENTS_ID}
          wide
        />
        <ScoreHeroCard
          id="commerce"
          label={SCORE_CARD_TITLES.commerce}
          titleTip={SCORE_CARD_TIPS.commerce}
          score={consensus.commerce.score}
          coverage={consensus.commerce.coverage}
          coverageNoun="components"
          partial={pillarPartial(consensus.commerce)}
          open={open === "commerce"}
          onToggle={() => toggle("commerce")}
          controls={COMPONENTS_ID}
          wide
        />
        <ActuationHeroCard pillar={consensus.actuation} wide />
      </div>

      {open === "consensus" ? <ConsensusWeightBreakdown consensus={consensus} id={COMPONENTS_ID} /> : null}
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
