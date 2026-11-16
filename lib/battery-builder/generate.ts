/**
 * Builds a set of questions from shopper details.
 * Ported from Justin Hittell's Recommendation Lab (github.com/geneticmarauder/aeo,
 * src/main/services/experimentGenerator.ts, MIT License, Copyright (c) 2026 GeneticMarauder).
 */

import { questionRole, type QuestionRole } from "@/lib/ai-search/question-role";
import { renderPrompt, type Attributes, type RenderProduct, type Slot } from "@/lib/battery-builder/render";

export const MAX_COMBINATIONS = 250;

export type BuilderVariable = {
  name: string;
  label: string;
  slot: Slot;
  template: string;
  values: string[];
};

export type DesignMode = "one_at_a_time" | "combination";

export type Design = {
  mode: DesignMode;
  /** Held constant in every question. A variable left out of the baseline is left out of the sentence. */
  baseline: Attributes;
  /** Variables whose values are tried. */
  tested: string[];
};

export type GeneratedQuestion = {
  /** "start" for the starting question; otherwise what changed, e.g. "budget = under $500". */
  change: string;
  kind: "start" | "test" | "combination";
  attributes: Attributes;
  text: string;
};

export type GeneratedSet = { questions: GeneratedQuestion[]; notes: string[] };

function attributesKey(attrs: Attributes): string {
  return Object.keys(attrs)
    .filter((k) => attrs[k])
    .sort()
    .map((k) => `${k}=${attrs[k]}`)
    .join("|");
}

export function cleanValues(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

export function generateQuestions(product: RenderProduct, variables: readonly BuilderVariable[], design: Design): GeneratedSet {
  const notes: string[] = [];
  const byName = new Map(variables.map((v) => [v.name, v]));
  const baseline: Attributes = {};
  for (const [name, value] of Object.entries(design.baseline)) {
    if (value && byName.has(name)) baseline[name] = value;
  }
  const tested = design.tested.map((n) => byName.get(n)).filter((v): v is BuilderVariable => v !== undefined);
  if (tested.length === 0) notes.push("Pick at least one detail to vary.");

  const questions: GeneratedQuestion[] = [];
  const seenAttributes = new Set<string>();
  const seenText = new Set<string>();
  const add = (q: Omit<GeneratedQuestion, "text">) => {
    const key = attributesKey(q.attributes);
    if (seenAttributes.has(key)) return;
    seenAttributes.add(key);
    const text = renderPrompt(product, variables, q.attributes);
    if (seenText.has(text.toLowerCase())) return;
    seenText.add(text.toLowerCase());
    questions.push({ ...q, text });
  };

  add({ change: "start", kind: "start", attributes: { ...baseline } });

  if (design.mode === "one_at_a_time") {
    for (const v of tested) {
      for (const value of cleanValues(v.values)) {
        if (baseline[v.name] === value) continue;
        add({ change: `${v.label} = ${value}`, kind: "test", attributes: { ...baseline, [v.name]: value } });
      }
    }
  } else {
    if (tested.length < 2) notes.push("Every combination works best with two or more details.");
    let combos: Attributes[] = [{}];
    for (const v of tested) {
      const next: Attributes[] = [];
      for (const combo of combos) for (const value of cleanValues(v.values)) next.push({ ...combo, [v.name]: value });
      combos = next;
      if (combos.length > MAX_COMBINATIONS) break;
    }
    if (combos.length > MAX_COMBINATIONS) {
      notes.push(`Every combination would exceed ${MAX_COMBINATIONS} questions, so the list stops at ${MAX_COMBINATIONS}. Vary fewer details or values.`);
      combos = combos.slice(0, MAX_COMBINATIONS);
    }
    for (const combo of combos) {
      const change = tested.map((v) => `${v.label} = ${combo[v.name]}`).join(" · ");
      add({ change, kind: "combination", attributes: { ...baseline, ...combo } });
    }
  }
  return { questions, notes };
}

export type ExistingPrompt = { prompt_key: string; prompt_text: string; active: boolean };

export type ReviewedQuestion = GeneratedQuestion & {
  role: QuestionRole;
  /** Key of a prompt with the same wording, active or removed. Such a question cannot be added. */
  duplicateOf: string | null;
};

function wording(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Adds the dashboard's question role and any existing prompt with the same wording. */
export function reviewQuestions(questions: readonly GeneratedQuestion[], existing: readonly ExistingPrompt[]): ReviewedQuestion[] {
  const byWording = new Map(existing.map((p) => [wording(p.prompt_text), p.prompt_key]));
  return questions.map((q) => ({
    ...q,
    role: questionRole({ prompt_kind: "commercial", prompt: q.text }),
    duplicateOf: byWording.get(wording(q.text)) ?? null,
  }));
}

/** Calls one run makes for this many new prompts. */
export function callsPerRun(prompts: number, engines: number, repeats: number): number {
  return prompts * engines * repeats;
}
