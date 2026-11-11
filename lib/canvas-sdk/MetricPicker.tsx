"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "@/lib/canvas-sdk/metric-picker.css";
import { metricTermAttrs } from "@/lib/canvas-sdk/metric-term";
import type { CanvasMetricPlacement, CanvasMetricReading } from "@/lib/canvas-sdk/minimal-view-types";
import type { CanvasMetric, SpokeContent } from "@/lib/canvas-sdk/types";

/** Balanced widgets pass plain metrics. Minimal adds the placement and the reading. */
type PickerMetric = CanvasMetric & CanvasMetricPlacement & { reading?: CanvasMetricReading };

type Props = {
  /** Names the slot in the dialog label, e.g. "widget 2". */
  slotName: string;
  metrics: PickerMetric[];
  spokes: Record<string, SpokeContent>;
  selectedId: string | null;
  onChoose: (metricId: string | null) => void;
};

/** Longer lists get a type-to-filter box. */
const FILTER_FROM = 12;

type Group = { key: string; label: string; metrics: PickerMetric[] };

function spokeName(spokes: Record<string, SpokeContent>, spokeId: string): string {
  return spokes[spokeId]?.navLabel ?? spokes[spokeId]?.title ?? spokeId;
}

function terms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every typed word must appear in the label, the value, the tab, or the group name. */
function matches(metric: PickerMetric, group: string, words: string[]): boolean {
  const text = [metric.label, metric.value, metric.subTab ?? "", group].join(" ").toLowerCase();
  return words.every((word) => text.includes(word));
}

/** Metric list grouped by area, in map order, then Other. Shared by the small and larger slots. */
export function MetricPicker({ slotName, metrics, spokes, selectedId, onChoose }: Props) {
  const [query, setQuery] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const filterable = metrics.length > FILTER_FROM;

  useEffect(() => {
    if (filterable) filterRef.current?.focus();
  }, [filterable]);

  const groups = useMemo<Group[]>(() => {
    const bySpoke = new Map<string, PickerMetric[]>();
    const byArea = new Map<string, PickerMetric[]>();
    for (const metric of metrics) {
      const [into, key] = metric.area ? [byArea, metric.area] : [bySpoke, metric.spokeId];
      into.set(key, [...(into.get(key) ?? []), metric]);
    }
    const areas = Object.keys(spokes).map((spokeId) => ({
      key: spokeId,
      label: spokeName(spokes, spokeId),
      metrics: bySpoke.get(spokeId) ?? [],
    }));
    const extra = [...byArea].map(([area, list]) => ({ key: `area:${area}`, label: area, metrics: list }));
    return [...areas, ...extra].filter((group) => group.metrics.length > 0);
  }, [metrics, spokes]);

  const words = terms(query);
  const shown = words.length
    ? groups
        .map((group) => ({
          ...group,
          metrics: group.metrics.filter((metric) => matches(metric, `${group.label} ${spokeName(spokes, metric.spokeId)}`, words)),
        }))
        .filter((group) => group.metrics.length > 0)
    : groups;
  const hasSelection = groups.some((group) => group.metrics.some((metric) => metric.id === selectedId));

  return (
    <div className="metric-widget-picker" role="dialog" aria-label={`Choose metric for ${slotName}`}>
      <div className="metric-widget-picker-header">
        <span>Choose a signal</span>
        <small>Duplicates are allowed</small>
      </div>
      {filterable ? (
        <input
          ref={filterRef}
          type="search"
          className="metric-picker-filter"
          placeholder="Type to filter"
          aria-label="Filter metrics"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = shown[0]?.metrics[0];
            if (event.key === "Enter" && words.length && first) onChoose(first.id);
          }}
        />
      ) : null}
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
        {shown.length === 0 ? (
          <p className="metric-picker-empty" role="status">
            No metric matches this filter.
          </p>
        ) : null}
        {shown.map((group) => (
          <section key={group.key} className="metric-widget-group">
            <h3>{group.label}</h3>
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
                <span className="metric-picker-option-text">
                  <span className="metric-picker-option-line">
                    <strong>
                      <span
                        className={option.definition ? "ifai-term" : undefined}
                        {...metricTermAttrs(option.label, option.definition)}
                      >
                        {option.label}
                      </span>
                    </strong>
                    <small
                      className={option.reading?.missing ? "ifai-term" : undefined}
                      {...metricTermAttrs(option.value, option.reading?.missing)}
                    >
                      {option.value}
                    </small>
                  </span>
                  {option.subTab ? (
                    <small className="metric-picker-option-tab">
                      {option.area ? `${spokeName(spokes, option.spokeId)} · ${option.subTab}` : option.subTab}
                    </small>
                  ) : null}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
