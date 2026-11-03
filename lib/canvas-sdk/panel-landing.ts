"use client";

import { useEffect, useRef } from "react";

/**
 * Which map bubble opened the panel, so a tab can land on the part that bubble leads with.
 * The shell sets it on every open: the bubble id for a bubble click, null for any other way in.
 * A tab panel mounts after the click that opens it, so it reads the landing on mount, and it
 * hears later bubble clicks while it stays open.
 */

let landedFrom: string | null = null;
const listeners = new Set<(bubbleId: string | null) => void>();

export function landPanelFrom(bubbleId: string | null): void {
  landedFrom = bubbleId;
  for (const listener of listeners) listener(bubbleId);
}

/** For a panel's first render, so it opens on the landing instead of switching to it. */
export function panelOpenedFrom(bubbleId: string): boolean {
  return landedFrom === bubbleId;
}

/** Runs `onLand` once per open from `bubbleId`, on mount or while the panel is already open. */
export function usePanelLanding(bubbleId: string, onLand: () => void): void {
  const latest = useRef(onLand);
  useEffect(() => {
    latest.current = onLand;
  });
  useEffect(() => {
    const listener = (from: string | null) => {
      if (from !== bubbleId) return;
      landedFrom = null;
      latest.current();
    };
    listener(landedFrom);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [bubbleId]);
}
