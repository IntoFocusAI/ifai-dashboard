"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { loadPrompts, savePrompt, type EditablePrompt, type PromptEditorStatus } from "@/lib/ai-search/prompt-editor";
import { callsPerRun, generateQuestions, reviewQuestions, type DesignMode, type ReviewedQuestion } from "@/lib/battery-builder/generate";
import { FENDER_PRESETS, type BuilderPreset } from "@/lib/battery-builder/presets";
import { renderPrompt, type Attributes, type Slot } from "@/lib/battery-builder/render";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { activeClient } from "@/lib/client/active-client";
import { AdvancedSettings } from "./AdvancedSettings";
import { DetailRow, type Detail } from "./DetailRow";
import { QuestionList } from "./QuestionList";
import "./battery-builder.css";

function toDetails(preset: BuilderPreset): Detail[] {
  return preset.variables.map((v) => ({ ...v, values: [...v.values], addedValues: [], custom: false }));
}

function slugName(label: string, taken: ReadonlySet<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "detail";
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  return name;
}

/** "Which brand makes the best {request}?" reads as "Which brand makes the best [product]?" on its chip. */
function styleLabel(value: string): string {
  return value.replaceAll("{a_request}", "a [product]").replaceAll("{request}", "[product]");
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
  const [details, setDetails] = useState<Detail[]>(() => toDetails(preset));
  const [baseline, setBaseline] = useState<Attributes>(preset.baseline);
  const [tested, setTested] = useState<string[]>(preset.tested);
  const [mode, setMode] = useState<DesignMode>("one_at_a_time");

  const [existing, setExisting] = useState<EditablePrompt[]>([]);
  const [status, setStatus] = useState<PromptEditorStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ added: string[]; error: string | null } | null>(null);

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
    setDetails(toDetails(next));
    setBaseline(next.baseline);
    setTested(next.tested);
    setSelected(new Set());
    setResult(null);
  }

  function updateDetail(name: string, change: (d: Detail) => Detail) {
    setDetails((ds) => ds.map((d) => (d.name === name ? change(d) : d)));
  }

  function addValue(name: string, value: string) {
    updateDetail(name, (d) => (d.values.includes(value) ? d : { ...d, values: [...d.values, value], addedValues: [...d.addedValues, value] }));
  }

  function removeValue(name: string, value: string) {
    updateDetail(name, (d) => ({ ...d, values: d.values.filter((v) => v !== value), addedValues: d.addedValues.filter((v) => v !== value) }));
    setBaseline((b) => (b[name] === value ? { ...b, [name]: "" } : b));
  }

  function toggleTried(name: string) {
    setTested((t) => (t.includes(name) ? t.filter((n) => n !== name) : [...t, name]));
  }

  function removeDetail(name: string) {
    setDetails((ds) => ds.filter((d) => d.name !== name));
    setTested((t) => t.filter((n) => n !== name));
    setBaseline((b) => {
      const next = { ...b };
      delete next[name];
      return next;
    });
  }

  function addDetail(label: string, slot: Slot) {
    const name = slugName(label, new Set(details.map((d) => d.name)));
    const template = slot === "clause" ? "wants {value}" : "{value}";
    setDetails((ds) => [...ds, { name, label, slot, template, values: [], addedValues: [], custom: true }]);
    setTested((t) => [...t, name]);
  }

  const product = { item, personaNoun };
  const generated = useMemo(
    () => generateQuestions({ item, personaNoun }, details, { mode, baseline, tested }),
    [item, personaNoun, details, mode, baseline, tested],
  );
  const reviewed: ReviewedQuestion[] = useMemo(() => reviewQuestions(generated.questions, existing), [generated, existing]);
  const startQuestion = renderPrompt(product, details, baseline);

  const chosen = reviewed.filter((q) => !q.duplicateOf && selected.has(q.text));
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

  const header = (
    <header className="bb-header">
      <div>
        <h1>Build prompts</h1>
        <p className="bb-sub">Describe a shopper and get AI-search questions to add to {client.brandName}&apos;s battery.</p>
      </div>
      <Link href={backHref} className="bb-back">
        <ArrowLeft size={14} aria-hidden /> <span>Dashboard</span>
      </Link>
    </header>
  );

  if (!client.promptsEditable) {
    return (
      <main className={`bb-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
        <article className="bb-card">
          {header}
          <p className="bb-lead">{client.brandName} prompts are not edited from the dashboard.</p>
        </article>
      </main>
    );
  }

  const rowFor = (d: Detail) => (
    <DetailRow
      key={d.name}
      detail={d}
      picked={baseline[d.name] ?? ""}
      tried={tested.includes(d.name)}
      valueLabel={d.slot === "frame" ? styleLabel : undefined}
      onPick={(value) => setBaseline((b) => ({ ...b, [d.name]: value }))}
      onToggleTry={() => toggleTried(d.name)}
      onAddValue={(value) => addValue(d.name, value)}
      onRemoveValue={(value) => removeValue(d.name, value)}
      onRemoveDetail={() => removeDetail(d.name)}
    />
  );

  return (
    <main className={`bb-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
      <article className="bb-card">
        {header}

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

        <section className="bb-step bb-step-wide" aria-labelledby="bb-step-1">
          <h2 id="bb-step-1">
            <span className="bb-step-num">1</span> What&apos;s the shopper looking for?
          </h2>
          <div className="bb-cats" role="radiogroup" aria-labelledby="bb-step-1">
            {FENDER_PRESETS.map((p) => (
              <button
                key={p.category}
                type="button"
                role="radio"
                aria-checked={p.category === presetCategory}
                className={`bb-cat${p.category === presetCategory ? " is-on" : ""}`}
                onClick={() => choosePreset(p.category)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <div className="bb-layout">
          <section className="bb-step" aria-labelledby="bb-step-2">
            <h2 id="bb-step-2">
              <span className="bb-step-num">2</span> Describe the shopper
            </h2>
            <p className="bb-help">Click a value to put it in the starting question. Turn on “Try each” to get one question per value.</p>
            <figure className="bb-start">
              <figcaption>Starting question</figcaption>
              <blockquote>{startQuestion}</blockquote>
            </figure>
            <ul className="bb-details">{details.filter((d) => d.slot !== "frame").map(rowFor)}</ul>
            <AdvancedSettings
              styleRows={details.filter((d) => d.slot === "frame").map(rowFor)}
              mode={mode}
              onMode={setMode}
              item={item}
              onItem={setItem}
              personaNoun={personaNoun}
              onPersonaNoun={setPersonaNoun}
              onAddDetail={addDetail}
            />
          </section>

          <section className="bb-step bb-questions-step" aria-label="Pick the questions to add">
            <QuestionList
              questions={reviewed}
              notes={generated.notes}
              selected={selected}
              onToggle={toggle}
              onSelect={(texts) => setSelected(new Set(texts))}
            />
          </section>
        </div>

        <footer className="bb-footer">
          <p className="bb-sub">
            <strong>{chosen.length} selected</strong>
            <span title={`${engines} engines × ${repeats} answers each`}>
              {" "}· +{callsPerRun(chosen.length, engines, repeats).toLocaleString()} calls per run
            </span>
            {status ? <span className={overLimit ? "bb-over" : undefined}> · {activeAfter} of {status.max_active} active prompts</span> : null}
          </p>
          <button
            className="bb-btn bb-btn-primary"
            disabled={saving || locked || chosen.length === 0 || overLimit || !status}
            onClick={() => void addToBattery()}
          >
            {saving ? "Adding…" : chosen.length === 1 ? "Add 1 prompt" : `Add ${chosen.length} prompts`}
          </button>
        </footer>
      </article>
    </main>
  );
}
