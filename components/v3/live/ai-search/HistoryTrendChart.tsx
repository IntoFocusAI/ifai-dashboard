"use client";

import { formatDay } from "@/lib/ai-search/history-eligibility";
import { boundaryBreaks, rateLabel, trendSegments, type TrendModel, type TrendPoint } from "@/lib/ai-search/history-trends";

/* Brand chart tokens (X-34): two ice-blue series, then grays. Status colors stay off charts. */
const SERIES_COLOR = ["var(--chart-measured)", "var(--chart-second)", "var(--text-muted)", "var(--chart-rest)"];

function xFor(day: string, min: number, max: number): number {
  const time = Date.parse(`${day}T00:00:00Z`);
  if (max === min) return 50;
  return 12 + ((time - min) / (max - min)) * 76;
}

function yFor(pct: number): number {
  return 16 + (1 - pct / 100) * 68;
}

function sameDayShift(points: readonly TrendPoint[]): Map<string, number> {
  const byDay = new Map<string, string[]>();
  for (const point of points) {
    const list = byDay.get(point.day) ?? [];
    if (!list.includes(point.runId)) list.push(point.runId);
    byDay.set(point.day, list);
  }
  const shifts = new Map<string, number>();
  for (const [day, ids] of byDay) {
    ids.forEach((id, index) => {
      shifts.set(`${day}:${id}`, ids.length < 2 ? 0 : (index - (ids.length - 1) / 2) * 4);
    });
  }
  return shifts;
}

function pointX(
  point: TrendPoint,
  seriesIndex: number,
  seriesCount: number,
  min: number,
  max: number,
  shifts: Map<string, number>,
): number {
  return xFor(point.day, min, max) + (shifts.get(`${point.day}:${point.runId}`) ?? 0) + seriesIndex * 1.4 - (seriesCount - 1) * 0.7;
}

export function HistoryTrendChart({
  model,
  onPick,
  activeKey,
}: {
  model: TrendModel;
  onPick: (point: TrendPoint, seriesKey: string) => void;
  activeKey: string | null;
}) {
  const days = [...new Set(model.series.flatMap((series) => series.points.map((point) => point.day)))].sort();
  if (days.length === 0) return null;
  const times = days.map((day) => Date.parse(`${day}T00:00:00Z`));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const breaks = boundaryBreaks(model.boundaries);
  const shifts = sameDayShift(model.series[0]?.points ?? []);

  return (
    <div className="ai-history-chart" data-ai-history-chart>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[0, 50, 100].map((mark) => (
          <line key={mark} x1="8" x2="92" y1={yFor(mark)} y2={yFor(mark)} stroke="var(--border-color)" strokeWidth="0.4" />
        ))}
        {model.boundaries.map((boundary) => {
          const x = (xFor(boundary.afterDay, min, max) + xFor(boundary.beforeDay, min, max)) / 2;
          return (
            <line
              key={`${boundary.afterRunId}-${boundary.beforeRunId}`}
              x1={x}
              x2={x}
              y1="12"
              y2="88"
              stroke="var(--text-muted)"
              strokeDasharray="1.2 1.2"
              strokeWidth="0.6"
            />
          );
        })}
        {model.series.map((series, seriesIndex) =>
          trendSegments(series.points, breaks).map((segment, segmentIndex) =>
            segment.length < 2 ? null : (
              <polyline
                key={`${series.key}-${segmentIndex}`}
                fill="none"
                stroke={SERIES_COLOR[seriesIndex % SERIES_COLOR.length]}
                strokeWidth="0.8"
                points={segment
                  .map((point) => {
                    const x = pointX(point, seriesIndex, model.series.length, min, max, shifts);
                    return `${x},${yFor(point.winPct ?? 0)}`;
                  })
                  .join(" ")}
              />
            ),
          ),
        )}
      </svg>
      <div className="ai-history-ylabels" aria-hidden="true">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      {model.series.map((series, seriesIndex) =>
        series.points.map((point) => {
          const plottable = point.callsLoaded && point.winPct != null;
          const x = pointX(point, seriesIndex, model.series.length, min, max, shifts);
          const y = plottable ? yFor(point.winPct ?? 0) : 94;
          const key = `${point.runId}:${series.key}`;
          return (
            <button
              key={key}
              type="button"
              className={`ai-history-point${activeKey === key ? " active" : ""}`}
              style={{ left: `${x}%`, top: `${y}%`, color: SERIES_COLOR[seriesIndex % SERIES_COLOR.length] }}
              data-ai-trend-point={key}
              aria-pressed={activeKey === key}
              aria-label={`${formatDay(point.day)} ${series.label} ${rateLabel(point)}`}
              onClick={() => onPick(point, series.key)}
            >
              <span className="ai-history-dot" />
            </button>
          );
        }),
      )}
      <p className="ai-history-note">Each point is one stored run. Nothing is estimated between runs.</p>
    </div>
  );
}
