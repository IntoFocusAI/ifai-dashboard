"use client";

import { panelOpenedFrom, usePanelLanding } from "@/lib/canvas-sdk/panel-landing";

/** The AI Readiness bubble. It leads with the page-found figure and opens Brand-Site Specs. */
export const PAGE_FOUND_BUBBLE_ID = "spoke-specs";

/** True on the first render after a click on the AI Readiness bubble. */
export function openedFromPageFoundBubble(): boolean {
  return panelOpenedFrom(PAGE_FOUND_BUBBLE_ID);
}

/**
 * A click on the AI Readiness bubble opens the page-found table and lands on its hero. The
 * shell resets the panel scroll only when the tab changes, so this also covers a click while
 * Brand-Site Specs is already open and scrolled.
 */
export function useLandOnPageFoundHero(anchorId: string, openTable: () => void) {
  usePanelLanding(PAGE_FOUND_BUBBLE_ID, () => {
    openTable();
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ block: "nearest" });
    });
  });
}
