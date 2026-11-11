"use client";

import type { ReactNode } from "react";
import { AI_DEFINITIONS, type AiTermKey } from "@/lib/ai-search/definitions";
import { brandName } from "@/lib/brand-copy";

/** Dotted AI Search term. Uses the shared custom tooltip, never a native title. */
export function AiTerm({ term, children }: { term: AiTermKey; children?: ReactNode }) {
  const description = AI_DEFINITIONS[term];
  // Term keys name Fender ("Fender lead"); the words on screen name the active brand.
  const shown = term.replace(/^Fender/, brandName());
  const label = shown.charAt(0).toUpperCase() + shown.slice(1);
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={label}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`${label}: ${description}`}
    >
      {children ?? shown}
    </span>
  );
}
