"use client";

import { Plus, Wrench } from "lucide-react";
import { useMemo, useRef } from "react";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { dataStatusFromNode } from "@/lib/canvas-sdk/data-status";
import { MetricPicker } from "@/lib/canvas-sdk/MetricPicker";
import { useMetricSlots, type MetricSlotIds } from "@/lib/canvas-sdk/metric-slots";
import { metricTermAttrs } from "@/lib/canvas-sdk/metric-term";
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
        const spokeLabel = spoke?.navLabel ?? spoke?.title;
        const pickerOpen = activeSlot === slotIndex;
        const minimal = metric as Partial<CanvasMinimalMetric> | undefined;
        const missing = minimal?.reading?.missing ?? null;
        const definition = minimal?.definition;
        const notes = [definition, missing].filter(Boolean).join(" ");
        // A status color always carries its mark and word (X-34); Not available* stays plain.
        const status = missing ? null : dataStatusFromNode(metric?.tone);
        const tone = status ? metric?.tone : "neutral";

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
                aria-label={`Open ${metric.label} in ${spokeLabel}${notes ? `. ${notes}` : ""}`}
                data-metric-id={metric.id}
              >
                <span className="metric-widget-category">{minimal?.area ?? spokeLabel}</span>
                <span className="metric-widget-label">
                  {definition ? (
                    <span className="ifai-term" {...metricTermAttrs(metric.label, definition)}>
                      {metric.label}
                    </span>
                  ) : (
                    metric.label
                  )}
                </span>
                <strong
                  className={`metric-widget-value tone-${tone ?? "neutral"}${metric.value.length > 14 ? " is-longer" : ""}${missing ? " ifai-term" : ""}`}
                  {...metricTermAttrs(metric.value, missing)}
                >
                  {metric.value}
                </strong>
                {status ? <StatusMark status={status} /> : null}
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
