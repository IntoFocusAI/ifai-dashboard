"use client";

import { Plus, Wrench } from "lucide-react";
import { useMemo, useRef } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { MetricPicker } from "@/lib/canvas-sdk/MetricPicker";
import { EMPTY_METRIC_SLOTS, useMetricSlots } from "@/lib/canvas-sdk/metric-slots";
import type { CanvasMinimalMetric } from "@/lib/canvas-sdk/minimal-view-types";
import type { SpokeContent } from "@/lib/canvas-sdk/types";

type Props = {
  metrics: CanvasMinimalMetric[];
  storageKey: string;
  spokes: Record<string, SpokeContent>;
  onOpenMetric: (spokeId: string, subTab?: string) => void;
};

function LargeMetricBody({
  metric,
  category,
  onOpen,
}: {
  metric: CanvasMinimalMetric;
  category: string | undefined;
  onOpen: () => void;
}) {
  const { reading } = metric;
  const tab = metric.subTab ?? category;
  return (
    <button
      type="button"
      className="large-metric-body"
      onClick={onOpen}
      aria-label={`Open ${metric.label} in ${category}${reading.missing ? `. ${reading.missing}` : ""}`}
      data-metric-id={metric.id}
    >
      <span className="metric-widget-category">{category}</span>
      <span className="large-metric-label">{metric.label}</span>
      <span className="large-metric-row">
        <span className="large-metric-figures">
          <strong
            className={`large-metric-value tone-${metric.tone ?? "neutral"}${metric.value.length > 7 ? " is-long" : ""}${reading.missing ? " ifai-term" : ""}`}
            data-large-metric-value=""
            {...(reading.missing
              ? { "data-ifai-tooltip-title": metric.value, "data-ifai-tooltip-desc": reading.missing }
              : {})}
          >
            {metric.value}
          </strong>
          {reading.ratio ? (
            <span className="large-metric-ratio" data-large-metric-ratio="">
              {reading.ratio}
            </span>
          ) : null}
        </span>
        {reading.pie ? (
          <CitationPieDisc
            pie={reading.pie}
            sizeClass="citation-pie-disc large-metric-disc"
            tip={reading.tip ?? undefined}
          />
        ) : null}
      </span>
      {metric.detail && metric.detail !== reading.ratio ? (
        <span className="metric-widget-detail large-metric-detail">{metric.detail}</span>
      ) : null}
      {tab ? <span className="large-metric-opens">Opens {tab}</span> : null}
    </button>
  );
}

/** Three larger Minimal slots. Each shows a picked metric with its N of M and its tab's disc. */
export function LargeMetricSlots({ metrics, storageKey, spokes, onOpenMetric }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { slots, activeSlot, setActiveSlot, togglePicker, chooseMetric } = useMetricSlots(
    storageKey,
    EMPTY_METRIC_SLOTS,
    rootRef,
  );
  const metricsById = useMemo(
    () => new Map(metrics.map((metric) => [metric.id, metric])),
    [metrics],
  );

  return (
    <div className="large-metric-slots" ref={rootRef} aria-label="Larger metrics">
      {slots.map((metricId, slotIndex) => {
        const metric = metricId ? metricsById.get(metricId) : undefined;
        const spoke = metric ? spokes[metric.spokeId] : undefined;
        const category = spoke?.navLabel ?? spoke?.title;
        const pickerOpen = activeSlot === slotIndex;
        const slotName = `large slot ${slotIndex + 1}`;

        return (
          <div
            className={`large-metric-slot${metric ? "" : " is-empty"}${pickerOpen ? " picker-open" : ""}`}
            key={slotIndex}
            data-large-slot={slotIndex + 1}
          >
            {metric ? (
              <LargeMetricBody
                metric={metric}
                category={category}
                onOpen={() => onOpenMetric(metric.spokeId, metric.subTab)}
              />
            ) : (
              <button
                type="button"
                className="large-metric-empty"
                onClick={() => setActiveSlot(slotIndex)}
                aria-label={`Add metric to ${slotName}`}
              >
                <Plus aria-hidden="true" size={44} strokeWidth={1.4} />
                <span>Add metric</span>
              </button>
            )}

            <button
              type="button"
              className="metric-widget-config"
              onClick={() => togglePicker(slotIndex)}
              aria-label={`Configure ${slotName}`}
              aria-expanded={pickerOpen}
              title="Choose metric"
            >
              <Wrench aria-hidden="true" size={13} strokeWidth={1.8} />
            </button>

            {pickerOpen ? (
              <MetricPicker
                slotName={slotName}
                metrics={metrics}
                spokes={spokes}
                selectedId={metric?.id ?? null}
                onChoose={(next) => chooseMetric(slotIndex, next)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
