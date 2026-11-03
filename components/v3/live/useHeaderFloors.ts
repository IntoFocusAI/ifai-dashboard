"use client";

import { useEffect, useState, type RefObject } from "react";
import { measureHeaderWordMins } from "@/lib/fender-canvas/table-column-measure";

/**
 * Per column, the narrowest width at which its header breaks only between words.
 * Measured after paint and again once web fonts load, since both change header widths.
 */
export function useHeaderFloors(
  tableRef: RefObject<HTMLTableElement | null>,
  signature: string,
  containerWidth: number,
): Record<string, number> {
  const [floors, setFloors] = useState<Record<string, number>>({});

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const ids = signature.split("|").map((part) => part.split(":")[0]).filter(Boolean);
    let live = true;
    const run = () => {
      if (!live) return;
      const next = measureHeaderWordMins(table, ids);
      setFloors((current) => (ids.every((id) => (current[id] ?? 0) === (next[id] ?? 0)) ? current : next));
    };
    const frame = window.requestAnimationFrame(run);
    void document.fonts?.ready.then(run);
    return () => {
      live = false;
      window.cancelAnimationFrame(frame);
    };
  }, [tableRef, signature, containerWidth]);

  return floors;
}
