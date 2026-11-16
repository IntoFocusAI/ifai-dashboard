"use client";

import "@/components/v3/live/summary.css";
import { useEffect, useMemo, useState } from "react";
import { activeClient } from "@/lib/client/active-client";
import { scoreAgainstTarget, CONSENSUS_SCORE_TARGET } from "@/lib/fender-canvas/consensus-score-display";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import {
  loadScoreHistory,
  SCORE_SNAPSHOT_TABLE,
  scoreHistoryFailureTip,
  scoreHistoryModel,
  scoreHistoryTip,
  weekLabel,
  type ScoreHistoryClient,
  type ScoreHistoryModel,
  type ScoreHistoryRead,
  type ScoreSeriesKey,
} from "@/lib/fender-canvas/score-history";
import { formatDay } from "@/lib/ai-search/history-eligibility";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

const TITLE = "Scores over time";

/* Brand chart tokens (X-34): two ice-blue series, then grays. Status colors stay off charts. */
const SERIES_COLOR: Record<ScoreSeriesKey, string> = {
  consensus: "var(--chart-measured)",
  foundation: "var(--chart-second)",
  commerce: "var(--text-muted)",
  actuation: "var(--chart-rest)",
};

/** The client's saved weeks, read once per page load with the public (read-only) client. */
function useScoreHistory(): ScoreHistoryRead {
  const [read, setRead] = useState<ScoreHistoryRead>({ phase: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      let next: ScoreHistoryRead;
      try {
        const client = getPublicCanvasSupabase() as unknown as ScoreHistoryClient;
        next = await loadScoreHistory(client, activeClient().setAsideKey);
      } catch (error) {
        next = { phase: "error", message: error instanceof Error ? error.message : String(error) };
      }
      if (live) setRead(next);
    })();
    return () => {
      live = false;
    };
  }, []);
  return read;
}

function xFor(index: number, count: number): number {
  if (count < 2) return 50;
  return 8 + (index / (count - 1)) * 84;
}

function yFor(score: number): number {
  return 8 + (1 - Math.max(0, Math.min(100, score)) / 100) * 80;
}

/** At most six week labels, first and last always, spaced evenly between. */
function axisWeeks(weeks: readonly string[]): number[] {
  if (weeks.length <= 6) return weeks.map((_, index) => index);
  const step = (weeks.length - 1) / 5;
  return [...new Set(Array.from({ length: 6 }, (_, index) => Math.round(index * step)))];
}

