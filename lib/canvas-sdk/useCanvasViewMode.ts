"use client";

import { useLocalStore } from "@/lib/canvas-sdk/local-store";
import type { CanvasMinimalView, CanvasViewMode } from "@/lib/canvas-sdk/minimal-view-types";

const DEFAULT_MODE: CanvasViewMode = "balanced";
const UNUSED_KEY = "ifai:canvas-view:unused";

export function reviveViewMode(raw: unknown): CanvasViewMode {
  return raw === "minimal" ? "minimal" : DEFAULT_MODE;
}

export type CanvasViews = {
  /** False when the spec has no Minimal view. The switch is not drawn and the map always shows. */
  enabled: boolean;
  mode: CanvasViewMode;
  isMinimal: boolean;
  setMode: (mode: CanvasViewMode) => void;
  minimal: CanvasMinimalView | null;
};

/** Minimal or Balanced, remembered per viewer in this browser. Balanced until the viewer picks. */
export function useCanvasViewMode(minimal: CanvasMinimalView | undefined): CanvasViews {
  const [stored, setMode] = useLocalStore<CanvasViewMode>(
    minimal?.viewStorageKey ?? UNUSED_KEY,
    DEFAULT_MODE,
    reviveViewMode,
  );
  const mode = minimal ? stored : DEFAULT_MODE;
  return {
    enabled: Boolean(minimal),
    mode,
    isMinimal: mode === "minimal",
    setMode,
    minimal: minimal ?? null,
  };
}
