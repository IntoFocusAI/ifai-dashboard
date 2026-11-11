"use client";

import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  PROMPT_HISTORY_NOTE,
  PROMPT_HISTORY_TIPS,
  PROMPT_HISTORY_TITLE,
  PROMPT_HISTORY_UNAVAILABLE,
  formatPromptEditWhen,
  promptEditActionLabel,
  promptEditCountLabel,
  promptEditSide,
  type PromptEditHistory,
  type PromptEditRow,
} from "@/lib/ai-search/prompt-edit-history";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const COLUMNS = [
  clientColumn("time", "Time", "date", 190, 150),
  clientColumn("change", "Change", "text", 110, 90),
  clientColumn("before", "Before", "text", 280, 160),
  clientColumn("after", "After", "text", 280, 160),
];

function sortValue(row: PromptEditRow, columnId: string): SortInput {
  if (columnId === "time") return row.edited_at;
  if (columnId === "change") return promptEditActionLabel(row.action);
  if (columnId === "before") return promptEditSide(row.before);
  return promptEditSide(row.after);
}

/** One line for the whole screen when the history cannot be read. The reason is in the tooltip. */
export function PromptHistoryNotice({ history }: { history: PromptEditHistory | null }) {
  if (!history || history.status === "ready") return null;
  const tip = PROMPT_HISTORY_TIPS[history.reason];
  return (
    <p className="pe-hint" data-prompt-history-status={history.reason}>
      {PROMPT_HISTORY_TITLE}:{" "}
      <span
        className="ifai-term"
        data-ifai-tooltip-title={PROMPT_HISTORY_TITLE}
        data-ifai-tooltip-desc={tip}
        tabIndex={0}
        aria-label={`${PROMPT_HISTORY_TITLE}: ${tip}`}
      >
        {PROMPT_HISTORY_UNAVAILABLE}
      </span>
    </p>
  );
}

/** "Show history · 3 changes" on one prompt. Drawn only once the edit log has been read. */
export function PromptHistoryToggle({
  promptKey,
  count,
  open,
  onToggle,
}: {
  promptKey: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="pe-link pe-history-toggle"
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} history for ${promptKey}`}
      data-prompt-history-toggle={promptKey}
      onClick={onToggle}
    >
      {open ? "Hide history" : "Show history"} · {promptEditCountLabel(count)}
    </button>
  );
}

/** The stored changes of one prompt, newest first. Rows come only from the edit log. */
export function PromptHistory({ promptKey, rows }: { promptKey: string; rows: PromptEditRow[] }) {
  const sorted = useClientTableSort(rows, COLUMNS, sortValue);
  return (
    <section className="pe-history" aria-label={`${PROMPT_HISTORY_TITLE} for ${promptKey}`} data-prompt-history={promptKey}>
      <p className="pe-hint">{PROMPT_HISTORY_NOTE}</p>
      {rows.length === 0 ? (
        <p className="pe-empty" data-prompt-history-empty>
          No changes are stored for this prompt.
        </p>
      ) : (
        <ResizableTable
          tableId="prompt-history"
          columns={COLUMNS}
          fillColumnId="after"
          wrapColumnIds={["before", "after"]}
          maxHeight={260}
          sort={sorted.sort}
          onSort={sorted.onSort}
          exportScope={{ promptKey }}
        >
          <tbody>
            {sorted.rows.map((row) => (
              <tr key={row.id} data-prompt-edit={row.action}>
                <td>{formatPromptEditWhen(row.edited_at)}</td>
                <td>{promptEditActionLabel(row.action)}</td>
                <td className="pe-history-side">{promptEditSide(row.before)}</td>
                <td className="pe-history-side">{promptEditSide(row.after)}</td>
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      )}
    </section>
  );
}
