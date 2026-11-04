"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { READ_ERROR_TITLE } from "@/components/v3/live/ai-search/AiReadGate";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { RunHistoryCalendar } from "@/components/v3/live/ai-search/RunHistoryCalendar";
import { useApiRunCatalog } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { apiRunDay, daysApart, nearestApiRun } from "@/lib/ai-search/api-runs";
import { formatDay, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { LAST_30_DAYS_LABEL } from "@/lib/ai-search/default-window";
import { batteryGaps } from "@/lib/ai-search/prompt-battery";
import {
  citationStorageCaution,
  hasPartialCoverage,
  previousReviewRun,
  reviewCatalog,
  scoringLabel,
  STORED_RUN_COPY_LABEL,
} from "@/lib/ai-search/review-runs";
import { historyFixtureSnapshot } from "@/lib/ai-search/history-fixtures";
import { API_NOT_AVAILABLE_TIPS } from "@/lib/ai-search/engine-group-read";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import { runStateLabel } from "@/lib/ai-search/summary";

function monthOf(day: string | null): { year: number; month: number } {
  if (!day) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  }
  const [year, month] = day.split("-").map(Number);
  return { year, month: month - 1 };
}

const PAIRED_API_TIP =
  "API engines run on their own schedule. This run is shown with the counted API run nearest its day when the Engines switch is on All or API only.";

/** The counted API run the Engines switch shows beside this run. */
function PairedApiRun({ day }: { day: string | null }) {
  const catalog = useApiRunCatalog();
  if (catalog.phase === "off" || !day) return null;
  let text: ReactNode;
  if (catalog.phase === "loading") text = "Loading";
  else if (catalog.phase === "missing" || catalog.phase === "error") {
    text = (
      <CopyTip
        label="API run"
        description={catalog.phase === "error" ? `${API_NOT_AVAILABLE_TIPS.failed} ${catalog.message}` : API_NOT_AVAILABLE_TIPS.missing}
      >
        Not available*
      </CopyTip>
    );
  } else {
    const paired = nearestApiRun(catalog.runs, day);
    const pairedDay = paired ? apiRunDay(paired) : null;
    if (!paired || !pairedDay) text = "No counted API run";
    else {
      const apart = daysApart(pairedDay, day);
      const engines = (paired.engines ?? []).map(engineLabel).join(", ");
      text = (
        <CopyTip label="API run" description={PAIRED_API_TIP}>
          {formatDay(pairedDay)}
          {apart === 0 ? " (same day)" : ` (${apart} day${apart === 1 ? "" : "s"} ${pairedDay < day ? "before" : "after"})`}
          {engines ? ` · ${engines}` : ""}
        </CopyTip>
      );
    }
  }
  return <li data-ai-history-api-run={catalog.phase}>API run beside it: {text}</li>;
}

