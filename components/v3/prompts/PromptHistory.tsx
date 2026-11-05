"use client";

import {
  formatPromptEditWhen,
  loadPromptEditHistory,
  PROMPT_HISTORY_NOTE,
  PROMPT_HISTORY_UNAVAILABLE,
  PROMPT_HISTORY_UNAVAILABLE_DESC,
  promptEditActionLabel,
  promptEditSide,
  type PromptEditHistory,
} from "@/lib/ai-search/prompt-edit-history";
import { useEffect, useState } from "react";

function HistoryUnavailable() {
  const label = `${PROMPT_HISTORY_UNAVAILABLE}: ${PROMPT_HISTORY_UNAVAILABLE_DESC}`;
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={PROMPT_HISTORY_UNAVAILABLE}
      data-ifai-tooltip-desc={PROMPT_HISTORY_UNAVAILABLE_DESC}
      tabIndex={0}
      aria-label={label}
    >
      {PROMPT_HISTORY_UNAVAILABLE}
    </span>
  );
}

type Props = {
  promptKey: string | null;
  updatedAt: string | null;
};

type LoadedHistory = {
  promptKey: string;
  updatedAt: string | null;
  result: PromptEditHistory;
};

/** Change history for the selected prompt. Rows come only from the edit log. */
export function PromptHistory({ promptKey, updatedAt }: Props) {
  const [loaded, setLoaded] = useState<LoadedHistory | null>(null);

  useEffect(() => {
    if (!promptKey) return;
    let cancelled = false;
    loadPromptEditHistory(promptKey).then((result) => {
      if (!cancelled) setLoaded({ promptKey, updatedAt, result });
    });
    return () => {
      cancelled = true;
    };
  }, [promptKey, updatedAt]);

  const history =
    loaded && loaded.promptKey === promptKey && loaded.updatedAt === updatedAt ? loaded.result : null;
  const ready = history?.status === "ready" ? history : null;

  return (
    <section className="pe-history" aria-labelledby="pe-history-title" data-prompt-history>
      <h3 id="pe-history-title">Change history{promptKey ? ` for ${promptKey}` : ""}</h3>
      <p className="pe-hint">{PROMPT_HISTORY_NOTE}</p>
      {!promptKey ? <p className="pe-empty">Select a prompt.</p> : null}
      {promptKey && history === null ? <p className="pe-empty">Loading history…</p> : null}
      {history?.status === "unavailable" ? (
        <p className="pe-empty" data-prompt-history-status="unavailable">
          <HistoryUnavailable />
        </p>
      ) : null}
      {ready && ready.rows.length === 0 ? (
        <p className="pe-empty" data-prompt-history-status="empty">
          No changes are stored for this prompt.
        </p>
      ) : null}
      {ready && ready.rows.length > 0 ? (
        <table className="pe-history-table" data-prompt-history-status="ready">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {ready.rows.map((row) => (
              <tr key={row.id}>
                <td>{formatPromptEditWhen(row.edited_at)}</td>
                <td>{promptEditActionLabel(row.action)}</td>
                <td>{promptEditSide(row.before)}</td>
                <td>{promptEditSide(row.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
