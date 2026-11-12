"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { DeckOverlay } from "@/components/v3/live/deck/DeckOverlay";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import "@/components/v3/live/deck/deck.css";

/**
 * C-01: opens the briefing deck for the client on screen and the date pill's window.
 * The deck renders inside the dashboard's providers, so it reads what the tabs read.
 */
export function DeckLauncher({ bundle, retail }: { bundle: CanvasBundle; retail: RetailCanvasRead }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="deck-launch-row">
        <button type="button" className="segmented-btn deck-launch" data-deck-open="" onClick={() => setOpen(true)}>
          Present as deck
        </button>
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(<DeckOverlay bundle={bundle} retail={retail} onClose={() => setOpen(false)} />, document.body)
        : null}
    </>
  );
}
