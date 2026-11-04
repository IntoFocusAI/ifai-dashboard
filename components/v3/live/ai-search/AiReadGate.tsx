"use client";

import type { ReactNode } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { NoMonthRunNotice } from "@/components/v3/live/ai-search/NoMonthRunNotice";
import { selectionLine, selectionSubject } from "@/lib/ai-search/displayed-read";
import { LATEST_MONTH_LABEL } from "@/lib/ai-search/history-mode";
import { errorLine, runStateLabel, summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import { isWindowHistoryKind } from "@/lib/ai-search/window-display";

export const mutedText = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 } as const;

export const READ_ERROR_TITLE = "Database error";

function Notice({ heading, children, tone }: { heading: ReactNode; children: ReactNode; tone: string }) {
  return (
    <div className="content-box" data-ai-state={tone}>
      <div className="content-box-title">{heading}</div>
      <p style={mutedText}>{children}</p>
    </div>
  );
}

/** The history selection failed or is empty. The published run is offered when it loaded. */
function SelectionNotice({ read }: { read: Extract<AiSearchRead, { phase: "error" }> }) {
  const history = useAiHistoryOptional();
  const single = history?.mode.kind === "run";
  const published = history?.current.phase ?? "loading";
  const publishedLine = {
    ready: `The published run loaded. Show it here, or pick another ${single ? "run" : "period"} from the date menu above.`,
    loading: "The published run is still loading.",
    error: "The published AI run did not load either.",
    "no-run": "No AI run has been published yet.",
  }[published];
  const heading =
    read.selection === "empty" ? (
      selectionLine("empty", single)
    ) : (
      <span>
        The {selectionSubject(single)}{" "}
        <CopyTip label={READ_ERROR_TITLE} description={read.message}>
          did not load
        </CopyTip>
      </span>
    );
  return (
    <Notice heading={heading} tone="error">
      <span data-ai-selection-failed={read.selection}>{publishedLine}</span>
      {published === "ready" || single ? (
        <span className="segmented-control" role="group" aria-label="What to show" style={{ marginTop: 10 }}>
          {published === "ready" ? (
            <button type="button" className="segmented-btn" data-ai-show-published onClick={history?.viewPublished}>
              Show the published run
            </button>
          ) : null}
          {single ? (
            <button type="button" className="segmented-btn" data-ai-history-return onClick={history?.viewMonth}>
              {LATEST_MONTH_LABEL}
            </button>
          ) : null}
        </span>
      ) : null}
    </Notice>
  );
}

/** Run id, completion time, and answered counts. The pill already names the selection. */
export function RunFreshness({ snapshot, stale }: { snapshot: AiSearchSnapshot; stale?: boolean }) {
  const s = summarizeRun(snapshot);
  const { completeness: run } = s;
  const showState = run.isPartial || run.state !== "historical";
  return (
    <div
      className="ai-run-freshness"
      style={{ ...mutedText, fontSize: 11, display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}
    >
      {showState ? (
        <span className={`tag-badge ${run.isPartial ? "tag-warning" : "tag-success"}`}>
          {run.isPartial ? <AiTerm term="partial run">Partial run</AiTerm> : runStateLabel(run.state)}
        </span>
      ) : null}
      <span>
        {s.shortRunId} · completed {s.completedAt}
      </span>
      <span>
        {run.answered ?? "Unknown"} of {run.expected ?? "unknown"} calls answered · {errorLine(s)}
      </span>
      {stale ? <span className="tag-badge tag-warning">Refresh failed, showing the last good read</span> : null}
    </div>
  );
}

/** Loading, failed, and missing reads never fall through to zeros or demo figures. */
export function AiReadGate({
  children,
  showFreshness = true,
}: {
  children: (snapshot: AiSearchSnapshot) => ReactNode;
  /** The run pill already names the selected run, so a tab can skip the status line. */
  showFreshness?: boolean;
}) {
  return (
    <div className="ai-search-panel">
      <GateBody showFreshness={showFreshness}>{children}</GateBody>
    </div>
  );
}

function GateBody({
  children,
  showFreshness,
}: {
  children: (snapshot: AiSearchSnapshot) => ReactNode;
  showFreshness: boolean;
}) {
  const read = useAiSearch();
  const history = useAiHistoryOptional();
  const historical = history?.mode.kind === "run";
  if (historical && history.selected.phase === "unavailable") {
    return (
      <Notice heading="Historical calls are not available" tone="unavailable">
        {history.selected.message}
        <span style={{ display: "block", marginTop: 8 }}>
          <button type="button" data-ai-history-return onClick={history.viewMonth}>
            {LATEST_MONTH_LABEL}
          </button>
        </span>
      </Notice>
    );
  }
  if (historical && (history.selected.phase === "loading" || history.selected.phase === "idle")) {
    return (
      <Notice heading="Loading the historical run" tone="loading">
        Reading the calls stored for that run. No rate is shown until they load.
      </Notice>
    );
  }
  if (read.phase === "loading") {
    const windowed =
      history != null &&
      (history.mode.kind === "month" || history.mode.kind === "range" || history.mode.kind === "all");
    if (windowed) {
      return (
        <Notice heading="Loading the stored review runs" tone="loading">
          The stored review runs in this selection are loading. No rate is shown until they load.
        </Notice>
      );
    }
    return (
      <Notice heading="Loading the published AI run" tone="loading">
        Reading the published AI run. Figures appear when it loads.
      </Notice>
    );
  }
  if (read.phase === "error" && read.selection === "empty" && history?.mode.kind === "month") return <NoMonthRunNotice />;
  if (read.phase === "error" && read.selection) return <SelectionNotice read={read} />;
  if (read.phase === "error") {
    return (
      <Notice heading="The AI run did not load" tone="error">
        The published AI run did not load, so no AI Search figure is shown. {read.message}
        {historical ? (
          <span style={{ display: "block", marginTop: 8 }}>
            <button type="button" data-ai-history-return onClick={history.viewMonth}>
              {LATEST_MONTH_LABEL}
            </button>
          </span>
        ) : null}
      </Notice>
    );
  }
  if (read.phase === "no-run") {
    return (
      <Notice heading="No published AI run" tone="empty">
        No AI run has been published yet. Figures appear once IntoFocus publishes a completed or partial run.
      </Notice>
    );
  }
  if (historical && read.snapshot.calls.length === 0) {
    return (
      <Notice heading="Call rows did not load" tone="unavailable">
        Call rows for this run did not load, so no rate is shown.
        <span style={{ display: "block", marginTop: 8 }}>
          <button type="button" data-ai-history-return onClick={history.viewMonth}>
            {LATEST_MONTH_LABEL}
          </button>
        </span>
      </Notice>
    );
  }
  const windowed = Boolean(history && isWindowHistoryKind(history.mode.kind));
  return (
    <div data-ai-state={windowed ? "selection" : read.snapshot.run.run_state}>
      {showFreshness && !windowed ? (
        <RunFreshness snapshot={read.snapshot} stale={read.stale} />
      ) : null}
      {children(read.snapshot)}
    </div>
  );
}

export function EmptyRows({ children }: { children: ReactNode }) {
  return (
    <p className="ai-empty" style={{ ...mutedText, fontStyle: "italic" }}>
      {children}
    </p>
  );
}