function ChartBody({ model, hidden }: { model: ScoreHistoryModel; hidden: ReadonlySet<ScoreSeriesKey> }) {
  const index = new Map(model.weeks.map((week, at) => [week, at]));
  const count = model.weeks.length;
  const visible = model.series.filter((line) => !hidden.has(line.key));
  return (
    <div className="score-history-chart" data-score-history-chart="">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[0, 50, 100].map((mark) => (
          <line key={mark} x1="8" x2="92" y1={yFor(mark)} y2={yFor(mark)} stroke="var(--border-color)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <line
          data-score-history-target=""
          x1="8"
          x2="92"
          y1={yFor(CONSENSUS_SCORE_TARGET)}
          y2={yFor(CONSENSUS_SCORE_TARGET)}
          stroke="var(--text-main)"
          strokeOpacity="0.55"
          strokeDasharray="5 4"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
        {visible.map((line) =>
          line.points.length < 2 ? null : (
            <polyline
              key={line.key}
              data-score-history-line={line.key}
              fill="none"
              stroke={SERIES_COLOR[line.key]}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              points={line.points.map((point) => `${xFor(index.get(point.week) ?? 0, count)},${yFor(point.score)}`).join(" ")}
            />
          ),
        )}
      </svg>
      <div className="score-history-ylabels" aria-hidden="true">
        {[100, 50, 0].map((mark) => (
          <span key={mark} style={{ top: `${yFor(mark)}%` }}>
            {mark}
          </span>
        ))}
      </div>
      <span className="score-history-target-label" style={{ top: `${yFor(CONSENSUS_SCORE_TARGET)}%` }}>
        Target {CONSENSUS_SCORE_TARGET}
      </span>
      {visible.flatMap((line) =>
        line.points.map((point) => {
          const figure = scoreAgainstTarget(point.score) ?? "";
          return (
            <span
              key={`${line.key}:${point.week}`}
              className="score-history-point ifai-term"
              data-score-history-point={line.key}
              style={{ left: `${xFor(index.get(point.week) ?? 0, count)}%`, top: `${yFor(point.score)}%`, color: SERIES_COLOR[line.key] }}
              data-ifai-tooltip-title={`${line.label} · ${weekLabel(point.week)}`}
              data-ifai-tooltip-desc={count < 2 ? `${figure}. ${scoreHistoryTip(model)}` : `${figure}.`}
              tabIndex={0}
              role="img"
              aria-label={`${line.label}, ${weekLabel(point.week)}: ${figure}`}
            >
              <span className="score-history-dot" />
            </span>
          );
        }),
      )}
      <div className="score-history-xlabels" aria-hidden="true">
        {axisWeeks(model.weeks).map((at) => (
          <span key={model.weeks[at]} style={{ left: `${xFor(at, count)}%` }}>
            {formatDay(model.weeks[at])}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The chart section when the saved scores could not be read. */
function ScoreHistoryFailed({ message }: { message: string }) {
  const tip = scoreHistoryFailureTip(message);
  return (
    <details className="content-box score-history" open data-score-history="" data-score-history-failed="">
      <summary className="content-box-title">{TITLE}</summary>
      <span
        className="ifai-term"
        data-ifai-tooltip-title={READ_NOT_AVAILABLE}
        data-ifai-tooltip-desc={tip}
        data-read-unavailable={SCORE_SNAPSHOT_TABLE}
        tabIndex={0}
        aria-label={`${READ_NOT_AVAILABLE}: ${tip}`}
      >
        {READ_NOT_AVAILABLE}
      </span>
    </details>
  );
}

/**
 * Summary → Performance (decision 94): a collapsible line chart of the saved weekly scores, one line
 * per score with a toggle each, and the target of 70 dashed. Every saved week shows; nothing is
 * filled in between. Before the table exists, or before any week is saved, the section shows nothing.
 * Any other failed read shows the section with Not available* and the reason in its tooltip (X-25).
 */
export function ScoreHistoryChart() {
  const read = useScoreHistory();
  const model = useMemo(() => (read.phase === "ready" ? scoreHistoryModel(read.rows) : null), [read]);
  const [hidden, setHidden] = useState<ReadonlySet<ScoreSeriesKey>>(() => new Set());
  if (read.phase === "error") return <ScoreHistoryFailed message={read.message} />;
  if (!model || model.series.length === 0) return null;

  function toggle(key: ScoreSeriesKey) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const tip = scoreHistoryTip(model);
  return (
    <details className="content-box score-history" open data-score-history="">
      <summary className="content-box-title">
        <span className="ifai-term" data-ifai-tooltip-title={TITLE} data-ifai-tooltip-desc={tip} tabIndex={0} aria-label={`${TITLE}: ${tip}`}>
          {TITLE}
        </span>
      </summary>
      <div className="score-history-toggles" role="group" aria-label="Scores shown">
        {model.series.map((line) => {
          const on = !hidden.has(line.key);
          return (
            <button
              key={line.key}
              type="button"
              className={`segmented-btn${on ? " active" : ""}`}
              aria-pressed={on}
              data-score-history-toggle={line.key}
              onClick={() => toggle(line.key)}
            >
              <span className="score-history-swatch" style={{ background: SERIES_COLOR[line.key] }} aria-hidden="true" />
              {line.label}
            </button>
          );
        })}
      </div>
      <ChartBody model={model} hidden={hidden} />
    </details>
  );
}
