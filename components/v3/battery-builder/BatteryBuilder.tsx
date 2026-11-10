"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/ai-search/question-role";
import { loadPrompts, savePrompt, type EditablePrompt, type PromptEditorStatus } from "@/lib/ai-search/prompt-editor";
import {
  callsPerRun,
  cleanValues,
  generateQuestions,
  reviewQuestions,
  type BuilderVariable,
  type DesignMode,
  type ReviewedQuestion,
} from "@/lib/battery-builder/generate";
import { FENDER_PRESETS, type BuilderPreset } from "@/lib/battery-builder/presets";
import { SLOTS, SLOT_EXAMPLES, SLOT_LABELS, type Attributes, type Slot } from "@/lib/battery-builder/render";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { activeClient } from "@/lib/client/active-client";
import "./battery-builder.css";

/** Roles the AI Search headline counts. A question in another role still runs but is not in the headline. */
const HEADLINE = new Set(["unbranded_discovery", "branded_consideration"]);

type EditableVariable = BuilderVariable & { valuesText: string };

function toEditable(variables: readonly BuilderVariable[]): EditableVariable[] {
  return variables.map((v) => ({ ...v, values: [...v.values], valuesText: v.values.join("\n") }));
}

function slugName(label: string, taken: ReadonlySet<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "detail";
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  return name;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function BatteryBuilder() {
  const params = useSearchParams();
  const light = params.get("theme") === "light";
  const client = activeClient();
  const backHref = `${DASHBOARD_PATH}${params.toString() ? `?${params.toString()}` : ""}`;

  const [presetCategory, setPresetCategory] = useState(FENDER_PRESETS[0].category);
  const preset: BuilderPreset = FENDER_PRESETS.find((p) => p.category === presetCategory) ?? FENDER_PRESETS[0];
  const [item, setItem] = useState(preset.item);
  const [personaNoun, setPersonaNoun] = useState(preset.personaNoun);
  const [variables, setVariables] = useState<EditableVariable[]>(() => toEditable(preset.variables));
  const [baseline, setBaseline] = useState<Attributes>(preset.baseline);
  const [tested, setTested] = useState<string[]>(preset.tested);
  const [mode, setMode] = useState<DesignMode>("one_at_a_time");

  const [existing, setExisting] = useState<EditablePrompt[]>([]);
  const [status, setStatus] = useState<PromptEditorStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ added: string[]; error: string | null } | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newSlot, setNewSlot] = useState<Slot>("clause");

  const refresh = useCallback(async () => {
    const data = await loadPrompts();
    setExisting(data.prompts);
    setStatus(data.status);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPrompts()
      .then((data) => {
        if (cancelled) return;
        setExisting(data.prompts);
        setStatus(data.status);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function choosePreset(category: string) {
    const next = FENDER_PRESETS.find((p) => p.category === category) ?? FENDER_PRESETS[0];
    setPresetCategory(next.category);
    setItem(next.item);
    setPersonaNoun(next.personaNoun);
    setVariables(toEditable(next.variables));
    setBaseline(next.baseline);
    setTested(next.tested);
    setSelected(new Set());
    setResult(null);
  }

  function updateVariable(name: string, patch: Partial<EditableVariable>) {
    setVariables((vs) => vs.map((v) => (v.name === name ? { ...v, ...patch } : v)));
  }

  function setValuesText(v: EditableVariable, text: string) {
    const values = cleanValues(text.split("\n"));
    updateVariable(v.name, { valuesText: text, values });
    if (baseline[v.name] && !values.includes(baseline[v.name])) setBaseline((b) => ({ ...b, [v.name]: "" }));
  }

  function toggleTested(name: string) {
    setTested((t) => (t.includes(name) ? t.filter((n) => n !== name) : [...t, name]));
  }

  function removeVariable(name: string) {
    setVariables((vs) => vs.filter((v) => v.name !== name));
    setTested((t) => t.filter((n) => n !== name));
    setBaseline((b) => {
      const next = { ...b };
      delete next[name];
      return next;
    });
  }

  function addVariable() {
    const label = newLabel.trim();
    if (!label) return;
    const name = slugName(label, new Set(variables.map((v) => v.name)));
    const template = newSlot === "clause" ? "wants {value}" : "{value}";
    setVariables((vs) => [...vs, { name, label, slot: newSlot, template, values: [], valuesText: "" }]);
    setTested((t) => [...t, name]);
    setNewLabel("");
  }

  const generated = useMemo(
    () => generateQuestions({ item, personaNoun }, variables, { mode, baseline, tested }),
    [item, personaNoun, variables, mode, baseline, tested],
  );
  const reviewed: ReviewedQuestion[] = useMemo(() => reviewQuestions(generated.questions, existing), [generated, existing]);
  const notes = generated.notes;

  const addable = reviewed.filter((q) => !q.duplicateOf);
  const chosen = addable.filter((q) => selected.has(q.text));
  const locked = status?.locked ?? false;
  const activeAfter = (status?.active_count ?? 0) + chosen.length;
  const overLimit = status ? activeAfter > status.max_active : false;
  const engines = status?.engines ?? 3;
  const repeats = status?.repeats ?? 3;

  function toggle(text: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  }

  async function addToBattery() {
    setSaving(true);
    setResult(null);
    const added: string[] = [];
    let error: string | null = null;
    // One at a time through the editor's save, so each prompt gets its own key and edit log row.
    for (const q of chosen) {
      try {
        added.push(await savePrompt(null, q.text, preset.category));
      } catch (e) {
        error = errorText(e);
        break;
      }
    }
    setResult({ added, error });
    setSelected(new Set());
    try {
      await refresh();
    } catch (e) {
      setLoadError(errorText(e));
    }
    setSaving(false);
  }

  if (!client.promptsEditable) {
    return (
      <main className={`bb-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
        <article className="bb-card">
          <header className="bb-header">
            <h1>Build prompts</h1>
            <Link href={backHref} className="bb-back">
              <ArrowLeft size={14} aria-hidden /> <span>Dashboard</span>
            </Link>
          </header>
          <p className="bb-lead">{client.brandName} prompts are not edited from the dashboard.</p>
        </article>
      </main>
    );
  }

  return (
    <main className={`bb-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
      <article className="bb-card">
        <header className="bb-header">
          <div>
            <h1>Build prompts</h1>
            <p className="bb-sub">
              Pick the shopper details to vary. Every question changes one detail from the starting question, so a
              change in {client.brandName}&apos;s results points to that detail.
            </p>
          </div>
          <Link href={backHref} className="bb-back">
            <ArrowLeft size={14} aria-hidden /> <span>Dashboard</span>
          </Link>
        </header>

        {locked ? (
          <div className="bb-banner bb-banner-warn" role="status">
            The AI battery is running (started {status?.run_started_at ? new Date(status.run_started_at).toLocaleString() : "recently"}).
            Prompts can be added after it publishes.
          </div>
        ) : null}
        {loadError ? <div className="bb-banner bb-banner-error" role="alert">{loadError}</div> : null}
        {result ? (
          <div className={`bb-banner ${result.error ? "bb-banner-error" : "bb-banner-ok"}`} role="status">
            {result.added.length ? `Added ${result.added.join(", ")}. The battery asks them from its next run.` : null}
            {result.error ? ` Stopped: ${result.error}` : null}
          </div>
        ) : null}

        <div className="bb-layout">
          <section className="bb-panel" aria-labelledby="bb-setup">
            <h2 id="bb-setup">Setup</h2>
            <label className="bb-field">
              <span>Category</span>
              <select value={presetCategory} onChange={(e) => choosePreset(e.target.value)}>
                {FENDER_PRESETS.map((p) => (
                  <option key={p.category} value={p.category}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="bb-row">
              <label className="bb-field">
                <span>Product</span>
                <input value={item} onChange={(e) => setItem(e.target.value)} />
              </label>
              <label className="bb-field">
                <span>Shopper</span>
                <input value={personaNoun} onChange={(e) => setPersonaNoun(e.target.value)} />
              </label>
            </div>
            <fieldset className="bb-mode">
              <legend>Questions</legend>
              <label>
                <input type="radio" checked={mode === "one_at_a_time"} onChange={() => setMode("one_at_a_time")} />
                One detail at a time
              </label>
              <label>
                <input type="radio" checked={mode === "combination"} onChange={() => setMode("combination")} />
                Every combination
              </label>
            </fieldset>

            <h2>Shopper details</h2>
            <ul className="bb-vars">
              {variables.map((v) => (
                <li key={v.name} className="bb-var">
                  <div className="bb-var-head">
                    <label className="bb-check">
                      <input type="checkbox" checked={tested.includes(v.name)} onChange={() => toggleTested(v.name)} />
                      <strong>{v.label}</strong>
                    </label>
                    <span className="bb-slot" title={SLOT_EXAMPLES[v.slot]}>
                      {SLOT_LABELS[v.slot]}
                    </span>
                    <button className="bb-icon-btn" onClick={() => removeVariable(v.name)} aria-label={`Remove ${v.label}`} title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <label className="bb-field">
                    <span>In the starting question</span>
                    <select value={baseline[v.name] ?? ""} onChange={(e) => setBaseline((b) => ({ ...b, [v.name]: e.target.value }))}>
                      <option value="">Left out</option>
                      {v.values.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="bb-field">
                    <span>Values, one per line</span>
                    <textarea rows={Math.min(6, Math.max(2, v.values.length + 1))} value={v.valuesText} onChange={(e) => setValuesText(v, e.target.value)} />
                  </label>
                  {v.slot === "frame" ? (
                    <p className="bb-hint">
                      {"{request}"} becomes the product with its details, such as “electric guitar under $1,000 for an intermediate player”.{" "}
                      {"{a_request}"} adds “a” or “an” in front.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="bb-add-var">
              <input placeholder="New detail, e.g. Tone" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <select value={newSlot} onChange={(e) => setNewSlot(e.target.value as Slot)} aria-label="Where it goes">
                {SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
              <button className="bb-btn" onClick={addVariable} disabled={!newLabel.trim()}>
                <Plus size={14} aria-hidden /> Add
              </button>
            </div>
          </section>

          <section className="bb-panel bb-preview-panel" aria-labelledby="bb-preview">
            <div className="bb-preview-head">
              <h2 id="bb-preview">
                {reviewed.length} question{reviewed.length === 1 ? "" : "s"}
              </h2>
              <div className="bb-row-actions">
                <button className="bb-link" onClick={() => setSelected(new Set(addable.map((q) => q.text)))}>
                  Select all new
                </button>
                <button className="bb-link" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </div>
            </div>
            {notes.map((note) => (
              <p key={note} className="bb-note">
                {note}
              </p>
            ))}
            <ul className="bb-questions">
              {reviewed.map((q) => (
                <li key={q.text} className={`bb-q${q.duplicateOf ? " is-duplicate" : ""}`}>
                  <label className="bb-check">
                    <input
                      type="checkbox"
                      disabled={!!q.duplicateOf}
                      checked={!q.duplicateOf && selected.has(q.text)}
                      onChange={() => toggle(q.text)}
                    />
                    <span className="bb-q-text">{q.text}</span>
                  </label>
                  <div className="bb-q-meta">
                    <span className="bb-chip">{q.kind === "start" ? "Starting question" : q.change}</span>
                    <span
                      className={`bb-chip${q.role === "other" ? " bb-chip-warn" : HEADLINE.has(q.role) ? " bb-chip-good" : ""}`}
                      title={
                        q.role === "other"
                          ? "The dashboard can't tell what kind of question this is, so it won't count in any role. Reword it."
                          : HEADLINE.has(q.role)
                            ? "Counts toward the AI Search headline."
                            : "Runs and shows on the dashboard; not in the headline."
                      }
                    >
                      {ROLE_LABELS[q.role]}
                    </span>
                    {q.duplicateOf ? <span className="bb-chip">Already {q.duplicateOf}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="bb-footer">
          <p className="bb-sub">
            {chosen.length} selected · {callsPerRun(chosen.length, engines, repeats).toLocaleString()} more calls per run ({engines} engines ×{" "}
            {repeats} answers each)
            {status ? ` · ${activeAfter} of ${status.max_active} active prompts` : ""}
          </p>
          <button
            className="bb-btn bb-btn-primary"
            disabled={saving || locked || chosen.length === 0 || overLimit || !status}
            onClick={() => void addToBattery()}
          >
            {saving ? "Adding…" : `Add ${chosen.length} to the battery`}
          </button>
        </footer>
      </article>
    </main>
  );
}
