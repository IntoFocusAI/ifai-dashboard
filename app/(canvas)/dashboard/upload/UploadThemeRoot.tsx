"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { UploadDefinitionTooltip } from "./UploadDefinitionTooltip";

/** The dashboard keeps its theme in memory, so a link can pass `?theme=light`. */
export function UploadThemeRoot({ children }: { children: ReactNode }) {
  const light = useSearchParams().get("theme") === "light";
  return (
    <main className={`upload-page profile-modal-theme-canvas${light ? " is-light" : ""}`}>
      <UploadDefinitionTooltip />
      {children}
    </main>
  );
}
