"use client";

import "@/lib/canvas-sdk/minimal-view.css";
import { useMemo } from "react";
import { LargeMetricSlots } from "@/lib/canvas-sdk/LargeMetricSlots";
import { EMPTY_METRIC_SLOTS } from "@/lib/canvas-sdk/metric-slots";
import { MetricWidgets } from "@/lib/canvas-sdk/MetricWidgets";
import type { CanvasMetricWidgets, SpokeContent } from "@/lib/canvas-sdk/types";
import type { CanvasViews } from "@/lib/canvas-sdk/useCanvasViewMode";

type Props = {
  views: CanvasViews;
  spokes: Record<string, SpokeContent>;
  onOpenMetric: (spokeId: string, subTab?: string) => void;
};

/**
 * Minimal view: the map area holds only the slots the viewer fills.
 * Three small slots reuse MetricWidgets; three larger slots add N of M and the tab's disc.
 */
export function MinimalView({ views, spokes, onOpenMetric }: Props) {
  const minimal = views.minimal;
  const small = useMemo<CanvasMetricWidgets | null>(
    () =>
      minimal
        ? { metrics: minimal.metrics, defaults: EMPTY_METRIC_SLOTS, storageKey: minimal.smallStorageKey }
        : null,
    [minimal],
  );
  if (!views.isMinimal || !minimal || !small) return null;

  return (
    <section className="minimal-view" aria-label="Minimal view" data-minimal-view="">
      <div className="minimal-view-board">
        <MetricWidgets config={small} spokes={spokes} onOpenMetric={onOpenMetric} />
        <LargeMetricSlots
          metrics={minimal.metrics}
          storageKey={minimal.largeStorageKey}
          spokes={spokes}
          onOpenMetric={onOpenMetric}
        />
      </div>
    </section>
  );
}
