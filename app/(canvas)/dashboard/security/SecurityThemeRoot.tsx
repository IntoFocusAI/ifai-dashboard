"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** The dashboard keeps its theme in memory, so the menu link passes `?theme=light` along. */
export function SecurityThemeRoot({ children }: { children: ReactNode }) {
  const light = useSearchParams().get("theme") === "light";
  return (
    <main className={`security-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
      {children}
    </main>
  );
}
