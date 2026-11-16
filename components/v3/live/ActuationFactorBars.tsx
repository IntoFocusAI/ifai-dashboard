"use client";

import "@/components/v3/live/summary.css";
import { useMemo } from "react";
import { useSummaryAiRead } from "@/components/v3/live/useSummaryAiRead";
import { brandName } from "@/lib/brand-copy";
import { CHART_COLORS } from "@/lib/canvas-sdk/data-status";
import { actuationFactorRows, type ActuationFactorRow } from "@/lib/fender-canvas/actuation-display";
import { ownedAnswersFromAi } from "@/lib/fender-canvas/actuation-e1";
import type { ActuationScore } from "@/lib/fender-canvas/actuation-score";

function FactorName({ row }: { row: ActuationFactorRow }) {
  if (!row.tip) return <>{row.name}</>;
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={row.name}
      data-ifai-tooltip-desc={row.tip}
      data-actuation-factor-tip={row.id}
      tabIndex={0}
      aria-label={`${row.name}: ${row.tip}`}
    >
      {row.name}
    </span>
  );
}

/**
 * One factor: its name, its points against its weight as a measured bar (a chart, so ice blue, no
 * status color), and the basis behind the points. A lapsed factor reads like one never in place.
 */
function FactorRow({ row }: { row: ActuationFactorRow }) {
  const fill = row.weight > 0 ? (100 * row.points) / row.weight : 0;
  return (
    <div className="consensus-component-row actuation-factor-row" data-actuation-factor={row.id}>
      <div className="consensus-component-name">
        <FactorName row={row} />
      </div>
      <div className="consensus-component-bar-wrap">
        <div className="readiness-progress-bar" aria-hidden="true">
          <div
            className="readiness-progress-fill"
            style={{ width: `${Math.max(0, Math.min(100, fill))}%`, background: CHART_COLORS.measured }}
          />
        </div>
        <span className="consensus-component-score" data-actuation-factor-points="">
          {row.pointsLabel}
        </span>
      </div>
      <div className="actuation-factor-basis" data-actuation-factor-basis="">
        {row.basis}
      </div>
    </div>
  );
}

/**
 * SC-03: the AI Actuation factors and their basis (P1, P2, E1, E2, E3). The client sees points,
 * counts, and dates only. E1 reads the date-pill window's Citation Ecosystem data, as Summary does.
 */
export function ActuationFactorBars({
  score,
  id,
  title = "AI Actuation Score factors",
}: {
  score: ActuationScore;
  id?: string;
  title?: string;
}) {
  const ai = useSummaryAiRead();
  const owned = useMemo(() => ownedAnswersFromAi(ai), [ai]);
  const rows = actuationFactorRows(score, owned, brandName());
  return (
    <div
      className="content-box consensus-component-bars"
      data-actuation-factors=""
      id={id}
      style={{ marginTop: 12, width: "100%", boxSizing: "border-box" }}
    >
      <div className="consensus-component-head">
        <span>{title}</span>
      </div>
      {rows.map((row) => (
        <FactorRow key={row.id} row={row} />
      ))}
    </div>
  );
}
