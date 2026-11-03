"use client";

import { useEffect } from "react";

/** The AI Readiness bubble. It leads with the page-found figure and opens Brand-Site Specs. */
export const PAGE_FOUND_BUBBLE_ID = "spoke-specs";

/**
 * A click on the AI Readiness bubble lands on the page-found hero. The shell resets the
 * panel scroll only when the tab changes, so this covers a click while Brand-Site Specs
 * is already open and scrolled.
 */
export function useLandOnPageFoundHero(anchorId: string) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(`[data-graph-node-id="${PAGE_FOUND_BUBBLE_ID}"]`)) return;
      requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: "nearest" });
      });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [anchorId]);
}
