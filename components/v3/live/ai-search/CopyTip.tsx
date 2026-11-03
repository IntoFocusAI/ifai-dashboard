"use client";

import type { ReactNode } from "react";

/** Dotted copy whose detail lives in the shared custom tooltip, never a native title. */
export function CopyTip({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={label}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`${label}: ${description}`}
    >
      {children}
    </span>
  );
}
