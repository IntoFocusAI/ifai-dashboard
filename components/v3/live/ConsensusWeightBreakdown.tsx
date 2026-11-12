"use client";

import "@/components/v3/live/summary.css";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { consensusWeightRows, SCORE_CARD_TITLES, type ConsensusWeightRow } from "@/components/v3/live/score-card-tips";
import { CHART_COLORS } from "@/lib/canvas-sdk/data-status";
import {
  consensusPartial,
  pillarPartial,
  scoreFigure,
  scoreStatus,
  scoreToneColor,
} from "@/lib/fender-canvas/consensus-score-display";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import type { ConsensusScore } from "@/lib/fender-canvas/consensus-scores";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";

function points(value: number): string {
  return `${value.toFixed(1)} points`;
}

function PillarRow({ row, partial }: { row: ConsensusWeightRow; partial: PartialFigure | null }) {
  if (!row.included || row.score == null) {
    return (
      <div className="consensus-component-row" data-consensus-weight-row={row.id} data-consensus-included="false">
        <div className="consensus-component-name">{row.title}</div>
        <div className="consensus-component-bar-wrap">
          <span className="metric-card-sub">Not included</span>
        </div>
        <div className="consensus-component-meta" />
      </div>
    );
  }
  const status = scoreStatus(row.score);
  return (
    <div className="consensus-component-row" data-consensus-weight-row={row.id} data-consensus-included="true">
      <div className="consensus-component-name">{row.title}</div>
      <div className="consensus-component-bar-wrap">
        <div className="readiness-progress-bar" aria-hidden="true">
          <div
            className="readiness-progress-fill"
            style={{ width: `${Math.max(0, Math.min(100, row.score))}%`, background: CHART_COLORS.measured }}
          />
        </div>
        <span
          className="consensus-component-score"
          data-consensus-weight-score=""
          style={status ? { color: scoreToneColor(row.score) } : undefined}
        >
          <PartialFigureMark partial={partial} testId={`consensus-weights-${row.id}`}>
            {scoreFigure(row.score)}
          </PartialFigureMark>
        </span>
        {status ? <StatusMark status={status} /> : null}
      </div>
      <div className="consensus-component-meta">
        <span data-consensus-weight="">Weight {formatPct(row.weight)}</span>
        <span data-consensus-contribution="">{points(row.contribution ?? 0)}</span>
      </div>
    </div>
  );
}

/**
 * SC-04: how the pillar scores are weighted to make AI Consensus. Opens full-width under the
 * score cards, the same way the AI Foundation and AI Commerce components do.
 */
export function ConsensusWeightBreakdown({ consensus, id }: { consensus: ConsensusScore; id?: string }) {
  const rows = consensusWeightRows(consensus);
  const total = rows.reduce((sum, row) => sum + (row.contribution ?? 0), 0);
  return (
    <div
      className="content-box consensus-component-bars"
      data-consensus-weights=""
      id={id}
      style={{ marginTop: 12, width: "100%", boxSizing: "border-box" }}
    >
      <div className="consensus-component-head">
        <span>{SCORE_CARD_TITLES.consensus} weights</span>
      </div>
      {rows.map((row) => (
        <PillarRow key={row.id} row={row} partial={pillarPartial(consensus[row.id])} />
      ))}
      {consensus.score != null ? (
        <div className="consensus-component-row consensus-weight-total" data-consensus-weight-total="">
          <div className="consensus-component-name">{SCORE_CARD_TITLES.consensus}</div>
          <div className="consensus-component-bar-wrap">
            <span className="consensus-component-score" style={{ color: scoreToneColor(consensus.score) }}>
              <PartialFigureMark partial={consensusPartial(consensus)} testId="consensus-weights-total">
                {scoreFigure(consensus.score)}
              </PartialFigureMark>
            </span>
          </div>
          <div className="consensus-component-meta">
            <span>
              {formatRatio(consensus.coverage.numerator, consensus.coverage.denominator)} pillars
            </span>
            <span data-consensus-contribution-total="">{points(total)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
