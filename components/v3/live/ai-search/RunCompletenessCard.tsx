"use client";

import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { formatRunTime } from "@/lib/ai-search/run-metrics";
import {
  answeredOfCallsLine,
  engineModelLine,
  errorLine,
  runStateLabel,
  summarizeRun,
} from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { distinctCallRunIds, isWindowHistoryKind } from "@/lib/ai-search/window-display";
import { formatInt } from "@/lib/fender-canvas/format";

const SIM = AI_TABS.simulations;

/** Single-run completeness, including partial wording. */
function SingleRunCard({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const s = summarizeRun(snapshot);
  const { run } = snapshot;
  const rowsShort = s.completeness.expected != null && s.completeness.rowsRead < s.completeness.expected;
  return (
    <div className="content-box ai-run-card">
      <div className="content-box-title">
        <span>Run completeness</span>
        <span className={`tag-badge ${s.completeness.isPartial ? "tag-warning" : "tag-success"}`}>
          {runStateLabel(s.completeness.state)}
        </span>
      </div>
      <table className="table-sm">
        <tbody>
          <tr><td>Run</td><td style={{ wordBreak: "break-all" }}>{run.audit_run_id}</td></tr>
          <tr><td>Prompt set</td><td style={{ wordBreak: "break-all" }}>{run.prompt_set_hash ?? "Not recorded"}</td></tr>
          <tr><td>Collector</td><td>{run.collector_version ?? "Not recorded"}</td></tr>
          <tr><td>Started</td><td>{formatRunTime(run.started_at)}</td></tr>
          <tr><td>Completed</td><td>{formatRunTime(run.completed_at)}</td></tr>
          <tr><td>Published</td><td>{formatRunTime(run.published_at)}</td></tr>
          <tr><td>Expected calls</td><td>{run.expected_calls == null ? "Not recorded" : formatInt(run.expected_calls)}</td></tr>
          <tr><td>Answered calls</td><td>{run.answered_calls == null ? "Not recorded" : formatInt(run.answered_calls)}</td></tr>
          <tr>
            <td>Provider errors</td>
            <td>
              <EvidenceLink focus={{ field: "outcome", value: "error" }} tab={SIM}>
                {errorLine(s)}
              </EvidenceLink>
            </td>
          </tr>
          <tr><td>Missing answers</td><td>{run.missing_calls == null ? "Not recorded" : formatInt(run.missing_calls)}</td></tr>
          <tr><td>Engines and models</td><td>{engineModelLine(s.enginesAndModels)}</td></tr>
        </tbody>
      </table>
      {s.completeness.isPartial ? (
        <p style={{ ...mutedText, marginTop: 8 }}>
          This run is partial. Every figure below covers answered calls only. Unanswered calls are not losses.
        </p>
      ) : null}
      {rowsShort ? (
        <p style={{ ...mutedText, marginTop: 8, color: "var(--warning-text)" }}>
          The read returned {formatInt(s.completeness.rowsRead)} call rows for {formatInt(s.completeness.expected)} expected calls.
        </p>
      ) : null}
    </div>
  );
}

/** Pooled month / range / all: run count and answered rows, not a restatement of the pill. */
function WindowCard({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const s = summarizeRun(snapshot);
  const runIds = distinctCallRunIds(snapshot);
  return (
    <div className="content-box ai-run-card" data-ai-window-completeness>
      <div className="content-box-title">
        <span>Calls</span>
        <span className="tag-badge tag-neutral">
          {runIds.length} {runIds.length === 1 ? "run" : "runs"}
        </span>
      </div>
      <table className="table-sm">
        <tbody>
          <tr><td>Runs in this selection</td><td>{runIds.length}</td></tr>
          <tr>
            <td>Provider errors</td>
            <td>
              <EvidenceLink focus={{ field: "outcome", value: "error" }} tab={SIM}>
                {errorLine(s)}
              </EvidenceLink>
            </td>
          </tr>
          <tr><td>Engines and models</td><td>{engineModelLine(s.enginesAndModels)}</td></tr>
          <tr>
            <td>Calls in this selection</td>
            <td data-ai-window-calls>{answeredOfCallsLine(s.completeness)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function RunCompletenessCard({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const kind = history?.mode.kind;
  if (history && isWindowHistoryKind(kind)) {
    return <WindowCard snapshot={snapshot} />;
  }
  return <SingleRunCard snapshot={snapshot} />;
}
