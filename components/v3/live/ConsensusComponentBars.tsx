"use client";

import "@/components/v3/live/summary.css";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { CHART_COLORS } from "@/lib/canvas-sdk/data-status";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import { scoreStatus, scoreToneColor } from "@/lib/fender-canvas/consensus-score-display";
import type {
  DroppedComponent,
  PillarScore,
  ScoredComponent,
} from "@/lib/fender-canvas/consensus-scores";

function PlaceholderMark({
  title,
  tooltip,
}: {
  title: string;
  tooltip: string;
}) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={tooltip}
      tabIndex={0}
      aria-label={`${title}: ${tooltip}`}
    >
      *
    </span>
  );
}

function ComponentName({ row }: { row: ScoredComponent | DroppedComponent }) {
  return (
    <>
      {row.name}
      {row.placeholder && row.placeholderTooltip ? (
        <>
          {" "}
          <PlaceholderMark
            title={row.placeholderTitle ?? row.name}
            tooltip={row.placeholderTooltip}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * One included component. The bar is a chart, so it is drawn in the measured ice blue; the
 * status color, mark, and word sit on the figure beside it (decision 27).
 */
function IncludedBar({ row }: { row: ScoredComponent }) {
  const status = scoreStatus(row.score);
  return (
    <div
      className="consensus-component-row"
      data-consensus-component={row.id}
      data-consensus-included="true"
    >
      <div className="consensus-component-name">
        <ComponentName row={row} />
      </div>
      <div className="consensus-component-bar-wrap">
        <div className="readiness-progress-bar" aria-hidden="true">
          <div
            className="readiness-progress-fill"
            style={{
              width: `${Math.max(0, Math.min(100, row.score))}%`,
              background: CHART_COLORS.measured,
            }}
          />
        </div>
        <span
          className="consensus-component-score"
          data-consensus-component-score=""
          style={status ? { color: scoreToneColor(row.score) } : undefined}
        >
          {formatPct(row.score)}
        </span>
        {status ? <StatusMark status={status} /> : null}
      </div>
      <div className="consensus-component-meta">
        <span data-consensus-component-weight="">Weight {formatPct(row.weight)}</span>
        <span data-consensus-component-coverage="">
          {formatRatio(row.coverage.numerator, row.coverage.denominator)}
        </span>
      </div>
    </div>
  );
}

function DroppedBar({ row }: { row: DroppedComponent }) {
  return (
    <div
      className="consensus-component-row"
      data-consensus-component={row.id}
      data-consensus-included="false"
    >
      <div className="consensus-component-name">
        <ComponentName row={row} />
      </div>
      <div className="consensus-component-bar-wrap">
        <span className="metric-card-sub">Not included</span>
      </div>
      <div className="consensus-component-meta" />
    </div>
  );
}

/** Full-width component rows under the hero band. Dropped components never show 0. */
export function ConsensusComponentBars({
  pillar,
  id,
}: {
  pillar: PillarScore;
  id?: string;
}) {
  if (!pillar.included) return null;
  return (
    <div
      className="content-box consensus-component-bars"
      data-consensus-components={pillar.id}
      id={id}
      style={{ marginTop: 12, width: "100%", boxSizing: "border-box" }}
    >
      <div className="consensus-component-head">
        <span>{pillar.name} components</span>
      </div>
      {pillar.components.map((row) =>
        row.included ? <IncludedBar key={row.id} row={row} /> : <DroppedBar key={row.id} row={row} />,
      )}
    </div>
  );
}
