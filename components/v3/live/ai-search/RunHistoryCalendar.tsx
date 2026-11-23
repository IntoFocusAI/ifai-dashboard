"use client";

import { useMemo, useState } from "react";
import { formatDay, runsOnDay, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { hasPartialCoverage } from "@/lib/ai-search/review-runs";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthCells(year: number, month: number): Array<string | null> {
  const start = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: start }, () => null);
  for (let date = 1; date <= count; date += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`);
  }
  return cells;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function RunHistoryCalendar({
  runs,
  month,
  onMonth,
  selectedDay,
  rangeStart,
  rangeEnd,
  onPick,
  anyDay = false,
}: {
  /**
   * The retail pill (mode "dates"): every day can be picked, not only days with an AI run (Brian
   * Magazu, 23 Nov 2026). The AI views leave it off.
   */
  anyDay?: boolean;
  runs: readonly HistoryRunSummary[];
  month: { year: number; month: number };
  onMonth: (next: { year: number; month: number }) => void;
  selectedDay: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  onPick: (day: string) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, HistoryRunSummary[]>();
    for (const run of runs) {
      const day = utcDay(run.published_at ?? run.completed_at);
      if (!day) continue;
      const list = map.get(day) ?? [];
      list.push(run);
      map.set(day, list);
    }
    return map;
  }, [runs]);
  const cells = monthCells(month.year, month.month);
  const enabled = cells.filter((day): day is string => day != null && (anyDay || byDay.has(day)));
  const [focusOverride, setFocusOverride] = useState<string | null>(null);
  const focusDay = focusOverride && enabled.includes(focusOverride) ? focusOverride : (enabled[0] ?? null);

  function move(from: string, delta: number) {
    const index = enabled.indexOf(from);
    if (index < 0) return;
    const next = enabled[index + delta];
    if (!next) return;
    setFocusOverride(next);
    queueMicrotask(() => {
      document.querySelector<HTMLButtonElement>(`[data-ai-history-day="${next}"]`)?.focus();
    });
  }

  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(month.year, month.month, 1)),
  );

  return (
    <div className="ai-history-calendar">
      <div className="ai-history-month">
        <button type="button" onClick={() => onMonth(shiftMonth(month.year, month.month, -1))} aria-label="Previous month">
          ‹
        </button>
        <span>{label}</span>
        <button type="button" onClick={() => onMonth(shiftMonth(month.year, month.month, 1))} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="ai-history-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div role="grid" aria-label={anyDay ? "Dates" : "Runs by date"} className="ai-history-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const present = byDay.get(day) ?? [];
          const enabledDay = anyDay || present.length > 0;
          const partial = present.some(hasPartialCoverage);
          const inRange = rangeStart && rangeEnd ? day >= rangeStart && day <= rangeEnd : false;
          const selected = day === selectedDay || day === rangeStart || day === rangeEnd;
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              disabled={!enabledDay}
              tabIndex={enabledDay && (focusDay === day || (!focusDay && day === enabled[0])) ? 0 : -1}
              aria-selected={selected}
              aria-label={
                anyDay
                  ? formatDay(day)
                  : enabledDay
                    ? `${formatDay(day)}, ${present.length} ${present.length === 1 ? "run" : "runs"}${partial ? ", partial coverage" : ""}`
                    : `${formatDay(day)}, no run`
              }
              className={`ai-history-day${enabledDay ? " has-run" : ""}${partial && !anyDay ? " partial" : ""}${selected ? " selected" : ""}${inRange ? " in-range" : ""}`}
              data-ai-history-day={day}
              data-ai-history-enabled={enabledDay ? "true" : "false"}
              data-ai-history-coverage={anyDay ? "any" : enabledDay ? (partial ? "partial" : "full") : "none"}
              onClick={() => {
                if (!enabledDay) return;
                setFocusOverride(day);
                onPick(day);
              }}
              onFocus={() => setFocusOverride(day)}
              onKeyDown={(event) => {
                const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
                if (!step) return;
                event.preventDefault();
                move(day, step);
              }}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      {enabled.length === 0 && !anyDay ? <p className="ai-history-note">No eligible runs in this month.</p> : null}
    </div>
  );
}

export function runsForSelection(runs: readonly HistoryRunSummary[], day: string | null): HistoryRunSummary[] {
  return day ? runsOnDay(runs, day) : [];
}
