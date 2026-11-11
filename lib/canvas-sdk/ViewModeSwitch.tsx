"use client";

import "@/lib/canvas-sdk/minimal-view.css";
import type { CanvasViewMode } from "@/lib/canvas-sdk/minimal-view-types";
import type { CanvasViews } from "@/lib/canvas-sdk/useCanvasViewMode";

const OPTIONS: { mode: CanvasViewMode; label: string }[] = [
  { mode: "minimal", label: "Minimal" },
  { mode: "balanced", label: "Balanced" },
];

/** Header switch between the Minimal slots and the Balanced map. */
export function ViewModeSwitch({ views }: { views: CanvasViews }) {
  if (!views.enabled) return null;
  return (
    <div className="view-mode-switch" role="group" aria-label="View" data-view-mode-switch="">
      {OPTIONS.map((option) => {
        const active = views.mode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            className={`view-mode-option${active ? " active" : ""}`}
            aria-pressed={active}
            data-view-mode={option.mode}
            onClick={() => views.setMode(option.mode)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
