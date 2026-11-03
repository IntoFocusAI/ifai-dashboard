"use client";

import { Plus, Wrench } from "lucide-react";
import { useMemo, useRef } from "react";
import { MetricPicker } from "@/lib/canvas-sdk/MetricPicker";
import { useMetricSlots, type MetricSlotIds } from "@/lib/canvas-sdk/metric-slots";
import type { CanvasMinimalMetric } from "@/lib/canvas-sdk/minimal-view-types";
import type { CanvasMetricWidgets, SpokeContent } from "@/lib/canvas-sdk/types";

type Props = {
  config: CanvasMetricWidgets;
  spokes: Record<string, SpokeContent>;
  onOpenMetric: (spokeId: string, subTab?: string) => void;
};

export function MetricWidgets({ config, spokes, onOpenMetric }: Props) {
  const defaults = useMemo<MetricSlotIds>(
    () => [...config.defaults] as MetricSlotIds,
    [config.defaults],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const { slots, activeSlot, setActiveSlot, togglePicker, chooseMetric } = useMetricSlots(
    config.storageKey,
    defaults,
    rootRef,
  );

  const metricsById = useMemo(
    () => new Map(config.metrics.map((metric) => [metric.id, metric])),
    [config.metrics],
  );

  return (
    <div className="canvas-metric-widgets" ref={rootRef} aria-label="Configurable metrics">
      {slots.map((metricId, slotIndex) => {
        const metric = metricId ? metricsById.get(metricId) : undefined;
        const spoke = metric ? spokes[metric.spokeId] : undefined;
        const category = spoke?.navLabel ?? spoke?.title;
        const pickerOpen = activeSlot === slotIndex;
        const missing = (metric as Partial<CanvasMinimalMetric> | undefined)?.reading?.missing ?? null;

        return (
          <div
            className={`canvas-metric-widget${metric ? "" : " is-empty"}${pickerOpen ? " picker-open" : ""}`}
            key={slotIndex}
            data-slot={slotIndex + 1}
          >
            {metric ? (
              <button
                type="button"
                className="metric-widget-body"
                onClick={() => onOpenMetric(metric.spokeId, metric.subTab)}
                aria-label={`Open ${metric.label} in ${category}${missing ? `. ${missing}` : ""}`}
                data-metric-id={metric.id}
              >
                <span className="metric-widget-category">{category}</span>
                <span className="metric-widget-label">{metric.label}</span>
                <strong
                  className={`metric-widget-value tone-${metric.tone ?? "neutral"}${metric.value.length > 14 ? " is-longer" : ""}${missing ? " ifai-term" : ""}`}
                  {...(missing
                    ? { "data-ifai-tooltip-title": metric.value, "data-ifai-tooltip-desc": missing }
                    : {})}
                >
                  {metric.value}
                </strong>
                <span className="metric-widget-detail">{metric.detail}</span>
              </button>
            ) : (
              <button
                type="button"
                className="metric-widget-empty"
                onClick={() => setActiveSlot(slotIndex)}
                aria-label={`Add metric to widget ${slotIndex + 1}`}
              >
                <Plus aria-hidden="true" size={31} strokeWidth={1.6} />
                <span>Add metric</span>
              </button>
            )}

            <button
              type="button"
              className="metric-widget-config"
              onClick={() => togglePicker(slotIndex)}
              aria-label={`Configure widget ${slotIndex + 1}`}
              aria-expanded={pickerOpen}
              title="Choose metric"
            >
              <Wrench aria-hidden="true" size={13} strokeWidth={1.8} />
            </button>

            {pickerOpen ? (
              <MetricPicker
                slotName={`widget ${slotIndex + 1}`}
                metrics={config.metrics}
                spokes={spokes}
                selectedId={metric?.id ?? null}
                onChoose={(metricId) => chooseMetric(slotIndex, metricId)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
