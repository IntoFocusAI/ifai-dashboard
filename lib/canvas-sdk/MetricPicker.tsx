"use client";

import { Check, Plus } from "lucide-react";
import { useMemo } from "react";
import type { CanvasMetric, SpokeContent } from "@/lib/canvas-sdk/types";

type Props = {
  /** Names the slot in the dialog label, e.g. "widget 2". */
  slotName: string;
  metrics: CanvasMetric[];
  spokes: Record<string, SpokeContent>;
  selectedId: string | null;
  onChoose: (metricId: string | null) => void;
};

/** Metric list grouped by spoke, in map order. Shared by the small and larger slots. */
export function MetricPicker({ slotName, metrics, spokes, selectedId, onChoose }: Props) {
  const groups = useMemo(() => {
    const bySpoke = new Map<string, CanvasMetric[]>();
    for (const metric of metrics) {
      const group = bySpoke.get(metric.spokeId) ?? [];
      group.push(metric);
      bySpoke.set(metric.spokeId, group);
    }
    return Object.keys(spokes)
      .map((spokeId) => ({ spokeId, metrics: bySpoke.get(spokeId) ?? [] }))
      .filter((group) => group.metrics.length > 0);
  }, [metrics, spokes]);
  const hasSelection = groups.some((group) => group.metrics.some((metric) => metric.id === selectedId));

  return (
    <div className="metric-widget-picker" role="dialog" aria-label={`Choose metric for ${slotName}`}>
      <div className="metric-widget-picker-header">
        <span>Choose a signal</span>
        <small>Duplicates are allowed</small>
      </div>
      <button
        type="button"
        className={`metric-widget-option metric-widget-clear${hasSelection ? "" : " selected"}`}
        onClick={() => onChoose(null)}
      >
        <span className="metric-widget-option-icon">
          {hasSelection ? <Plus size={13} /> : <Check size={13} />}
        </span>
        <span>
          <strong>No metric</strong>
          <small>Show an empty add bubble</small>
        </span>
      </button>
      <div className="metric-widget-picker-list">
        {groups.map((group) => {
          const groupSpoke = spokes[group.spokeId];
          const groupLabel = groupSpoke?.navLabel ?? groupSpoke?.title ?? group.spokeId;
          return (
            <section key={group.spokeId} className="metric-widget-group">
              <h3>{groupLabel}</h3>
              {group.metrics.map((option) => (
                <button
                  type="button"
                  className={`metric-widget-option${option.id === selectedId ? " selected" : ""}`}
                  key={option.id}
                  data-metric-option={option.id}
                  onClick={() => onChoose(option.id)}
                >
                  <span className="metric-widget-option-icon">
                    {option.id === selectedId ? <Check size={13} /> : null}
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.value}</small>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
