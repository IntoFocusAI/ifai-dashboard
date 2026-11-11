"use client";

import { ACCURACY_LABELS, DEFAULT_FILTER, type ExplorerFilter } from "@/lib/ai-search/explorer-filter";
import { questionRole, ROLE_LABELS, type QuestionRole } from "@/lib/ai-search/question-role";
import { categoryLabel, cleanModelName, engineLabel, OUTCOME_LABELS } from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";

const OUTCOME_OPTIONS: Array<[ExplorerFilter["outcome"], string]> = [
  ["", "Any outcome"],
  ["resolved", "Resolved (clear leader)"],
  ["fender_win", OUTCOME_LABELS.fender_win],
  ["competitor_win", OUTCOME_LABELS.competitor_win],
  ["unresolved", OUTCOME_LABELS.unresolved],
  ["error", OUTCOME_LABELS.error],
  ["probe", OUTCOME_LABELS.probe],
];

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((v) => v?.trim() ?? "").filter(Boolean))].sort();
}

export function SimulationFilters({
  rows,
  filter,
  onChange,
}: {
  rows: AiCallRow[];
  filter: ExplorerFilter;
  onChange: (next: ExplorerFilter) => void;
}) {
  const set = (patch: Partial<ExplorerFilter>) => onChange({ ...filter, simId: null, ...patch });
  const engines = unique(rows.map((r) => r.engine?.toLowerCase()));
  const models = unique(rows.map((r) => cleanModelName(r.model)));
  const categories = unique(
    rows.filter((r) => filter.scope === "all" || r.prompt_kind === filter.scope).map((r) => r.category),
  );
  const roles = unique(rows.map((row) => questionRole(row))) as QuestionRole[];

  return (
    <div className="ai-sim-filters" style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 10px" }}>
      <div role="group" aria-label="Prompt type" style={{ display: "flex", gap: 4 }}>
        {(
          [
            ["commercial", "Shopping prompts"],
            ["probe", "Product fact checks"],
            ["all", "All calls"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`segmented-btn${filter.scope === value && filter.simId == null ? " active" : ""}`}
            aria-pressed={filter.scope === value}
            onClick={() => set({ scope: value, category: "" })}
          >
            {label}
          </button>
        ))}
      </div>
      <select aria-label="Engine" value={filter.engine} onChange={(e) => set({ engine: e.target.value })}>
        <option value="">All engines</option>
        {engines.map((engine) => (
          <option key={engine} value={engine}>{engineLabel(engine)}</option>
        ))}
      </select>
      <select aria-label="Model" value={filter.model} onChange={(e) => set({ model: e.target.value })}>
        <option value="">All models</option>
        {models.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
      <select
        aria-label="Question type"
        value={filter.role}
        onChange={(e) =>
          set({
            role: e.target.value as QuestionRole | "",
            scope: e.target.value === "probe" ? "probe" : filter.scope,
          })
        }
      >
        <option value="">All question types</option>
        {roles.map((role) => (
          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
        ))}
      </select>
      <select aria-label="Category" value={filter.category} onChange={(e) => set({ category: e.target.value })}>
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>{categoryLabel(category)}</option>
        ))}
      </select>
      <select
        aria-label="Outcome"
        value={filter.outcome}
        onChange={(e) => set({ outcome: e.target.value as ExplorerFilter["outcome"], brand: "" })}
      >
        {OUTCOME_OPTIONS.map(([value, label]) => (
          <option key={value || "any"} value={value}>{label}</option>
        ))}
      </select>
      <select
        aria-label="Fact-check result"
        value={filter.accuracy}
        onChange={(e) => {
          const accuracy = e.target.value as ExplorerFilter["accuracy"];
          const toFactChecks = accuracy !== "" && filter.scope === "commercial";
          set(toFactChecks ? { accuracy, scope: "probe", category: "" } : { accuracy });
        }}
      >
        <option value="">Any fact-check result</option>
        {Object.entries(ACCURACY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button type="button" className="segmented-btn" onClick={() => set({ scope: "commercial", outcome: "unresolved" })}>
        Unresolved
      </button>
      <button type="button" className="segmented-btn" onClick={() => set({ scope: "all", outcome: "error" })}>
        Errors
      </button>
      <button type="button" className="segmented-btn" onClick={() => onChange(DEFAULT_FILTER)}>
        Reset
      </button>
    </div>
  );
}
