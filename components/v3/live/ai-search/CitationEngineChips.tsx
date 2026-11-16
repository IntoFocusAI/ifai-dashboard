"use client";

import { engineKindLabel } from "@/lib/ai-search/citation-filters";

/**
 * One chip per engine with answers in the selection, beside the presets (decision 86). A preset
 * turns its chips on; any other mix reads Custom. The last chip on stays on.
 */
export function CitationEngineChips({
  available,
  selected,
  onToggle,
}: {
  available: readonly string[];
  selected: readonly string[];
  onToggle: (engine: string) => void;
}) {
  if (available.length < 2) return null;
  const on = new Set(selected);
  return (
    <div className="ai-engine-chips" role="group" aria-label="Engines in this view" data-citation-engine-chips>
      {available.map((engine) => {
        const pressed = on.has(engine);
        const last = pressed && on.size === 1;
        return (
          <button
            key={engine}
            type="button"
            className="ai-engine-chip"
            aria-pressed={pressed}
            aria-disabled={last || undefined}
            data-citation-engine-chip={engine}
            onClick={() => {
              if (!last) onToggle(engine);
            }}
          >
            {engineKindLabel(engine)}
          </button>
        );
      })}
    </div>
  );
}
