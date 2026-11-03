"use client";

import { useEffect, useState, type RefObject } from "react";
import { useLocalStore } from "@/lib/canvas-sdk/local-store";

export type MetricSlotIds = [string | null, string | null, string | null];

export const EMPTY_METRIC_SLOTS: MetricSlotIds = [null, null, null];

export function reviveMetricSlots(raw: unknown): MetricSlotIds {
  if (!Array.isArray(raw)) return [null, null, null];
  return [0, 1, 2].map((index) => {
    const value = raw[index];
    return typeof value === "string" && value ? value : null;
  }) as MetricSlotIds;
}

/** Three stored metric picks plus the open picker. A click outside or Escape closes the picker. */
export function useMetricSlots(
  storageKey: string,
  defaults: MetricSlotIds,
  rootRef: RefObject<HTMLElement | null>,
) {
  const [slots, setSlots] = useLocalStore<MetricSlotIds>(storageKey, defaults, reviveMetricSlots);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  useEffect(() => {
    if (activeSlot === null) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setActiveSlot(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveSlot(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeSlot, rootRef]);

  const chooseMetric = (slotIndex: number, metricId: string | null) => {
    const next = [...slots] as MetricSlotIds;
    next[slotIndex] = metricId;
    setSlots(next);
    setActiveSlot(null);
  };

  const togglePicker = (slotIndex: number) =>
    setActiveSlot((current) => (current === slotIndex ? null : slotIndex));

  return { slots, activeSlot, setActiveSlot, togglePicker, chooseMetric };
}
