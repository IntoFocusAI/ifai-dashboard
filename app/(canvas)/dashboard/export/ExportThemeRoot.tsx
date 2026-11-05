"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** The dashboard keeps its theme in memory, so a link can pass `?theme=light` along. */
export function ExportThemeRoot({ children }: { children: ReactNode }) {
  const light = useSearchParams().get("theme") === "light";
  return (
    <main className={`export-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
      {children}
    </main>
  );
}
