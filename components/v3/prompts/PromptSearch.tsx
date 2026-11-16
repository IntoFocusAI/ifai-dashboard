"use client";

import "@/components/v3/live/resizable-table.css";
import { useMemo, useState } from "react";
import { DOWNLOAD_FAILED, downloadCsv } from "@/components/v3/live/TableToolbar";
import type { EditablePrompt } from "@/lib/ai-search/prompt-editor";
import { PROMPTS_EXPORT_TABLE } from "@/lib/export/tables";
import { formatInt } from "@/lib/fender-canvas/format";

/** Prompts whose key, wording, or category contain every word of the search. */
export function matchPrompts(prompts: readonly EditablePrompt[], query: string): EditablePrompt[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...prompts];
  return prompts.filter((p) => {
    const text = `${p.prompt_key} ${p.prompt_text} ${p.category}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Search state for the prompt list. One query narrows the asked and the removed prompts. */
export function usePromptSearch(active: readonly EditablePrompt[], removed: readonly EditablePrompt[]) {
  const [query, setQuery] = useState("");
  const shownActive = useMemo(() => matchPrompts(active, query), [active, query]);
  const shownRemoved = useMemo(() => matchPrompts(removed, query), [removed, query]);
  const shownKeys = useMemo(
    () => [...shownActive, ...shownRemoved].map((p) => p.prompt_key),
    [shownActive, shownRemoved],
  );
  return { query, setQuery, shownActive, shownRemoved, shownKeys };
}

/** Search box, the N of M prompts count, and Download CSV above the prompt list (X-33, X-10). */
export function PromptSearchBar({
  query,
  onQuery,
  shown,
  total,
  shownKeys,
}: {
  query: string;
  onQuery: (query: string) => void;
  shown: number;
  total: number;
  /** Prompt keys the list shows, asked then removed, in list order. */
  shownKeys: readonly string[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const onDownload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await downloadCsv(PROMPTS_EXPORT_TABLE, { keys: shownKeys, search: query, sort: null, filter: null, scope: null }));
    } catch {
      setMessage(DOWNLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="table-toolbar" data-prompt-search="">
      <input
        type="search"
        className="table-search"
        placeholder="Search prompts"
        aria-label="Search prompts"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <span className="table-toolbar-count" data-prompt-search-count={shown}>
        {formatInt(shown)} of {formatInt(total)} prompts
      </span>
      <button
        type="button"
        className="table-download-btn"
        data-table-download={PROMPTS_EXPORT_TABLE}
        disabled={busy || total === 0}
        onClick={() => void onDownload()}
      >
        {busy ? "Preparing CSV…" : "Download CSV"}
      </button>
      {message ? (
        <span className="table-toolbar-error" role="status" data-table-download-error="">
          {message}
        </span>
      ) : null}
    </div>
  );
}
