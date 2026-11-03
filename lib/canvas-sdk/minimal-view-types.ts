import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { CanvasMetric, CanvasSpec } from "@/lib/canvas-sdk/types";

export type CanvasViewMode = "minimal" | "balanced";

/** What a larger Minimal slot adds to a metric. */
export type CanvasMetricReading = {
  /** What was counted out of what, e.g. "45 of 366 current Buy Box readings". Null when not stored. */
  ratio: string | null;
  /** The disc the metric's tab draws for the same counts. Null when the tab draws none. */
  pie: PieDiscData | null;
  /** Disc tooltip. */
  tip: string | null;
  /** Why the figure is missing. Shown as the tooltip on the figure. */
  missing: string | null;
};

/** Set on a figure no tab shows yet. */
export type CanvasMetricPlacement = {
  /** Picker group and slot overline, listed after the map areas. The slot still opens `spokeId`. */
  area?: "Other";
  /** Where the figure comes from. Shown as the tooltip on its label. */
  definition?: string;
};

export type CanvasMinimalMetric = CanvasMetric & CanvasMetricPlacement & { reading: CanvasMetricReading };

export type CanvasMinimalView = {
  /** Both slot sizes pick from this list. */
  metrics: CanvasMinimalMetric[];
  /** localStorage keys. The host appends a viewer scope so each viewer keeps their own choice. */
  viewStorageKey: string;
  smallStorageKey: string;
  largeStorageKey: string;
};

export type CanvasSpecWithViews = CanvasSpec & {
  /** Adds the Minimal / Balanced switch to the header. Balanced is the map. */
  minimalView?: CanvasMinimalView;
};
