"use client";

import { StatusGlyph } from "@/components/v3/live/StatusMark";
import { PromptSearchBar, usePromptSearch } from "@/components/v3/prompts/PromptSearch";
import "@/components/v3/prompts/prompts-editor.css";
import type { EditablePrompt, PromptEditorStatus } from "@/lib/ai-search/prompt-editor";
import { loadPromptList, promptDisplayText } from "@/lib/prompts/prompt-list";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LoadingMark } from "@/components/v3/live/LoadingMark";

type Props = { onClose: () => void };

/**
 * The prompts the brand's AI-Search battery asks. Every client sees the same view-only list: search,
 * N of M and Download CSV (decision 99). No client edits questions here; IntoFocus staff build
 * prompts from the staff-only Build prompts page.
 */
export function PromptsEditor({ onClose }: Props) {
  const [prompts, setPrompts] = useState<EditablePrompt[]>([]);
  const [status, setStatus] = useState<PromptEditorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPromptList()
      .then((data) => {
        if (cancelled) return;
        setPrompts(data.prompts);
        setStatus(data.status);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = useMemo(() => prompts.filter((p) => p.active), [prompts]);
  const removed = useMemo(() => prompts.filter((p) => !p.active), [prompts]);
  const search = usePromptSearch(active, removed);
  const callsPerPrompt = (status?.repeats ?? 20) * (status?.engines ?? 3);

  const item = (p: EditablePrompt, removedItem: boolean) => (
    <li key={p.prompt_key} className={`pe-item${removedItem ? " pe-item-removed" : ""}`}>
      <div className="pe-item-meta">
        <span className="pe-key">{p.prompt_key}</span>
        <span className="pe-chip">{p.category}</span>
        {p.prompt_kind === "probe" ? <span className="pe-chip pe-chip-probe">Fact check</span> : null}
      </div>
      <p className="pe-text">{promptDisplayText(p.prompt_text)}</p>
    </li>
  );

  return (
    <div className="pe-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pe-dialog" role="dialog" aria-modal="true" aria-labelledby="pe-title">
        <header className="pe-header">
          <div>
            <h2 id="pe-title">AI-Search prompts</h2>
            <p className="pe-sub">
              The questions asked of ChatGPT, Perplexity and Gemini in every AI-Search run.{" "}
              {status ? (
                <>
                  {status.active_count} active. Each prompt is asked {status.repeats} times per engine ({callsPerPrompt}{" "}
                  AI calls per run).
                </>
              ) : !loading && !error ? (
                <>{active.length} active.</>
              ) : null}
            </p>
          </div>
          <button className="pe-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {error ? (
          <div className="pe-banner pe-banner-error">
            <StatusGlyph status="bad" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="pe-body">
          {loading ? <p className="pe-empty"><LoadingMark label="Loading prompts" /></p> : null}

          <PromptSearchBar
            query={search.query}
            onQuery={search.setQuery}
            shown={search.shownActive.length}
            total={active.length}
            shownKeys={search.shownKeys}
          />
          {!loading && active.length > 0 && search.shownActive.length === 0 ? (
            <p className="pe-empty">No prompt matches this search.</p>
          ) : null}

          <ul className="pe-list">{search.shownActive.map((p) => item(p, false))}</ul>

          {removed.length ? (
            <section className="pe-removed">
              <button className="pe-link" onClick={() => setShowRemoved((v) => !v)}>
                {showRemoved ? "Hide" : "Show"} removed prompts ({search.shownRemoved.length} of {removed.length})
              </button>
              {showRemoved ? <ul className="pe-list">{search.shownRemoved.map((p) => item(p, true))}</ul> : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
