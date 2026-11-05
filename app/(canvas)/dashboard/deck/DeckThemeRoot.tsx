"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** The dashboard keeps its theme in memory, so a link can pass `?theme=light` along. */
export function DeckThemeRoot({ children }: { children: ReactNode }) {
  const light = useSearchParams().get("theme") === "light";
  return (
    <main className={`deck-page profile-modal-theme-canvas${light ? " is-light" : ""}`} data-deck-page="">
      {children}
    </main>
  );
}
