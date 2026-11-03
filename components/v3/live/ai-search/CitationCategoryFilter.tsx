"use client";

import "@/components/v3/live/ai-search/citation-top-sources.css";
import type { CitationCategoryOption } from "@/lib/ai-search/citation-top-sources";

/**
 * One category at a time. Narrows the chart, tiles, and tables on the tab.
 * Sits in the control row beside the scope buttons.
 */
export function CitationCategoryFilter({
  options,
  value,
  scopeNoun,
  onChange,
}: {
  options: CitationCategoryOption[];
  value: string | null;
  scopeNoun: string;
  onChange: (category: string | null) => void;
}) {
  if (options.length < 2) return null;
  const active = value == null ? null : (options.find((option) => option.key === value) ?? null);
  return (
    <div className="citation-category-filter" data-citation-category-filter data-active-category={active?.key ?? ""}>
      <div role="group" aria-label="Filter by category" className="citation-category-chips">
        <span className="citation-category-label">Category</span>
        <button
          type="button"
          className={`segmented-btn${active ? "" : " active"}`}
          aria-pressed={!active}
          data-citation-category="all"
          onClick={() => onChange(null)}
        >
          All categories
        </button>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`segmented-btn${active?.key === option.key ? " active" : ""}`}
            aria-pressed={active?.key === option.key}
            data-citation-category={option.key}
            onClick={() => onChange(active?.key === option.key ? null : option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {active ? (
        <p className="citation-category-status" data-citation-category-active={active.key} aria-live="polite">
          <span>
            Showing <strong>{active.label}</strong> only: {active.answered} {scopeNoun}.
          </span>
          <button
            type="button"
            className="citation-category-clear"
            data-citation-category-clear
            onClick={() => onChange(null)}
          >
            Clear category
          </button>
        </p>
      ) : null}
    </div>
  );
}
