"use client";

import type { CitationScope } from "@/lib/ai-search/citations";

const SCOPES: Array<[CitationScope, string]> = [
  ["commercial", "Shopping answers"],
  ["probe", "Product fact checks"],
  ["all", "All answers"],
];

/** Scope buttons. They lead the control row; the counts they change sit in the figure tiles. */
export function CitationControlsStrip({
  scope,
  onScope,
}: {
  scope: CitationScope;
  onScope: (scope: CitationScope) => void;
}) {
  return (
    <div className="citation-controls citation-controls-scopes" data-citation-controls>
      <div role="group" aria-label="Citation scope" className="citation-scope-group">
        {SCOPES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`segmented-btn${scope === value ? " active" : ""}`}
            aria-pressed={scope === value}
            onClick={() => onScope(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
