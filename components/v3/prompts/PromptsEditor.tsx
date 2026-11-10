"use client";

import { StatusGlyph } from "@/components/v3/live/StatusMark";
import { PromptHistory, PromptHistoryNotice, PromptHistoryToggle } from "@/components/v3/prompts/PromptHistory";
import "@/components/v3/prompts/prompts-editor.css";
import { loadPromptEditHistory, promptEditsFor, type PromptEditHistory } from "@/lib/ai-search/prompt-edit-history";
import {
  loadPrompts,
  savePrompt,
  setPromptActive,
  type EditablePrompt,
  type PromptEditorStatus,
} from "@/lib/ai-search/prompt-editor";
import { Lock, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const NEW_CATEGORY = "__new__";

type Draft = { text: string; category: string; newCategory: string };

const EMPTY_DRAFT: Draft = { text: "", category: "", newCategory: "" };

function draftCategory(d: Draft): string {
  return d.category === NEW_CATEGORY ? d.newCategory : d.category;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function CategoryPicker({
  draft,
  categories,
  disabled,
  onChange,
}: {
  draft: Draft;
  categories: string[];
  disabled: boolean;
  onChange: (d: Draft) => void;
}) {
  return (
    <div className="pe-category">
      <select
        value={draft.category}
        disabled={disabled}
        onChange={(e) => onChange({ ...draft, category: e.target.value })}
        aria-label="Category"
      >
        <option value="" disabled>
          Category
        </option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_CATEGORY}>New category…</option>
      </select>
      {draft.category === NEW_CATEGORY ? (
        <input
          type="text"
          value={draft.newCategory}
          disabled={disabled}
          maxLength={40}
          placeholder="New category name"
          onChange={(e) => onChange({ ...draft, newCategory: e.target.value })}
          aria-label="New category name"
        />
      ) : null}
    </div>
  );
}

type Props = { onClose: () => void };

/** Lists, adds, edits, removes and restores the prompts the AI-Search battery asks (command.fmic_ai_prompts). */
export function PromptsEditor({ onClose }: Props) {
  const [prompts, setPrompts] = useState<EditablePrompt[]>([]);
  const [status, setStatus] = useState<PromptEditorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState<Draft>(EMPTY_DRAFT);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft>(EMPTY_DRAFT);
  const [showRemoved, setShowRemoved] = useState(false);
  const [history, setHistory] = useState<PromptEditHistory | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await loadPrompts();
    setPrompts(data.prompts);
    setStatus(data.status);
    // One read returns every prompt's stored changes. A failed read never blocks the editor.
    setHistory(await loadPromptEditHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPrompts()
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
    void loadPromptEditHistory().then((result) => {
      if (!cancelled) setHistory(result);
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
  const categories = status?.categories ?? [];
  const locked = Boolean(status?.locked);
  const disabled = locked || busy || loading;
  const callsPerPrompt = (status?.repeats ?? 20) * (status?.engines ?? 3);

  async function run(action: () => Promise<string | void>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await refresh();
      setNotice(done);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      await refresh().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addPrompt() {
    const ok = await run(
      () => savePrompt(null, adding.text, draftCategory(adding)),
      "Prompt added. It will be asked from the next run.",
    );
    if (ok) setAdding(EMPTY_DRAFT);
  }

  function startEdit(p: EditablePrompt) {
    setEditingKey(p.prompt_key);
    setEditing({ text: p.prompt_text, category: p.category, newCategory: "" });
    setError(null);
    setNotice(null);
  }

  async function saveEdit(key: string) {
    const ok = await run(
      () => savePrompt(key, editing.text, draftCategory(editing)),
      `Prompt ${key} saved. The new wording is asked from the next run.`,
    );
    if (ok) setEditingKey(null);
  }

  function remove(p: EditablePrompt) {
    if (!window.confirm(`Remove prompt ${p.prompt_key}? It stops being asked from the next run. You can restore it later.`)) return;
    void run(() => setPromptActive(p.prompt_key, false), `Prompt ${p.prompt_key} removed.`);
  }

  function restore(p: EditablePrompt) {
    void run(() => setPromptActive(p.prompt_key, true), `Prompt ${p.prompt_key} restored.`);
  }

  const canAdd = adding.text.trim().length >= 10 && draftCategory(adding).trim().length > 0;
  const edits = history?.status === "ready" ? history.rows : null;
  const historyToggle = (key: string) =>
    edits ? (
      <PromptHistoryToggle
        promptKey={key}
        count={promptEditsFor(edits, key).length}
        open={historyKey === key}
        onToggle={() => setHistoryKey((current) => (current === key ? null : key))}
      />
    ) : null;
  const historyRows = (key: string) =>
    edits && historyKey === key ? <PromptHistory promptKey={key} rows={promptEditsFor(edits, key)} /> : null;

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
              ) : null}
            </p>
          </div>
          <button className="pe-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {locked ? (
          <div className="pe-banner pe-banner-warn">
            <Lock size={14} />
            <span>
              Editing is paused while an AI-Search run is in progress
              {status?.run_started_at ? ` (started ${formatWhen(status.run_started_at)})` : ""}. Changing prompts
              mid-run would mix two prompt lists in one run. Try again once it publishes.
            </span>
          </div>
        ) : null}
        {error ? (
          <div className="pe-banner pe-banner-error">
            <StatusGlyph status="bad" />
            <span>{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div className="pe-banner pe-banner-ok">
            <StatusGlyph status="good" />
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="pe-body">
          <section className="pe-add">
            <textarea
              value={adding.text}
              disabled={disabled}
              maxLength={500}
              rows={2}
              placeholder="Add a prompt, written the way a shopper would ask it"
              onChange={(e) => setAdding({ ...adding, text: e.target.value })}
              aria-label="New prompt text"
            />
            <div className="pe-row-actions">
              <CategoryPicker draft={adding} categories={categories} disabled={disabled} onChange={setAdding} />
              <button className="pe-btn pe-btn-primary" disabled={disabled || !canAdd} onClick={() => void addPrompt()}>
                <Plus size={14} />
                Add prompt
              </button>
            </div>
          </section>

          <p className="pe-hint">
            Rewording a prompt starts a new trend for it: past answers keep the old wording. Removed prompts stop
            being asked and can be restored.
          </p>

          <PromptHistoryNotice history={history} />

          {loading ? <p className="pe-empty">Loading prompts…</p> : null}

          <ul className="pe-list">
            {active.map((p) => (
              <li key={p.prompt_key} className="pe-item">
                <div className="pe-item-meta">
                  <span className="pe-key">{p.prompt_key}</span>
                  <span className="pe-chip">{p.category}</span>
                  {p.prompt_kind === "probe" ? <span className="pe-chip pe-chip-probe">Fact check</span> : null}
                  {historyToggle(p.prompt_key)}
                </div>
                {editingKey === p.prompt_key ? (
                  <div className="pe-edit">
                    <textarea
                      value={editing.text}
                      disabled={busy}
                      maxLength={500}
                      rows={3}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      aria-label={`Prompt ${p.prompt_key} text`}
                    />
                    {p.prompt_kind === "probe" ? (
                      <p className="pe-hint">
                        This fact-check prompt is scored against a verified fact. Keep the question about the same fact.
                      </p>
                    ) : null}
                    <div className="pe-row-actions">
                      <CategoryPicker draft={editing} categories={categories} disabled={busy} onChange={setEditing} />
                      <button className="pe-btn" disabled={busy} onClick={() => setEditingKey(null)}>
                        Cancel edit
                      </button>
                      <button
                        className="pe-btn pe-btn-primary"
                        disabled={disabled || editing.text.trim().length < 10 || !draftCategory(editing).trim()}
                        onClick={() => void saveEdit(p.prompt_key)}
                      >
                        Save prompt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pe-item-main">
                    <p className="pe-text">{p.prompt_text}</p>
                    <div className="pe-item-actions">
                      <button className="pe-icon-btn" disabled={disabled} onClick={() => startEdit(p)} aria-label={`Edit ${p.prompt_key}`} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="pe-icon-btn pe-danger" disabled={disabled} onClick={() => remove(p)} aria-label={`Remove ${p.prompt_key}`} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
                {historyRows(p.prompt_key)}
              </li>
            ))}
          </ul>

          {removed.length ? (
            <section className="pe-removed">
              <button className="pe-link" onClick={() => setShowRemoved((v) => !v)}>
                {showRemoved ? "Hide" : "Show"} removed prompts ({removed.length})
              </button>
              {showRemoved ? (
                <ul className="pe-list">
                  {removed.map((p) => (
                    <li key={p.prompt_key} className="pe-item pe-item-removed">
                      <div className="pe-item-meta">
                        <span className="pe-key">{p.prompt_key}</span>
                        <span className="pe-chip">{p.category}</span>
                        {historyToggle(p.prompt_key)}
                      </div>
                      <div className="pe-item-main">
                        <p className="pe-text">{p.prompt_text}</p>
                        <div className="pe-item-actions">
                          <button className="pe-btn" disabled={disabled} onClick={() => restore(p)}>
                            <RotateCcw size={14} />
                            Restore prompt
                          </button>
                        </div>
                      </div>
                      {historyRows(p.prompt_key)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