function RunDetail({ run }: { run: HistoryRunSummary }) {
  const day = utcDay(run.published_at ?? run.completed_at);
  const answered = run.answered_calls == null ? "Not recorded" : `${run.answered_calls} answered`;
  const expected = run.expected_calls == null ? null : `${run.expected_calls} expected`;
  const scoring = scoringLabel(run);
  const caution = citationStorageCaution(run.audit_run_id);
  const snapshot = historyFixtureSnapshot(run.audit_run_id);
  const gaps = snapshot ? batteryGaps(snapshot.calls) : [];
  return (
    <div className="ai-history-detail" data-ai-history-run={run.audit_run_id}>
      <strong>{day ? formatDay(day) : "Date not recorded"}</strong>
      <ul>
        <li>State: {run.run_state ? runStateLabel(run.run_state) : "Not recorded"}{hasPartialCoverage(run) ? " · Partial coverage" : ""}</li>
        <li>Published: {run.published_at ? formatDay(utcDay(run.published_at) ?? "") : "Not published"}</li>
        <li>Collector: {run.collector_version ?? "Not recorded"}</li>
        {scoring ? <li data-ai-history-scoring={run.audit_run_id}>{scoring}</li> : null}
        <li>Answered: {answered}{expected ? ` of ${expected}` : ""}</li>
        <li>Provider errors: {run.error_calls == null ? "Not recorded" : run.error_calls}</li>
        <li>Prompt set: {run.prompt_set_hash ?? "Not recorded"}</li>
        {caution ? <li data-ai-citation-caution={run.audit_run_id}>{caution}</li> : null}
        <PairedApiRun day={day} />
      </ul>
      {gaps.length > 0 ? (
        <div data-ai-history-gaps={run.audit_run_id}>
          <p>Not stored. These calls are gaps, not wins, losses, or zeros.</p>
          <ul>
            {gaps.map((gap) => (
              <li key={`${gap.promptKey}:${gap.engine}`} data-ai-history-gap={`${gap.promptKey}:${gap.engine}`}>
                {engineLabel(gap.engine)}: {gap.promptText}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function RunHistoryControl() {
  const history = useAiHistory();
  const [open, setOpen] = useState(false);
  const [pickingRange, setPickingRange] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const runs = history.catalog.phase === "ready" ? history.catalog.runs : [];
  const visible = reviewCatalog(runs);
  const anchorId = history.current.phase === "ready" ? history.current.snapshot.run.audit_run_id : null;
  const previous = previousReviewRun(visible, history.source === "live" ? anchorId : null);
  const latest = [...visible].at(-1);
  const latestDay = utcDay(latest?.published_at ?? latest?.completed_at ?? null);
  const [month, setMonth] = useState(monthOf(latestDay));

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusables = () =>
      [...(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)") ?? [])];
    focusables()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const trigger = buttonRef.current;
    const place = () => {
      if (!dialog || !trigger) return;
      const available = window.innerHeight - trigger.getBoundingClientRect().bottom - 16;
      dialog.style.maxHeight = `${Math.max(220, Math.floor(available))}px`;
    };
    place();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      trigger?.focus();
    };
  }, [open]);

  function pickDay(day: string) {
    if (!pickingRange) {
      setSelectedDay(day);
      return;
    }
    if (!rangeStart || rangeEnd) {
      setRangeStart(day);
      setRangeEnd(null);
      setSelectedDay(day);
      return;
    }
    setRangeEnd(day);
    setSelectedDay(day);
  }

  const chosen = selectedDay
    ? visible.filter((run) => utcDay(run.published_at ?? run.completed_at) === selectedDay)
    : [];
  const chosenRun = chosen.find((run) => run.audit_run_id === pickedId) ?? (chosen.length === 1 ? chosen[0] : null);

  return (
    <div className="ai-history-control">
      <button
        ref={buttonRef}
        type="button"
        className="ai-history-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-ai-history-trigger
        onClick={() => setOpen((value) => !value)}
      >
        {history.controlLabel} ▾
      </button>
      {open ? (
        <div
          ref={dialogRef}
          className="ai-history-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-ai-history-dialog
        >
          <h3 id={titleId}>Choose a run</h3>
          <div className="ai-history-dialog-body">
          {history.source === "fixture" ? (
            <p className="ai-history-note" data-ai-history-fixture>
              {STORED_RUN_COPY_LABEL} The default is the last 30 days of published review runs. The map stays on the live published run.
            </p>
          ) : null}
          <div className="ai-history-quick" role="group" aria-label="Quick choices">
            <button
              type="button"
              aria-pressed={history.mode.kind === "month"}
              data-ai-history-last-30-days
              onClick={() => { history.viewMonth(); setOpen(false); }}
            >
              {LAST_30_DAYS_LABEL}
            </button>
            <button
              type="button"
              disabled={history.current.phase !== "ready"}
              aria-pressed={history.mode.kind === "run" && history.mode.runId === anchorId}
              data-ai-history-latest-run
              onClick={() => { history.viewPublished(); setOpen(false); }}
            >
              Latest run
            </button>
            <button
              type="button"
              disabled={!previous}
              onClick={() => {
                if (!previous) return;
                history.viewRun(previous.audit_run_id);
                setOpen(false);
              }}
            >
              Previous run
            </button>
            <button type="button" aria-pressed={pickingRange} onClick={() => setPickingRange(true)}>
              Date range
            </button>
            <button type="button" onClick={() => { history.viewAll(); setOpen(false); }}>All time</button>
          </div>
          {history.catalog.phase === "loading" ? <p className="ai-history-note">Loading runs.</p> : null}
          {history.catalog.phase === "error" ? (
            <p className="ai-history-note">
              Run history{" "}
              <CopyTip label={READ_ERROR_TITLE} description={history.catalog.message}>
                did not load
              </CopyTip>
              .
            </p>
          ) : null}
          {history.catalog.phase === "ready" ? (
            <RunHistoryCalendar
              runs={visible}
              month={month}
              onMonth={setMonth}
              selectedDay={selectedDay}
              rangeStart={pickingRange ? rangeStart : null}
              rangeEnd={pickingRange ? rangeEnd : null}
              onPick={pickDay}
            />
          ) : null}
          {chosen.length > 1 ? (
            <div className="ai-history-quick" role="group" aria-label="Runs on this date">
              {chosen.map((run) => (
                <button
                  key={run.audit_run_id}
                  type="button"
                  aria-pressed={chosenRun?.audit_run_id === run.audit_run_id}
                  onClick={() => setPickedId(run.audit_run_id)}
                >
                  {scoringLabel(run) ?? run.collector_version ?? "Run"} · {run.is_published ? "Published" : "Unpublished"}
                </button>
              ))}
            </div>
          ) : null}
          {chosen.map((run) => (
            <RunDetail key={run.audit_run_id} run={run} />
          ))}
          </div>
          <div className="ai-history-actions">
            {pickingRange ? (
              <button
                type="button"
                disabled={!rangeStart || !rangeEnd}
                onClick={() => {
                  if (!rangeStart || !rangeEnd) return;
                  history.viewRange(rangeStart, rangeEnd);
                  setOpen(false);
                }}
              >
                View trends
              </button>
            ) : (
              <button
                type="button"
                disabled={!chosenRun}
                data-ai-history-view-run
                onClick={() => {
                  if (!chosenRun) return;
                  history.viewRun(chosenRun.audit_run_id);
                  setOpen(false);
                }}
              >
                View run
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
