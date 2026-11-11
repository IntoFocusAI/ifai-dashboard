"use client";

import "@/components/v3/live/resizable-table.css";
import { useMemo, useState } from "react";
import type { EditablePrompt } from "@/lib/ai-search/prompt-editor";
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
  return { query, setQuery, shownActive, shownRemoved };
}

/** Search box and the N of M prompts count above the prompt list (X-33). */
export function PromptSearchBar({
  query,
  onQuery,
  shown,
  total,
}: {
  query: string;
  onQuery: (query: string) => void;
  shown: number;
  total: number;
}) {
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
    </div>
  );
}
