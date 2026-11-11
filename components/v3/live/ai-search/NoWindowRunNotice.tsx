"use client";

import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { formatDay, utcDay } from "@/lib/ai-search/history-eligibility";
import { NO_WINDOW_RUN_HEADING, noWindowRunLine } from "@/lib/ai-search/default-window";

/** The last 30 days hold no published run with answered calls. The latest run stays one click away. */
export function NoWindowRunNotice() {
  const history = useAiHistoryOptional();
  const latest = history?.current.phase === "ready" ? history.current.snapshot.run : null;
  const latestDay = latest ? utcDay(latest.published_at ?? latest.completed_at) : null;
  return (
    <div className="content-box" data-ai-state="empty" data-ai-window-empty>
      <div className="content-box-title">{NO_WINDOW_RUN_HEADING}</div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>{noWindowRunLine(history?.windowEnd)}</p>
      {latest ? (
        <span className="segmented-control" role="group" aria-label="What to show" style={{ marginTop: 10 }}>
          <button type="button" className="segmented-btn" data-ai-show-latest-run onClick={history?.viewPublished}>
            Show the latest run{latestDay ? ` · ${formatDay(latestDay)}` : ""}
          </button>
        </span>
      ) : null}
    </div>
  );
}
