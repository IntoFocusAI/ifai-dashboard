"use client";

import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import {
  CITATION_READ_ERROR_TITLE,
  citationErrorDetail,
  citationFailureCopy,
  type CitationFailedRead,
} from "@/lib/ai-search/citation-read-failure";

/** Names the read that failed and offers the published run. The database error is the tooltip. */
export function CitationReadFailed({ failed, message }: { failed: CitationFailedRead; message: string }) {
  const history = useAiHistoryOptional();
  const current = history?.current;
  const copy = citationFailureCopy(failed, current?.phase ?? null);
  const detail = citationErrorDetail(message);
  const publishedId = current?.phase === "ready" ? current.snapshot.run.audit_run_id : null;
  return (
    <div className="content-box" data-ai-state="error" data-citation-read-failed={failed}>
      <div className="content-box-title">
        <span>
          {copy.subject}{" "}
          <span
            className="ifai-term"
            data-citation-read-error
            data-ifai-tooltip-title={CITATION_READ_ERROR_TITLE}
            data-ifai-tooltip-desc={detail}
            tabIndex={0}
            aria-label={`${CITATION_READ_ERROR_TITLE}: ${detail}`}
          >
            did not load
          </span>
        </span>
      </div>
      {copy.next ? <p style={mutedText}>{copy.next}</p> : null}
      {copy.offerPublished && history && publishedId ? (
        <span className="segmented-control" role="group" aria-label="What to show">
          <button
            type="button"
            className="segmented-btn"
            data-ai-show-published
            onClick={() => history.viewRun(publishedId)}
          >
            Show the published run
          </button>
        </span>
      ) : null}
    </div>
  );
}
