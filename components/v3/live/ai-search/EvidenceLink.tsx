"use client";

import type { ReactNode } from "react";
import { formatEvidence, setEvidenceFocus, type EvidenceFocus } from "@/lib/ai-search/evidence-focus";

/**
 * Opens the rows behind a figure. `data-ifai-open` lets the panel's delegated
 * handler switch spoke and tab; the click also stores the evidence focus.
 */
export function EvidenceLink({
  focus,
  spokeId,
  tab,
  children,
  label,
}: {
  focus: EvidenceFocus | null;
  spokeId?: string;
  tab?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="ifai-evidence-link"
      data-ifai-open={tab ? (spokeId ?? "aeo") : undefined}
      data-ifai-tab={tab}
      data-ifai-evidence={focus ? formatEvidence(focus) : "all"}
      aria-label={label}
      onClickCapture={() => setEvidenceFocus(focus)}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        color: "var(--text-main)",
        fontWeight: 600,
        cursor: "pointer",
        font: "inherit",
        textDecoration: "underline",
        textUnderlineOffset: 2,
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}
